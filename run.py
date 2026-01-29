from app import create_app, socketio, db

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Crea las tablas si no existen
    
    print(">>> SERVIDOR INICIADO EN MODO PROFESIONAL <<<")
    print(">>> http://localhost:8080")
    socketio.run(app, host='0.0.0.0', port=8080, debug=True, allow_unsafe_werkzeug=True)