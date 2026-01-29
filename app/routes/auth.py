import random
import string
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required
from sqlalchemy import or_
from flask_mail import Message
from .. import db, mail
from ..models import Usuario

# Creamos el Blueprint
bp = Blueprint('auth', __name__, url_prefix='/api')

@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    login_input = data.get('username')
    password = data.get('password')
    
    user = Usuario.query.filter(
        or_(Usuario.username == login_input, Usuario.email == login_input)
    ).first()
    
    if user and user.password == password:
        if not user.is_verified:
            return jsonify({'status': 'unverified', 'message': 'Cuenta no verificada', 'email': user.email})
        login_user(user)
        return jsonify({'status': 'success', 'user': user.username, 'saldo': float(user.saldo), 'avatar': user.avatar})
    
    return jsonify({'status': 'error', 'message': 'Credenciales incorrectas'})

@bp.route('/register', methods=['POST'])
def register():
    data = request.json
    if Usuario.query.filter_by(username=data.get('username')).first():
        return jsonify({'status': 'error', 'message': 'Usuario ocupado'})
    if Usuario.query.filter_by(email=data.get('email')).first():
        return jsonify({'status': 'error', 'message': 'Email ya registrado'})
    
    code = ''.join(random.choices(string.digits, k=6))
    
    new_user = Usuario(
        username=data.get('username'), password=data.get('password'),
        email=data.get('email'), telefono=data.get('telefono'),
        saldo=0.00, avatar='default.png', is_verified=False, verification_code=code
    )
    
    try:
        msg = Message("Código de Verificación", recipients=[data.get('email')])
        msg.body = f"Tu código de seguridad es: {code}"
        mail.send(msg)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'status': 'verify_needed', 'email': data.get('email')})
    except Exception as e:
        print(e)
        return jsonify({'status': 'error', 'message': 'Error enviando email'})

@bp.route('/verify_code', methods=['POST'])
def verify_code():
    data = request.json
    user = Usuario.query.filter_by(email=data.get('email')).first()
    if user and user.verification_code == data.get('code'):
        user.is_verified = True
        user.verification_code = None
        db.session.commit()
        login_user(user)
        return jsonify({'status': 'success', 'user': user.username, 'saldo': float(user.saldo), 'avatar': user.avatar})
    return jsonify({'status': 'error', 'message': 'Código incorrecto'})

@bp.route('/forgot_password', methods=['POST'])
def forgot_password():
    data = request.json
    user = Usuario.query.filter_by(email=data.get('email')).first()
    if not user: return jsonify({'status': 'error', 'message': 'Email no encontrado'})
    
    code = ''.join(random.choices(string.digits, k=6))
    user.verification_code = code
    db.session.commit()
    try:
        msg = Message("Recuperar Contraseña", recipients=[data.get('email')])
        msg.body = f"Tu código es: {code}"
        mail.send(msg)
        return jsonify({'status': 'success'})
    except:
        return jsonify({'status': 'error', 'message': 'Error enviando email'})

@bp.route('/reset_password_with_code', methods=['POST'])
def reset_password_with_code():
    data = request.json
    user = Usuario.query.filter_by(email=data.get('email')).first()
    if user and user.verification_code == data.get('code'):
        user.password = data.get('password')
        user.verification_code = None
        db.session.commit()
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Código incorrecto'})

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'})