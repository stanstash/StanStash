import os
import time
import random
import string
import requests
# Librerías necesarias: pip install flask flask-sqlalchemy flask-login flask-socketio flask-mail requests
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message

app = Flask(__name__)

# ====================================================
# CONFIGURACIÓN DEL CORREO (GMAIL)
# ====================================================
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'TU_EMAIL@gmail.com'      # <--- PON TU GMAIL
app.config['MAIL_PASSWORD'] = 'TU_CLAVE_DE_APLICACION'  # <--- PON TU CLAVE DE APP (16 letras)
app.config['MAIL_DEFAULT_SENDER'] = ('Seguridad Stanstash', app.config['MAIL_USERNAME'])

mail = Mail(app)

# ====================================================
# CONFIGURACIÓN GENERAL
# ====================================================
app.config['SECRET_KEY'] = 'clave_maestra_super_segura_v20'
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/casino_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB Max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

# Inicializamos SocketIO para el chat
socketio = SocketIO(app, cors_allowed_origins="*")

# ====================================================
# MODELOS DE BASE DE DATOS
# ====================================================

class Usuario(UserMixin, db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    telefono = db.Column(db.String(30), nullable=True)
    saldo = db.Column(db.Numeric(10, 2), default=0.00)
    avatar = db.Column(db.String(200), default='default.png')
    
    # Sistema de Verificación
    is_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(6), nullable=True)

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    payment_id = db.Column(db.String(100), unique=True) # ID de la pasarela
    amount = db.Column(db.Float)
    currency = db.Column(db.String(10))
    address = db.Column(db.String(200))
    status = db.Column(db.String(20), default='waiting')
    created_at = db.Column(db.Integer, default=int(time.time()))

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    username = db.Column(db.String(50))
    message = db.Column(db.String(500))
    timestamp = db.Column(db.Integer, default=int(time.time()))
    # Relación para obtener el avatar actualizado del usuario
    user = db.relationship('Usuario', backref='messages')

@login_manager.user_loader
def load_user(user_id):
    return Usuario.query.get(int(user_id))

# ====================================================
# RUTAS: AUTENTICACIÓN Y REGISTRO
# ====================================================

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get('username')).first()
    
    if user and user.password == data.get('password'):
        # Comprobar si verificó el email
        if not user.is_verified:
            return jsonify({
                'status': 'unverified',
                'message': 'Cuenta no verificada',
                'email': user.email
            })
            
        login_user(user)
        return jsonify({
            'status': 'success',
            'user': user.username,
            'saldo': float(user.saldo),
            'avatar': user.avatar
        })
    
    return jsonify({'status': 'error', 'message': 'Usuario o contraseña incorrectos'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    # Validaciones básicas
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({'status': 'error', 'message': 'El usuario ya existe'})
    if Usuario.query.filter_by(email=data.get('email')).first():
        return jsonify({'status': 'error', 'message': 'El email ya está registrado'})
    
    # Generar código de 6 dígitos
    code = ''.join(random.choices(string.digits, k=6))
    
    new_user = Usuario(
        username=data.get('username'),
        password=data.get('password'),
        email=data.get('email'),
        telefono=data.get('telefono'),
        saldo=0.00,
        avatar='default.png',
        is_verified=False,
        verification_code=code
    )
    
    try:
        # Enviar Email
        msg = Message("Código de Verificación - Stanstash", recipients=[data.get('email')])
        msg.body = f"Bienvenido a Stanstash.\n\nTu código de seguridad es: {code}\n\nNo lo compartas con nadie."
        mail.send(msg)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'status': 'verify_needed', 'email': data.get('email')})
        
    except Exception as e:
        print(f"Error enviando email: {e}")
        return jsonify({'status': 'error', 'message': 'Error al enviar el email. Verifica que sea real.'})

@app.route('/api/verify_code', methods=['POST'])
def verify_code():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    user = Usuario.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'status': 'error', 'message': 'Usuario no encontrado'})
        
    if user.verification_code == code:
        user.is_verified = True
        user.verification_code = None # Limpiamos el código por seguridad
        db.session.commit()
        login_user(user) # Iniciar sesión automáticamente
        return jsonify({'status': 'success', 'user': user.username, 'saldo': float(user.saldo), 'avatar': user.avatar})
    else:
        return jsonify({'status': 'error', 'message': 'Código incorrecto'})

# ====================================================
# RUTAS DE LA APP (VISTAS)
# ====================================================

@app.route('/')
def home(): return render_template('index.html')

