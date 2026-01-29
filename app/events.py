import time
from flask_login import current_user
from flask_socketio import emit
from . import socketio, db
from .games.crash import crash_engine # Importamos el motor

# --- EVENTO DE ENTRADA Y SINCRONIZACIÓN ---
@socketio.on('join_crash')
def handle_join_crash():
    """Envia TODO el estado actual al usuario que entra"""
    current_players = []
    user_active_bet = None

    # Recopilar lista de jugadores
    for user_id, info in crash_engine.bets.items():
        current_players.append({
            'username': info['username'],
            'amount': info['amount'],
            'avatar': info['avatar'],
            'cashed_out': info['cashed_out'],
            'win': (info['amount'] * crash_engine.multiplier) if info['cashed_out'] else 0,
            'mult': crash_engine.multiplier if info['cashed_out'] else 0
        })
        # Detectar si yo estoy jugando
        if current_user.is_authenticated and user_id == current_user.id:
            user_active_bet = info

    # Enviar paquete de sincronización
    emit('crash_sync', {
        'state': crash_engine.state,
        'multiplier': f"{crash_engine.multiplier:.2f}",
        'time_left': getattr(crash_engine, 'next_round_time', 0) - time.time(),
        'players': current_players,
        'my_bet': user_active_bet
    })

# --- EVENTO DE APOSTAR ---
@socketio.on('place_bet_crash')
def handle_place_bet(data):
    if not current_user.is_authenticated: return
    
    # 1. Validaciones
    if crash_engine.state not in ['IDLE', 'WAITING']: 
        return emit('error_msg', {'msg': 'Ronda en curso, espera.'})
    
    if current_user.id in crash_engine.bets: 
        return emit('error_msg', {'msg': 'Ya has apostado.'})

    try:
        amount = float(data.get('amount', 0))
    except:
        return emit('error_msg', {'msg': 'Cantidad inválida'})

    if amount <= 0 or amount > float(current_user.saldo): 
        return emit('error_msg', {'msg': 'Saldo insuficiente'})

    # 2. Transacción Base de Datos (Restar dinero)
    current_user.saldo = float(current_user.saldo) - amount
    db.session.commit()

    # 3. Registrar en Motor de Juego
    crash_engine.bets[current_user.id] = {
        'username': current_user.username,
        'amount': amount,
        'cashed_out': False,
        'avatar': current_user.avatar
    }

    # 4. Respuestas
    # Al usuario: Confirmar apuesta y actualizar saldo visual
    emit('bet_accepted', {
        'amount': amount, 
        'new_balance': float(current_user.saldo)
    })
    
    # A todos: Añadir a la tabla de jugadores
    emit('new_bet_crash', {
        'username': current_user.username, 
        'amount': amount, 
        'avatar': current_user.avatar
    }, broadcast=True)

# --- EVENTO DE RETIRAR ---
@socketio.on('cash_out_crash')
def handle_cash_out():
    if not current_user.is_authenticated: return
    if crash_engine.state != 'RUNNING': return # Solo se retira si vuela

    # Recuperar apuesta de memoria
    bet = crash_engine.bets.get(current_user.id)
    
    if bet and not bet['cashed_out']:
        # Calcular ganancia
        mult = crash_engine.multiplier
        win_amount = bet['amount'] * mult
        
        # 1. Actualizar Motor
        bet['cashed_out'] = True
        
        # 2. Transacción Base de Datos (Sumar ganancia)
        current_user.saldo = float(current_user.saldo) + win_amount
        db.session.commit()

        # 3. Respuestas
        # Al usuario: Notificación de victoria y saldo nuevo
        emit('cashout_success', {
            'win': win_amount, 
            'mult': mult, 
            'new_balance': float(current_user.saldo)
        })
        emit('balance_update', {'saldo': float(current_user.saldo)})
        
        # A todos: Marcar en verde en la tabla
        emit('player_cashed_out', {
            'username': current_user.username, 
            'mult': f"{mult:.2f}", 
            'win': f"{win_amount:.2f}"
        }, broadcast=True)