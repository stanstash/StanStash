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

@socketio.on('join_crash')
def handle_join_crash():
    """Cuando entras a la página de juegos"""
    emit('crash_sync', {
        'state': crash_engine.state,
        'multiplier': f"{crash_engine.multiplier:.2f}",
        'bets': crash_engine.bets
    })

# ... (imports) ...
from app import db # Asegúrate de importar db
from .games.crash import crash_engine

# ... (join_crash igual que antes) ...

@socketio.on('place_bet_crash')
def handle_place_bet(data):
    if not current_user.is_authenticated: return
    
    # Solo se puede apostar en IDLE o WAITING
    if crash_engine.state not in ['IDLE', 'WAITING']:
        emit('error_msg', {'msg': 'Espera a la siguiente ronda'})
        return

    # Verificar si ya apostó en esta ronda
    if current_user.id in crash_engine.bets:
        emit('error_msg', {'msg': 'Ya has apostado en esta ronda'})
        return

    try:
        amount = float(data.get('amount'))
    except:
        return

    if amount <= 0: return
    if amount > float(current_user.saldo):
        emit('error_msg', {'msg': 'Saldo insuficiente'})
        return

    # 1. RESTAR DINERO (Transacción DB)
    current_user.saldo = float(current_user.saldo) - amount
    db.session.commit() # ¡Guardar cambios!

    # 2. Registrar en el motor
    crash_engine.bets[current_user.id] = {
        'username': current_user.username,
        'amount': amount,
        'cashed_out': False,
        'avatar': current_user.avatar
    }

    # 3. Notificar cambios
    # A todos (para la lista de jugadores)
    emit('new_bet_crash', {
        'username': current_user.username,
        'amount': amount,
        'avatar': current_user.avatar
    }, broadcast=True)
    
    # Al usuario (para actualizar su saldo visual)
    emit('balance_update', {'saldo': float(current_user.saldo)})

@socketio.on('cash_out_crash')
def handle_cash_out():
    if not current_user.is_authenticated: return
    if crash_engine.state != 'RUNNING': return

    bet_info = crash_engine.bets.get(current_user.id)
    
    if bet_info and not bet_info['cashed_out']:
        current_mult = crash_engine.multiplier
        win_amount = bet_info['amount'] * current_mult
        
        # 1. Marcar retirado
        crash_engine.bets[current_user.id]['cashed_out'] = True
        
        # 2. SUMAR DINERO
        current_user.saldo = float(current_user.saldo) + win_amount
        db.session.commit() # ¡Guardar cambios!

        # 3. Notificar
        emit('player_cashed_out', {
            'username': current_user.username,
            'mult': f"{current_mult:.2f}",
            'win': f"{win_amount:.2f}"
        }, broadcast=True)

        emit('balance_update', {'saldo': float(current_user.saldo)})
        
        # Notificación personal sutil
        emit('cashout_success', {'win': win_amount, 'mult': current_mult})