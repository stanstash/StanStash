import time
from app import socketio
from app.utils.fairness import generate_server_seed, get_game_result, calculate_crash_point

class CrashGame:
    def __init__(self):
        self.state = 'IDLE' 
        self.multiplier = 1.00
        self.crash_point = 1.00
        self.start_time = 0
        self.bets = {}
        self.next_round_time = 0

    def start(self, app):
        with app.app_context():
            while True:
                socketio.sleep(0.1) # 10 FPS
                self.tick()

    def generate_round(self):
        server_seed = generate_server_seed()
        client_seed = "00000000000000000002302302"
        nonce = int(time.time())
        result = get_game_result(server_seed, client_seed, nonce)
        self.crash_point = calculate_crash_point(result)

    def tick(self):
        current_time = time.time()

        # 1. IDLE (Esperando gente)
        if self.state == 'IDLE':
            if len(self.bets) > 0:
                self.state = 'WAITING'
                self.next_round_time = current_time + 15 # 15 Segundos
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': 15})
            else:
                if int(current_time) % 2 == 0:
                    socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

        # 2. WAITING (Cuenta Atrás)
        elif self.state == 'WAITING':
            time_left = self.next_round_time - current_time
            
            # Emitir SIEMPRE el tiempo restante
            socketio.emit('crash_status', {'status': 'WAITING', 'time_left': round(time_left, 1)})
            
            if time_left <= 0:
                self.generate_round()
                self.state = 'RUNNING'
                self.start_time = time.time()
                self.multiplier = 1.00
                socketio.emit('crash_start', {})
            else:
                socketio.sleep(0.5) # Emitir cada medio segundo para no saturar

        # 3. RUNNING (Juego)
        elif self.state == 'RUNNING':
            elapsed = current_time - self.start_time
            self.multiplier = 1.00 * (1.06 ** (elapsed * 2))
            
            if self.multiplier >= self.crash_point:
                self.multiplier = self.crash_point
                self.crash()
            else:
                socketio.emit('crash_tick', {'multiplier': float(f"{self.multiplier:.2f}")})

        # 4. CRASHED (Fin)
        elif self.state == 'CRASHED':
            socketio.sleep(4)
            self.reset_game()

    def crash(self):
        self.state = 'CRASHED'
        socketio.emit('crash_boom', {'crash_point': self.crash_point})
    
    def reset_game(self):
        self.state = 'IDLE'
        self.multiplier = 1.00
        self.bets = {}
        socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

crash_engine = CrashGame()