from flask import Flask, render_template, request, jsonify

# Iniciamos la app. Le decimos que busque los HTML en 'templates'
# y el CSS/JS en 'static'
app = Flask(__name__)

# RUTA 1: La Portada
# Cuando alguien entra a "stanstash.org/", haz esto:
@app.route('/')
def home():
    # Flask busca 'index.html' DENTRO de la carpeta 'templates' automáticamente
    return render_template('index.html')

# RUTA 2: Una API para tu casino (Ejemplo)
# Cuando el JS pida saldo o apueste, viene aquí
@app.route('/api/apostar', methods=['POST'])
def apostar():
    datos = request.json
    apuesta = datos.get('cantidad')
    # Aquí iría tu lógica matemática de si gana o pierde
    return jsonify({'status': 'ok', 'mensaje': f'Has apostado {apuesta}'})

# Arrancar el servidor
if __name__ == '__main__':
    # host='0.0.0.0' permite que se vea desde fuera (internet/red local)
    # debug=True hace que si cambias código, se actualice solo sin reiniciar
    app.run(host='0.0.0.0', port=8080, debug=True)