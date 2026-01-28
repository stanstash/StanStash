let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// --- SESIÓN Y NAVEGACIÓN ---

async function checkSession() {
    try {
        const response = await fetch('/api/check_session');
        const data = await response.json();
        
        if (data.logged_in) {
            loginSuccess(data.user);
            updateBalance();
        }
    } catch (e) { console.log("Invitado"); }
}

function loginSuccess(username) {
    currentUser = username;
    document.querySelector('.guest-view').classList.add('hidden');
    document.querySelector('.logged-view').classList.remove('hidden');
}

async function updateBalance() {
    const res = await fetch('/api/balance');
    const data = await res.json();
    document.getElementById('userBalance').innerText = data.balance.toFixed(2);
}

// --- ACCIONES DE USUARIO ---

async function doLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();

    if(data.status === 'success') {
        loginSuccess(data.user);
        document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
        closeModal('loginModal');
    } else {
        alert(data.message);
    }
}

async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;

    if(!user || !pass) return alert("Rellena todo");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();

    if(data.status === 'success') {
        alert("¡Bienvenido! Tienes 100 créditos de regalo.");
        loginSuccess(data.user);
        document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
        closeModal('registerModal');
    } else {
        alert(data.message);
    }
}

async function doLogout() {
    await fetch('/api/logout');
    location.reload();
}

// --- PAGOS ---

async function confirmPayment() {
    const txid = document.getElementById('txidInput').value;
    if (!txid) return alert("Falta el TXID");

    const res = await fetch('/api/deposit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ txid: txid })
    });
    const data = await res.json();
    
    if(data.status === 'success') {
        alert("Depósito registrado. Espera confirmación del admin.");
        closeModal('depositModal');
    }
}

// --- UTILS ---
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }