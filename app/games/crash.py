import time
import random
from flask_socketio import emit
from app import socketio, db

# Importamos lo necesario para cálculo justo
from app.utils.fairness import generate_server_seed, get_game_result, calculate_crash_point

class CrashGame:
    def __init__(self):
        self.state = 'IDLE' # IDLE (Dormido), WAITING (Cuenta atrás), RUNNING (Subiendo), CRASHED (Explotado)
        self.multiplier = 1.00
        self.crash_point = 1.00
        self.start_time = 0
        self.bets = {} 
        self.next_round_time = 0

    def start(self, app):
        with app.app_context():
            while True:
                socketio.sleep(0.1)
                self.tick()

    def generate_round(self):
        # Generar punto de explosión (Provably Fair simplificado)
        server_seed = generate_server_seed()
        client_seed = "00000000000000000002302302"
        nonce = int(time.time())
        result = get_game_result(server_seed, client_seed, nonce)
        self.crash_point = calculate_crash_point(result)
        print(f"DEBUG: Crash Point: {self.crash_point}x")

    def tick(self):
        current_time = time.time()

        # 1. ESTADO: DORMIDO (ESPERANDO JUGADORES)
        if self.state == 'IDLE':
            # Si hay alguien en la lista de apuestas, despertamos
            if len(self.bets) > 0:
                self.state = 'WAITING'
                self.next_round_time = current_time + 5 # 5 segundos de cuenta atrás
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': 5})
            else:
                # Enviamos heartbeat lento para mantener la UI sincronizada
                if int(current_time) % 2 == 0: # Cada 2 segs
                    socketio.emit('crash_status', {'status': 'IDLE'})

        # 2. ESTADO: CUENTA ATRÁS
        elif self.state == 'WAITING':
            time_left = self.next_round_time - current_time
            if time_left <= 0:
                self.generate_round()
                self.state = 'RUNNING'
                self.start_time = time.time()
                self.multiplier = 1.00
                socketio.emit('crash_start', {})
            else:
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': round(time_left, 1)})
                socketio.sleep(0.1)

        # 3. ESTADO: SUBIENDO
        elif self.state == 'RUNNING':
            elapsed = current_time - self.start_time
            self.multiplier = 1.00 * (1.06 ** (elapsed * 2)) # Ajuste de velocidad
            
            if self.multiplier >= self.crash_point:
                self.multiplier = self.crash_point
                self.crash()
            else:
                socketio.emit('crash_tick', {'multiplier': float(f"{self.multiplier:.2f}")})

        # 4. ESTADO: EXPLOTADO
        elif self.state == 'CRASHED':
            socketio.sleep(3) # Ver el resultado 3 segundos
            self.reset_game()

    def crash(self):
        self.state = 'CRASHED'
        socketio.emit('crash_boom', {'crash_point': self.crash_point})
        
        # Limpiar apuestas de perdedores de la memoria
        # (Los ganadores se procesaron en tiempo real al retirar)
        self.bets = {}

    def reset_game(self):
        # Volvemos a IDLE para esperar nuevas apuestas
        self.state = 'IDLE'
        self.multiplier = 1.00
        self.bets = {}
        socketio.emit('crash_status', {'status': 'IDLE'})

crash_engine = CrashGame()