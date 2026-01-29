from app import create_app, socketio, db

app = create_app()

# --- INICIO DEL JUEGO CRASH ---
from app.games.crash import crash_engine

def start_crash_game():
    # Arrancamos el juego en un proceso paralelo
    crash_engine.start(app)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    print(">>> SERVIDOR INICIADO <<<")
    
    # Iniciamos la tarea de fondo del juego
    socketio.start_background_task(start_crash_game)
    
    socketio.run(app, host='0.0.0.0', port=8080, debug=True, allow_unsafe_werkzeug=True)