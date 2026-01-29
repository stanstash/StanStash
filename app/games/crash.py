import time
import random
from flask_socketio import emit
from app import socketio, db
from app.models import Usuario
from app.utils.fairness import generate_server_seed, get_game_result, calculate_crash_point

class CrashGame:
    def __init__(self):
        self.state = 'WAITING' # WAITING, RUNNING, CRASHED
        self.multiplier = 1.00
        self.crash_point = 1.00
        self.start_time = 0
        self.bets = {} # {user_id: {'amount': 10, 'cashed_out': False, 'username': 'Hec'}}
        self.next_round_time = 0

    def start(self, app):
        """Inicia el bucle infinito del juego en segundo plano"""
        with app.app_context():
            while True:
                socketio.sleep(0.1) # Pequeña pausa para no quemar la CPU
                self.tick()

    def generate_round(self):
        """Prepara la siguiente ronda usando Provably Fair"""
        # En un entorno real, usaríamos semillas reales de la DB. 
        # Simplificado para tutorial:
        server_seed = generate_server_seed()
        client_seed = "00000000000000000002302302" # Public seed
        nonce = int(time.time()) # Usamos tiempo como nonce simple
        
        result = get_game_result(server_seed, client_seed, nonce)
        self.crash_point = calculate_crash_point(result)
        
        print(f"DEBUG: Next Crash at {self.crash_point}x") # Para que lo veas en la consola

    def tick(self):
        current_time = time.time()

        # 1. ESTADO: ESPERANDO APUESTAS
        if self.state == 'WAITING':
            if current_time >= self.next_round_time:
                self.generate_round()
                self.state = 'RUNNING'
                self.start_time = time.time()
                self.multiplier = 1.00
                socketio.emit('crash_start', {'crash_point': 'HIDDEN'}) # Avisar que empieza

            else:
                # Cuenta atrás
                time_left =  self.next_round_time - current_time
                socketio.emit('crash_countdown', {'time_left': round(time_left, 1)})
                socketio.sleep(0.9) # Emitir cada segundo

        # 2. ESTADO: CORRIENDO (EL COHETE SUBE)
        elif self.state == 'RUNNING':
            # Fórmula de crecimiento exponencial típica de Crash
            # Multiplicador = 1.00 * e^(0.06 * tiempo_transcurrido)
            elapsed = current_time - self.start_time
            self.multiplier = 1.00 * (1.06 ** elapsed) # Velocidad ajustada
            
            # Chequear si explotamos
            if self.multiplier >= self.crash_point:
                self.multiplier = self.crash_point
                self.crash()
            else:
                socketio.emit('crash_tick', {'multiplier': float(f"{self.multiplier:.2f}")})

        # 3. ESTADO: EXPLOTADO
        elif self.state == 'CRASHED':
            # Esperar 3 segundos antes de reiniciar
            socketio.sleep(3)
            self.reset_game()

    def crash(self):
        self.state = 'CRASHED'
        socketio.emit('crash_boom', {'crash_point': self.crash_point})
        
        # Procesar perdedores (Limpiar lista de apuestas)
        # Los que retiraron ya se procesaron en tiempo real.
        # Los que quedan aquí, han perdido.
        self.bets = {} 

    def reset_game(self):
        self.state = 'WAITING'
        self.multiplier = 1.00
        self.bets = {}
        self.next_round_time = time.time() + 6 # 6 segundos para apostar

# Instancia global del juego
crash_engine = CrashGame()