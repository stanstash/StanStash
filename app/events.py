import time
from flask_login import current_user
from flask_socketio import emit
from . import socketio, db
from .models import ChatMessage

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

@socketio.on('join_crash')
def handle_join_crash():
    """Cuando entras a la página de juegos"""
    emit('crash_sync', {
        'state': crash_engine.state,
        'multiplier': f"{crash_engine.multiplier:.2f}",
        'bets': crash_engine.bets
    })

@socketio.on('place_bet_crash')
def handle_place_bet(data):
    if not current_user.is_authenticated: return
    if crash_engine.state != 'WAITING':
        emit('error_msg', {'msg': 'La ronda ya ha empezado'})
        return

    amount = float(data.get('amount'))
    if amount <= 0 or amount > current_user.saldo:
        emit('error_msg', {'msg': 'Saldo insuficiente o inválido'})
        return

    # 1. Restar saldo inmediatamente
    current_user.saldo = float(current_user.saldo) - amount
    db.session.commit()

    # 2. Registrar apuesta en memoria del juego
    crash_engine.bets[current_user.id] = {
        'username': current_user.username,
        'amount': amount,
        'cashed_out': False,
        'avatar': current_user.avatar
    }

    # 3. Avisar a todos
    emit('new_bet_crash', {
        'username': current_user.username,
        'amount': amount,
        'avatar': current_user.avatar
    }, broadcast=True)
    
    # 4. Actualizar saldo visual del usuario
    emit('balance_update', {'saldo': float(current_user.saldo)})

@socketio.on('cash_out_crash')
def handle_cash_out():
    if not current_user.is_authenticated: return
    if crash_engine.state != 'RUNNING': return

    bet_info = crash_engine.bets.get(current_user.id)
    
    # Si apostó y no ha retirado aún
    if bet_info and not bet_info['cashed_out']:
        current_mult = crash_engine.multiplier
        win_amount = bet_info['amount'] * current_mult
        
        # 1. Marcar como retirado
        crash_engine.bets[current_user.id]['cashed_out'] = True
        
        # 2. Pagar
        current_user.saldo = float(current_user.saldo) + win_amount
        db.session.commit()

        # 3. Avisar
        emit('player_cashed_out', {
            'username': current_user.username,
            'mult': f"{current_mult:.2f}",
            'win': f"{win_amount:.2f}"
        }, broadcast=True)

        emit('balance_update', {'saldo': float(current_user.saldo)})
        emit('cashout_success', {'win': win_amount})

        