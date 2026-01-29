import time
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from .. import db
from ..models import Payment, Usuario

bp = Blueprint('payments', __name__, url_prefix='/api')

@bp.route('/create_payment', methods=['POST'])
@login_required
def create_payment():
    data = request.json
    amount = float(data.get('amount'))
    currency = data.get('currency', 'btc')

    if amount < 10:
        return jsonify({'status': 'error', 'message': 'Mínimo 10 USD'})

    ts = int(time.time())
    fake_address = f"bc1q{ts}..." # Default
    if currency == 'eth': fake_address = f"0x71C{ts}..."
    elif currency == 'sol': fake_address = f"Hu{ts}WKz..."
    elif currency == 'trx' or currency == 'usdt': fake_address = f"TJ{ts}kz..."
    elif currency == 'ltc': fake_address = f"ltc1{ts}..."
    elif currency == 'doge': fake_address = f"D{ts}..."
    elif currency == 'xrp': fake_address = f"r{ts}..."

    fake_id = f"PAY_{currency.upper()}_{ts}"

    new_pay = Payment(
        user_id=current_user.id, payment_id=fake_id, amount=amount,
        currency=currency, address=fake_address, status='waiting'
    )
    db.session.add(new_pay)
    db.session.commit()
    
    return jsonify({
        'status': 'success', 'payment_id': fake_id,
        'pay_address': fake_address, 'pay_amount': amount, 'pay_currency': currency
    })

@bp.route('/check_status', methods=['POST'])
@login_required
def check_status():
    pay_id = request.json.get('payment_id')
    payment = Payment.query.filter_by(payment_id=pay_id).first()
    
    if not payment or payment.status == 'finished':
        return jsonify({'payment_status': 'finished'})

    # Simulación: Aprobar tras 5s
    if (int(time.time()) - payment.created_at) > 5:
        payment.status = 'finished'
        user = Usuario.query.get(payment.user_id)
        user.saldo = float(user.saldo) + payment.amount
        db.session.commit()
        return jsonify({'payment_status': 'finished'})
    
    return jsonify({'payment_status': 'waiting'})

@bp.route('/deposit', methods=['POST'])
@login_required
def deposit(): return jsonify({'status': 'success'})