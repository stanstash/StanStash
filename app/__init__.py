import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from flask_mail import Mail
from flask_migrate import Migrate # ¡NUEVO!
from dotenv import load_dotenv

# Cargar variables del .env
load_dotenv()

# Inicializar extensiones (sin la app aún)
db = SQLAlchemy()
login_manager = LoginManager()
socketio = SocketIO()
mail = Mail()
migrate = Migrate()

def create_app():
    app = Flask(__name__)

    # Configuración desde .env
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Configuración Correo
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = ('Stanstash Security', os.getenv('MAIL_USERNAME'))
    
    # Configuración Uploads
    app.config['UPLOAD_FOLDER'] = os.path.join('app', 'static', 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Iniciar extensiones
    db.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)
    migrate.init_app(app, db) # Migraciones activadas
    socketio.init_app(app, cors_allowed_origins="*")

    # Registrar Blueprints (Las rutas)
    from .routes import auth, main, payments
    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(payments.bp)

    # Eventos de Socket (Chat)
    from . import events
    
    # Configurar Login Manager
    from .models import Usuario
    @login_manager.user_loader
    def load_user(user_id):
        return Usuario.query.get(int(user_id))

    return app