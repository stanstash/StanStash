let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// --- SESIÓN ---
async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        if (data.logged_in) {
            loginSuccess(data.user);
            updateBalance();
        }
    } catch (e) { console.log("Modo invitado"); }
}

function loginSuccess(username) {
    currentUser = username;
    document.querySelector('.guest-view').classList.add('hidden');
    document.querySelector('.logged-view').classList.remove('hidden');
}

// --- BOTÓN CUENTA (NAV INFERIOR) ---
function handleProfileClick() {
    if (currentUser) {
        alert("Hola " + currentUser + ". Aquí iría tu perfil y ajustes.");
    } else {
        openModal('loginModal');
    }
}

// --- VALIDACIONES ---
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    // Solo números, entre 6 y 15 dígitos
    return /^[0-9]{6,15}$/.test(phone);
}

// --- REGISTRO ---
async function doRegister() {
    const user = document.getElementById('regUser').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const prefix = document.getElementById('regPrefix').value;
    const errorMsg = document.getElementById('regError');

    // Validar
    if (!user || !pass || !email || !phone) return showError(errorMsg, "Rellena todos los campos");
    if (!isValidEmail(email)) return showError(errorMsg, "Email inválido");
    if (!isValidPhone(phone)) return showError(errorMsg, "Teléfono inválido (solo números)");

    const fullPhone = prefix + phone;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: user, password: pass,
                email: email, telefono: fullPhone
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            closeModal('registerModal');
            loginSuccess(data.user);
            document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
            alert("¡Bienvenido! +100 Créditos Gratis");
        } else {
            showError(errorMsg, data.message);
        }
    } catch (e) { showError(errorMsg, "Error de conexión"); }
}

// --- LOGIN ---
async function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorMsg = document.getElementById('loginError');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();

        if (data.status === 'success') {
            closeModal('loginModal');
            loginSuccess(data.user);
            document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
        } else {
            showError(errorMsg, data.message);
        }
    } catch (e) { showError(errorMsg, "Error de conexión"); }
}

// --- UTILS ---
function showError(element, msg) {
    element.innerText = msg;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 3000);
}

function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Función para cambiar de uno a otro
function switchModal(fromId, toId) {
    document.getElementById(fromId).classList.add('hidden');
    document.getElementById(toId).classList.remove('hidden');
}

async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}