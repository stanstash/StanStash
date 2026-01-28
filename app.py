from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime

app = Flask(__name__)

# CONFIGURACIÓN
app.config['SECRET_KEY'] = 'clave_secreta_super_segura' # Necesario para sesiones
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/casino_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

# --- MODELOS ---
class Usuario(UserMixin, db.Model): # UserMixin es necesario para Flask-Login
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    saldo = db.Column(db.Numeric(10, 2), default=0.00)

class Deposit(db.Model):
    __tablename__ = 'deposits'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    txid = db.Column(db.String(255))
    status = db.Column(db.String(20), default='pending')

@login_manager.user_loader
def load_user(user_id):
    return Usuario.query.get(int(user_id))

# --- RUTAS ---

@app.route('/')
def home():
    return render_template('index.html')

# API: Comprobar si ya está logueado al refrescar
@app.route('/api/check_session')
def check_session():
    if current_user.is_authenticated:
        return jsonify({'logged_in': True, 'user': current_user.username})
    return jsonify({'logged_in': False})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get('username')).first()
    
    if user and user.password == data.get('password'):
        login_user(user) # Esto crea la cookie de sesión mágica
        return jsonify({'status': 'success', 'user': user.username, 'saldo': float(user.saldo)})
    
    return jsonify({'status': 'error', 'message': 'Datos incorrectos'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({'status': 'error', 'message': 'Usuario ocupado'})
    
    # Regalamos 100 de saldo inicial para probar
    new_user = Usuario(username=data.get('username'), password=data.get('password'), saldo=100.00)
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user) # Auto-login al registrarse
    return jsonify({'status': 'success', 'user': new_user.username, 'saldo': 100.00})

@app.route('/api/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'})

@app.route('/api/balance')
@login_required
def get_balance():
    # Ahora ya no necesitamos pedir el username, Flask sabe quién es current_user
    return jsonify({'balance': float(current_user.saldo)})

@app.route('/api/deposit', methods=['POST'])
@login_required
def deposit():
    data = request.json
    new_dep = Deposit(user_id=current_user.id, txid=data.get('txid'))
    db.session.add(new_dep)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Recibido'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080, debug=True)