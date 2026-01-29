import time
from . import db
from flask_login import UserMixin

class Usuario(UserMixin, db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    telefono = db.Column(db.String(30), nullable=True)
    saldo = db.Column(db.Numeric(10, 2), default=0.00)
    avatar = db.Column(db.String(200), default='default.png')
    is_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(6), nullable=True)

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    payment_id = db.Column(db.String(100), unique=True)
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
    user = db.relationship('Usuario', backref='messages')