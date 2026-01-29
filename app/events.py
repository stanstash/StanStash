import time
from flask_login import current_user
from flask_socketio import emit
from . import socketio, db
from .models import ChatMessage
from app import db # Asegúrate de importar db
from .games.crash import crash_engine

@socketio.on('connect')
def handle_connect():
    # Recuperar últimos 50 mensajes (ordenados por ID para precisión)
    recent_messages = ChatMessage.query.order_by(ChatMessage.id.desc()).limit(50).all()
    
    history = []
    # Invertimos para enviar [Viejo -> Nuevo]
    for msg in recent_messages[::-1]: 
        avatar = msg.user.avatar if msg.user else 'default.png'
        history.append({
            'username': msg.username,
            'message': msg.message,
            'avatar': avatar,
            'timestamp': msg.timestamp
        })
    
    emit('chat_history', {'messages': history})

@socketio.on('send_message')
def handle_send_message(data):
    if not current_user.is_authenticated: return
    
    msg_text = data.get('message', '').strip()
    if not msg_text or len(msg_text) > 500: return

    # Guardar en BBDD
    new_msg = ChatMessage(user_id=current_user.id, username=current_user.username, message=msg_text)
    db.session.add(new_msg)
    db.session.commit()

    # Emitir a todos
    emit('new_message', {
        'username': current_user.username,
        'message': msg_text,
        'avatar': current_user.avatar,
        'timestamp': int(time.time())
    }, broadcast=True)

    # ... (imports anteriores) ...
from .games.crash import crash_engine # Importamos el motor

# --- EVENTOS DEL JUEGO CRASH ---


# --- EVENTOS DE JUEGO CRASH ---

@socketio.on('join_crash')
def handle_join_crash():
    """Sincroniza estado al entrar o F5"""
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
        'my_bet': user_active_bet
    })

@socketio.on('place_bet_crash')
def handle_place_bet(data):
    if not current_user.is_authenticated: return
    if crash_engine.state not in ['IDLE', 'WAITING']: return emit('error_msg', {'msg': 'Ronda en curso'})
    if current_user.id in crash_engine.bets: return emit('error_msg', {'msg': 'Ya apostaste'})

    try: amount = float(data.get('amount'))
    except: return

    if amount <= 0 or amount > float(current_user.saldo): 
        return emit('error_msg', {'msg': 'Saldo insuficiente'})

    # 1. TRANSACCIÓN DB
    current_user.saldo = float(current_user.saldo) - amount
    db.session.commit()

    # 2. LOGICA JUEGO
    crash_engine.bets[current_user.id] = {
        'username': current_user.username, 'amount': amount, 'cashed_out': False, 'avatar': current_user.avatar
    }

    # 3. RESPUESTAS
    # Al usuario (para actualizar UI inmediata)
    emit('bet_accepted', {'amount': amount, 'new_balance': float(current_user.saldo)})
    
    # A todos (para tabla)
    emit('new_bet_crash', {
        'username': current_user.username, 'amount': amount, 'avatar': current_user.avatar
    }, broadcast=True)

@socketio.on('cash_out_crash')
def handle_cash_out():
    if not current_user.is_authenticated: return
    if crash_engine.state != 'RUNNING': return

    bet = crash_engine.bets.get(current_user.id)
    if bet and not bet['cashed_out']:
        mult = crash_engine.multiplier
        win = bet['amount'] * mult
        
        # 1. Actualizar DB
        bet['cashed_out'] = True
        current_user.saldo = float(current_user.saldo) + win
        db.session.commit()

        # 2. Respuestas
        emit('cashout_success', {'win': win, 'mult': mult, 'new_balance': float(current_user.saldo)}) # Feedback personal
        emit('balance_update', {'saldo': float(current_user.saldo)}) # Actualizar nav
        
        emit('player_cashed_out', {
            'username': current_user.username, 'mult': f"{mult:.2f}", 'win': f"{win:.2f}"
        }, broadcast=True)