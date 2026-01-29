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
        self.history = [] # <--- NUEVO: Lista para el historial

    def start(self, app):
        with app.app_context():
            while True:
                socketio.sleep(0.1)
                self.tick()

    def generate_round(self):
        server_seed = generate_server_seed()
        client_seed = "00000000000000000002302302"
        nonce = int(time.time())
        result = get_game_result(server_seed, client_seed, nonce)
        self.crash_point = calculate_crash_point(result)

    def tick(self):
        current_time = time.time()

        if self.state == 'IDLE':
            if len(self.bets) > 0:
                self.state = 'WAITING'
                self.next_round_time = current_time + 15
                socketio.emit('crash_status', {'status': 'WAITING', 'time_left': 15})
            else:
                if int(current_time * 10) % 10 == 0:
                    socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

        elif self.state == 'WAITING':
            time_left = self.next_round_time - current_time
            socketio.emit('crash_status', {'status': 'WAITING', 'time_left': round(time_left, 1)})
            
            if time_left <= 0:
                self.generate_round()
                self.state = 'RUNNING'
                self.start_time = time.time()
                self.multiplier = 1.00
                socketio.emit('crash_start', {})
            else:
                socketio.sleep(0.1)

        elif self.state == 'RUNNING':
            elapsed = current_time - self.start_time
            self.multiplier = 1.00 * (1.06 ** (elapsed * 2))
            
            if self.multiplier >= self.crash_point:
                self.multiplier = self.crash_point
                self.crash()
            else:
                socketio.emit('crash_tick', {'multiplier': float(f"{self.multiplier:.2f}")})

        elif self.state == 'CRASHED':
            socketio.sleep(3)
            self.reset_game()

    def crash(self):
        self.state = 'CRASHED'
        
        # --- NUEVO: GUARDAR EN HISTORIAL ---
        self.history.insert(0, self.crash_point) # Insertar al principio
        if len(self.history) > 20: # Mantener solo 20
            self.history.pop()
            
        socketio.emit('crash_boom', {
            'crash_point': self.crash_point,
            'history': self.history # Enviamos el historial actualizado
        })
        # -----------------------------------
    
    def reset_game(self):
        self.state = 'IDLE'
        self.multiplier = 1.00
        self.bets = {}
        socketio.emit('crash_status', {'status': 'IDLE', 'time_left': 0})

crash_engine = CrashGame()