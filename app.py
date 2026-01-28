from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# CONEXIÓN A LA BBDD (Usuario root, sin contraseña, en localhost)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/casino_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Definimos la tabla para que Python la entienda
class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True)
    saldo = db.Column(db.Numeric(10, 2))

@app.route('/')
def home():
    return render_template('index.html')

# API: Consultar Saldo de prueba
@app.route('/api/saldo/<usuario>')
def get_saldo(usuario):
    # Busca en la BBDD
    user = Usuario.query.filter_by(username=usuario).first()
    if user:
        return jsonify({'status': 'ok', 'user': user.username, 'saldo': float(user.saldo)})
    return jsonify({'status': 'error', 'msg': 'Usuario no encontrado'})

if __name__ == '__main__':
    # Esto sustituye a tu comando anterior
    app.run(host='0.0.0.0', port=8080, debug=True)