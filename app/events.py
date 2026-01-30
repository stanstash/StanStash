import time
from flask_login import current_user
from flask_socketio import emit
from . import socketio, db
from .games.crash import crash_engine

# ... imports ...
@socketio.on('join_crash')
def handle_join_crash():
    current_players = []
    user_active_bet = None

    for user_id, info in crash_engine.bets.items():
        current_players.append({
            'username': info['username'],
            'amount': info['amount'],
            'avatar': info['avatar'],
            'cashed_out': info['cashed_out'],
            'win': (info['amount'] * crash_engine.multiplier) if info['cashed_out'] else 0,
            'mult': crash_engine.multiplier if info['cashed_out'] else 0
        })
        if current_user.is_authenticated and user_id == current_user.id:
            user_active_bet = info

    emit('crash_sync', {
        'state': crash_engine.state,
        'multiplier': f"{crash_engine.multiplier:.2f}",
        'time_left': getattr(crash_engine, 'next_round_time', 0) - time.time(),
        'players': current_players,
        'my_bet': user_active_bet,
        'history': crash_engine.history # <--- NUEVO
    })

# ... resto del archivo igual ...

@socketio.on('place_bet_crash')
def handle_place_bet(data):
    if not current_user.is_authenticated: return
    
    # Permitir apostar en IDLE o WAITING
    if crash_engine.state not in ['IDLE', 'WAITING']: 
        return emit('error_msg', {'msg': 'Ronda en curso'})
    
    if current_user.id in crash_engine.bets: 
        return emit('error_msg', {'msg': 'Ya has apostado'})

    try: amount = float(data.get('amount', 0))
    except: return

    if amount <= 0 or amount > float(current_user.saldo): 
        return emit('error_msg', {'msg': 'Saldo insuficiente'})

    # 1. Cobrar
    current_user.saldo = float(current_user.saldo) - amount
    db.session.commit()

    # 2. Registrar
    crash_engine.bets[current_user.id] = {
        'username': current_user.username, 
        'amount': amount, 
        'cashed_out': False, 
        'avatar': current_user.avatar
    }

    # 3. Confirmar al usuario (Actualiza botones y saldo)
    emit('bet_accepted', {
        'amount': amount, 
        'new_balance': float(current_user.saldo)
    })
    
    # 4. AVISAR A TODOS (Para que salga en la lista)
    emit('new_bet_crash', {
        'username': current_user.username, 
        'amount': amount, 
        'avatar': current_user.avatar
    }, broadcast=True)

@socketio.on('cash_out_crash')
def handle_cash_out():
    if not current_user.is_authenticated: return
    if crash_engine.state != 'RUNNING': return

    bet = crash_engine.bets.get(current_user.id)
    if bet and not bet['cashed_out']:
        mult = crash_engine.multiplier
        win = bet['amount'] * mult
        
        bet['cashed_out'] = True
        current_user.saldo = float(current_user.saldo) + win
        db.session.commit()

        emit('cashout_success', {'win': win, 'mult': mult, 'new_balance': float(current_user.saldo)})
        emit('balance_update', {'saldo': float(current_user.saldo)})
        
        emit('player_cashed_out', {
            'username': current_user.username, 'mult': f"{mult:.2f}", 'win': f"{win:.2f}"
        }, broadcast=True)

        # ... (Todo el código de Crash que ya tienes arriba) ...

# === CHAT GLOBAL (AÑADIR ESTO AL FINAL) ===

# Variable global simple para guardar últimos 50 mensajes
chat_messages = []

@socketio.on('connect')
def handle_connect():
    # Al conectar, enviamos el historial de chat (y lo de Crash si hiciera falta)
    emit('chat_history', {'messages': chat_messages})
    # (La lógica de Crash ya envía su sync por separado en join_crash)

@socketio.on('send_message')
def handle_send_message(data):
    if not current_user.is_authenticated:
        return
    
    msg = data.get('message', '').strip()
    if not msg: return

    # Crear objeto mensaje
    message_data = {
        'username': current_user.username,
        'avatar': current_user.avatar,
        'message': msg[:200], # Limitar caracteres
        'timestamp': time.time()
    }

    # Guardar en memoria
    chat_messages.append(message_data)
    if len(chat_messages) > 50:
        chat_messages.pop(0)

    # Reenviar a TODOS
    emit('new_message', message_data, broadcast=True)