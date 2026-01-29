from app import create_app, socketio, db

app = create_app()

# --- IMPORTANTE: IMPORTAR EL MOTOR DEL JUEGO ---
from app.games.crash import crash_engine

def start_crash_game():
    """Función que arranca el bucle infinito del juego"""
    print(">>> MOTOR CRASH INICIADO <<<")
    crash_engine.start(app)

if __name__ == '__main__':
    # Crear tablas si no existen
    with app.app_context():
        db.create_all()
    
    print(">>> SERVIDOR LISTO: http://localhost:8080 <<<")
    
    # Arrancar el juego en segundo plano (Background Task)
    socketio.start_background_task(start_crash_game)
    
    # Iniciar servidor web
    socketio.run(app, host='0.0.0.0', port=8080, debug=True, allow_unsafe_werkzeug=True)