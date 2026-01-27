// Variable de estado global
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// 1. CHEQUEAR SI ESTÁ LOGUEADO AL ENTRAR
async function checkSession() {
    try {
        // Petición a tu Flask para ver si hay sesión
        const response = await fetch('/api/check_session');
        const data = await response.json();
        
        if (data.logged_in) {
            currentUser = data.user;
            document.querySelector('.guest-view').classList.add('hidden');
            document.querySelector('.logged-view').classList.remove('hidden');
            updateBalance();
        }
    } catch (e) {
        console.log("Modo invitado");
    }
}

// 2. ACTUALIZAR SALDO (Llama a BBDD)
async function updateBalance() {
    const response = await fetch('/api/balance');
    const data = await response.json();
    document.getElementById('userBalance').innerText = data.balance.toFixed(2);
}

// 3. SISTEMA DE DEPÓSITO
async function confirmPayment() {
    const txid = document.getElementById('txidInput').value;
    if (!txid) return alert("Pega el ID de transacción primero");

    const response = await fetch('/api/deposit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ txid: txid, method: 'LTC' })
    });

    const result = await response.json();
    if (result.status === 'success') {
        alert("¡Depósito recibido! Esperando confirmación de red...");
        closeModal('depositModal');
    } else {
        alert("Error: " + result.message);
    }
}

// UTILS
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function copyAddress() {
    const copyText = document.getElementById("cryptoAddress");
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert("Dirección copiada: " + copyText.value);
}

function loadGame(gameName) {
    if (!currentUser) return alert("Debes iniciar sesión para jugar");
    // Aquí rediriges a la página del juego
    window.location.href = `/play/${gameName}`;
}