@app.route('/api/check_session')
def check_session():
    if current_user.is_authenticated:
        return jsonify({
            'logged_in': True,
            'user': current_user.username,
            'saldo': float(current_user.saldo),
            'avatar': current_user.avatar
        })
    return jsonify({'logged_in': False})

@app.route('/api/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'})

# ====================================================
# LÓGICA DEL CHAT (WEBSOCKETS)
# ====================================================

@socketio.on('connect')
def handle_connect():
    # Enviar los últimos 50 mensajes al conectar
    messages = ChatMessage.query.order_by(ChatMessage.timestamp.desc()).limit(50).all()
    
    for msg in reversed(messages):
        # Obtener avatar actualizado
        avatar = msg.user.avatar if msg.user else 'default.png'
        
        emit('new_message', {
            'username': msg.username,
            'message': msg.message,
            'avatar': avatar,
            'timestamp': msg.timestamp
        })

@socketio.on('send_message')
def handle_send_message(data):
    if not current_user.is_authenticated: return
    
    msg_text = data.get('message', '').strip()
    if not msg_text or len(msg_text) > 500: return # Anti-spam básico

    # Guardar mensaje
    new_msg = ChatMessage(user_id=current_user.id, username=current_user.username, message=msg_text)
    db.session.add(new_msg)
    db.session.commit()

    # Retransmitir a todos
    emit('new_message', {
        'username': current_user.username,
        'message': msg_text,
        'avatar': current_user.avatar,
        'timestamp': int(time.time())
    }, broadcast=True)

# ====================================================
# SISTEMA DE PAGOS (NOWPAYMENTS - SIMULACIÓN)
# ====================================================

@app.route('/api/create_payment', methods=['POST'])
@login_required
def create_payment():
    data = request.json
    amount = float(data.get('amount'))
    currency = data.get('currency', 'btc')

    if amount < 10:
        return jsonify({'status': 'error', 'message': 'El depósito mínimo es de 10 USD'})

    # Generación de dirección realista para la simulación
    ts = int(time.time())
    fake_address = f"bc1q{ts}..." # Default BTC
    
    if currency == 'eth': fake_address = f"0x71C{ts}E9A2..."
    elif currency == 'sol': fake_address = f"Hu{ts}WKz9M..."
    elif currency == 'trx' or currency == 'usdt': fake_address = f"TJ{ts}kz..."
    elif currency == 'ltc': fake_address = f"ltc1{ts}..."
    elif currency == 'doge': fake_address = f"D{ts}..."
    elif currency == 'xrp': fake_address = f"r{ts}..."

    fake_id = f"PAY_{currency.upper()}_{ts}"

    new_pay = Payment(
        user_id=current_user.id,
        payment_id=fake_id,
        amount=amount,
        currency=currency,
        address=fake_address,
        status='waiting'
    )
    db.session.add(new_pay)
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'payment_id': fake_id,
        'pay_address': fake_address,
        'pay_amount': amount,
        'pay_currency': currency
    })

@app.route('/api/check_status', methods=['POST'])
@login_required
def check_status():
    pay_id = request.json.get('payment_id')
    payment = Payment.query.filter_by(payment_id=pay_id).first()
    
    if not payment or payment.status == 'finished':
        return jsonify({'payment_status': 'finished'})

    # Simulación: Aprobar automáticamente tras 5 segundos
    if (int(time.time()) - payment.created_at) > 5:
        payment.status = 'finished'
        user = Usuario.query.get(payment.user_id)
        user.saldo = float(user.saldo) + payment.amount
        db.session.commit()
        return jsonify({'payment_status': 'finished'})
    
    return jsonify({'payment_status': 'waiting'})

@app.route('/api/deposit', methods=['POST']) # Ruta legacy por seguridad
@login_required
def deposit(): return jsonify({'status': 'success'})

# ====================================================
# PERFIL Y OTROS
# ====================================================

@app.route('/api/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'file' not in request.files: return jsonify({'status': 'error'})
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error'})
    
    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext in ['png', 'jpg', 'jpeg', 'gif']:
        fname = f"user_{current_user.id}_{int(time.time())}.{ext}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
        current_user.avatar = fname
        db.session.commit()
        return jsonify({'status': 'success', 'avatar': fname})
    return jsonify({'status': 'error'})

@app.route('/api/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    if current_user.password != data.get('current'):
        return jsonify({'status': 'error', 'message': 'La contraseña actual es incorrecta'})
    
    current_user.password = data.get('new')
    db.session.commit()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    # Usamos socketio.run para que funcione el chat
    socketio.run(app, host='0.0.0.0', port=8080, debug=True, allow_unsafe_werkzeug=True)