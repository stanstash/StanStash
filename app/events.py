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