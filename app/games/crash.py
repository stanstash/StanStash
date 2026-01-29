import time
import random
from app import socketio

# Importamos utilidades de Provably Fair
from app.utils.fairness import generate_server_seed, get_game_result, calculate_crash_point

class CrashGame:
    def __init__(self):
        self.state = 'IDLE' # Estados: IDLE, WAITING, RUNNING, CRASHED
        self.multiplier = 1.00
        self.crash_point = 1.00
        self.start_time = 0
        self.bets = {} # Diccionario de apuestas de la ronda actual
        self.next_round_time = 0

    def start(self, app):
        """Bucle infinito del juego"""
        with app.app_context():
            while True:
                socketio.sleep(0.1) # Pausa técnica para no saturar CPU
                self.tick()

    def generate_round(self):
        """Calcula dónde va a explotar antes de empezar"""
        server_seed = generate_server_seed()
        client_seed = "00000000000000000002302302" # Semilla pública fija por ahora
        nonce = int(time.time())
        
        # Calculamos resultado matemático justo
        result = get_game_result(server_seed, client_seed, nonce)
        self.crash_point = calculate_crash_point(result)
        print(f"DEBUG: Ronda generada. Crash en {self.crash_point}x")

    def tick(self):
        current_time = time.time()

        # 1. ESTADO IDLE (Dormido esperando gente)
        if self.state == 'IDLE':
            # Si alguien apuesta, despertamos
            if len(self.bets) > 0:
                self.state = 'WAITING'
                self.next_round_time = current_time + 5 # 5 segundos de cuenta atrás
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': 5})
            else:
                # Latido lento para mantener UI
                if int(current_time) % 2 == 0:
                    socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

        # 2. ESTADO WAITING (Cuenta atrás)
        elif self.state == 'WAITING':
            time_left = self.next_round_time - current_time
            if time_left <= 0:
                self.generate_round()
                self.state = 'RUNNING'
                self.start_time = time.time()
                self.multiplier = 1.00
                socketio.emit('crash_start', {}) # ¡DESPEGUE!
            else:
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': round(time_left, 1)})
                socketio.sleep(0.1)

        # 3. ESTADO RUNNING (Subiendo)
        elif self.state == 'RUNNING':
            elapsed = current_time - self.start_time
            # Fórmula de crecimiento exponencial
            self.multiplier = 1.00 * (1.06 ** (elapsed * 2)) 
            
            if self.multiplier >= self.crash_point:
                self.multiplier = self.crash_point
                self.crash()
            else:
                # Enviamos el tick a todos los clientes
                socketio.emit('crash_tick', {'multiplier': float(f"{self.multiplier:.2f}")})

        # 4. ESTADO CRASHED (Explotado)
        elif self.state == 'CRASHED':
            socketio.sleep(3) # Mostrar resultado 3 segundos
            self.reset_game()

    def crash(self):
        self.state = 'CRASHED'
        socketio.emit('crash_boom', {'crash_point': self.crash_point})
        # Al explotar, limpiamos apuestas (los ganadores ya cobraron al retirar)
        self.bets = {}

    def reset_game(self):
        self.state = 'IDLE'
        self.multiplier = 1.00
        self.bets = {}
        socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

# Instancia única del juego
crash_engine = CrashGame()