import os
import time
import requests # Necesario: pip install requests
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user

app = Flask(__name__)

# --- CONFIGURACIÓN ---
app.config['SECRET_KEY'] = 'clave_maestra_casino_v15'
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/casino_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# API KEY DE NOWPAYMENTS (Déjala así para el modo simulación)
NOWPAYMENTS_API_KEY = "2ZKWMQA-2M4M88Y-J1RFBH0-F0MHHCX"
MODO_SIMULACION = True # Ponlo en False cuando tengas la API Key real

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

# --- MODELOS ---
class Usuario(UserMixin, db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    telefono = db.Column(db.String(30), nullable=True)
    saldo = db.Column(db.Numeric(10, 2), default=0.00)
    avatar = db.Column(db.String(200), default='default.png')

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    payment_id = db.Column(db.String(100), unique=True) # ID de NowPayments
    amount = db.Column(db.Float)
    currency = db.Column(db.String(10))
    address = db.Column(db.String(200))
    status = db.Column(db.String(20), default='waiting') # waiting, finished
    created_at = db.Column(db.Integer, default=int(time.time()))

@login_manager.user_loader
def load_user(user_id):
    return Usuario.query.get(int(user_id))

# --- RUTAS BASE ---
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

# --- RUTAS DE PAGO (NOWPAYMENTS) ---

@app.route('/api/create_payment', methods=['POST'])
@login_required
def create_payment():
    data = request.json
    amount = float(data.get('amount'))
    currency = data.get('currency', 'btc') # btc, ltc, eth...

    if amount < 10:
        return jsonify({'status': 'error', 'message': 'Mínimo 10 USD'})

    # 1. MODO SIMULACIÓN (Para que pruebes ya)
    if MODO_SIMULACION:
        fake_id = f"PAY_{int(time.time())}"
        fake_address = f"bc1qxy2kgdygjrv{int(time.time())}xhuz" # Dirección falsa
        
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
            'pay_amount': amount, # En real sería convertido a crypto
            'pay_currency': currency
        })

    # 2. MODO REAL (Cuando tengas la API Key)
    # headers = {'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json'}
    # body = {'price_amount': amount, 'price_currency': 'usd', 'pay_currency': currency}
    # r = requests.post('https://api.nowpayments.io/v1/payment', json=body, headers=headers)
    # ... lógica real ...

@app.route('/api/check_status', methods=['POST'])
@login_required
def check_status():
    pay_id = request.json.get('payment_id')
    payment = Payment.query.filter_by(payment_id=pay_id).first()
    
    if not payment:
        return jsonify({'status': 'error'})

    # SI YA ESTÁ PAGADO, NO HACEMOS NADA
    if payment.status == 'finished':
        return jsonify({'payment_status': 'finished'})

    # LÓGICA DE SIMULACIÓN: APROBAR A LOS 10 SEGUNDOS
    if MODO_SIMULACION:
        tiempo_pasado = int(time.time()) - payment.created_at
        if tiempo_pasado > 8: # A los 8 segundos simula que llega el dinero
            payment.status = 'finished'
            # SUMAR SALDO AL USUARIO
            user = Usuario.query.get(payment.user_id)
            user.saldo = float(user.saldo) + payment.amount
            db.session.commit()
            return jsonify({'payment_status': 'finished'})
        else:
            return jsonify({'payment_status': 'waiting'})

    # AQUÍ IRÍA LA LLAMADA REAL A LA API DE NOWPAYMENTS PARA CONSULTAR ESTADO
    return jsonify({'payment_status': 'waiting'})


# --- RUTAS LOGIN/REGISTRO/PERFIL ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get('username')).first()
    if user and user.password == data.get('password'):
        login_user(user)
        return jsonify({'status': 'success', 'user': user.username, 'saldo': float(user.saldo), 'avatar': user.avatar})
    return jsonify({'status': 'error', 'message': 'Incorrecto'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({'status': 'error', 'message': 'Usuario ocupado'})
    
    new_user = Usuario(
        username=data.get('username'), password=data.get('password'),
        email=data.get('email'), telefono=data.get('telefono'),
        saldo=0.00, avatar='default.png' # Empezamos con 0 para probar los depósitos
    )
    db.session.add(new_user)
    db.session.commit()
    login_user(new_user)
    return jsonify({'status': 'success', 'user': new_user.username, 'saldo': 0.00})

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

@app.route('/api/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'})

@app.route('/api/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    if current_user.password != data.get('current'): return jsonify({'status': 'error', 'message': 'Pass actual mal'})
    current_user.password = data.get('new')
    db.session.commit()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080, debug=True)