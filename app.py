import os
from flask import Flask, render_template, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.utils import secure_filename
import time

app = Flask(__name__)

# --- CONFIGURACIÓN ---
app.config['SECRET_KEY'] = 'clave_secreta_super_segura'
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/casino_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Configuración de subida de imágenes
UPLOAD_FOLDER = os.path.join('static', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Max 16MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Crear carpeta de uploads si no existe
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- MODELOS ---
class Usuario(UserMixin, db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    telefono = db.Column(db.String(30), nullable=False)
    saldo = db.Column(db.Numeric(10, 2), default=0.00)
    # NUEVOS CAMPOS PERFIL
    biografia = db.Column(db.Text, nullable=True)
    avatar = db.Column(db.String(200), default='default.png')

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
def home(): return render_template('index.html')

# ARREGLADO: Ahora devuelve el saldo y el avatar al recargar
@app.route('/api/check_session')
def check_session():
    if current_user.is_authenticated:
        return jsonify({
            'logged_in': True,
            'user': current_user.username,
            'saldo': float(current_user.saldo),
            'avatar': current_user.avatar,
            'bio': current_user.biografia or "Sin biografía..."
        })
    return jsonify({'logged_in': False})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data.get('username')).first()
    if user and user.password == data.get('password'):
        login_user(user)
        return jsonify({
            'status': 'success',
            'user': user.username,
            'saldo': float(user.saldo),
            'avatar': user.avatar
        })
    return jsonify({'status': 'error', 'message': 'Datos incorrectos'})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({'status': 'error', 'message': 'Usuario ocupado'})
    
    new_user = Usuario(
        username=data.get('username'), password=data.get('password'),
        email=data.get('email'), telefono=data.get('telefono'),
        saldo=100.00, avatar='default.png'
    )
    db.session.add(new_user)
    db.session.commit()
    login_user(new_user)
    return jsonify({'status': 'success', 'user': new_user.username, 'saldo': 100.00})

# --- RUTAS DE PERFIL ---

@app.route('/api/update_bio', methods=['POST'])
@login_required
def update_bio():
    data = request.json
    current_user.biografia = data.get('bio')
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'file' not in request.files: return jsonify({'status': 'error', 'message': 'No hay archivo'})
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error', 'message': 'Nombre vacío'})
    
    if file and allowed_file(file.filename):
        # Nombre único para evitar caché: usuarioID_timestamp.jpg
        ext = file.filename.rsplit('.', 1)[1].lower()
        new_filename = f"user_{current_user.id}_{int(time.time())}.{ext}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], new_filename))
        
        # Guardar en BBDD
        current_user.avatar = new_filename
        db.session.commit()
        
        return jsonify({'status': 'success', 'avatar': new_filename})
    
    return jsonify({'status': 'error', 'message': 'Formato no permitido'})

@app.route('/api/balance')
@login_required
def get_balance():
    return jsonify({'balance': float(current_user.saldo)})

@app.route('/api/deposit', methods=['POST'])
@login_required
def deposit():
    data = request.json
    new_dep = Deposit(user_id=current_user.id, txid=data.get('txid'))
    db.session.add(new_dep)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Recibido'})

@app.route('/api/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080, debug=True)