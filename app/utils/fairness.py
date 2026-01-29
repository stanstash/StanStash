import hmac
import hashlib
import secrets

def generate_server_seed():
    """Genera una cadena aleatoria segura de 64 caracteres (hex)."""
    return secrets.token_hex(32)

def get_game_result(server_seed, client_seed, nonce):
    """
    Calcula el resultado determinista basado en HMAC-SHA256.
    Devuelve un número flotante entre 0 y 1.
    """
    # Combinamos: ServerSeed + ClientSeed + Nonce
    message = f"{client_seed}:{nonce}"
    
    # Creamos el Hash HMAC-SHA256
    hmac_obj = hmac.new(
        key=server_seed.encode(),
        msg=message.encode(),
        digestmod=hashlib.sha256
    )
    hex_hash = hmac_obj.hexdigest()
    
    # Tomamos los primeros 8 caracteres (32 bits) para calcular el número
    # Esto convierte el hash hexadecimal en un número decimal
    decimal_number = int(hex_hash[:8], 16)
    
    # El máximo valor posible de 8 caracteres hex es 4294967295 (0xFFFFFFFF)
    # Dividimos para obtener un número entre 0.0 y 1.0
    return decimal_number / 0xFFFFFFFF

def calculate_crash_point(float_result):
    """
    Convierte el float (0-1) en un multiplicador de Crash.
    La fórmula estándar es: 0.99 / (1 - float_result)
    """
    # House Edge (Ventaja de la casa) del 1% -> 0.99
    house_edge = 0.99
    
    multiplier = house_edge / (1 - float_result)
    
    # Redondeamos a 2 decimales y máximo 1000x (o lo que quieras)
    multiplier = int(multiplier * 100) / 100.0
    
    # En Crash, si el cálculo da menos de 1.00, explota instantáneo (1.00)
    return max(1.00, multiplier)