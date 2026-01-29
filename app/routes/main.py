import os
import time
from flask import Blueprint, render_template, request, jsonify, current_app
from flask_login import current_user, login_required
from .. import db
from ..models import Usuario

# Nota: Este no tiene prefijo /api porque maneja la home '/'
bp = Blueprint('main', __name__)

@bp.route('/')
def home():
    return render_template('index.html')

@bp.route('/api/check_session')
def check_session():
    if current_user.is_authenticated:
        return jsonify({
            'logged_in': True,
            'user': current_user.username,
            'saldo': float(current_user.saldo),
            'avatar': current_user.avatar
        })
    return jsonify({'logged_in': False})

@bp.route('/api/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'file' not in request.files: return jsonify({'status': 'error'})
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error'})
    
    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext in ['png', 'jpg', 'jpeg', 'gif']:
        fname = f"user_{current_user.id}_{int(time.time())}.{ext}"
        # Usamos current_app para acceder a la config desde el blueprint
        file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], fname))
        
        current_user.avatar = fname
        db.session.commit()
        return jsonify({'status': 'success', 'avatar': fname})
    return jsonify({'status': 'error'})

@bp.route('/api/change_password', methods=['POST'])
@login_required
def change_password():
    data = request.json
    if current_user.password != data.get('current'):
        return jsonify({'status': 'error', 'message': 'Contraseña actual incorrecta'})
    current_user.password = data.get('new')
    db.session.commit()
    return jsonify({'status': 'success'})