let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Javascript cargado correctamente");
    checkSession();
});

// --- FUNCIONES DE SESIÓN ---

async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        if (data.logged_in) {
            console.log("Sesión encontrada:", data.user);
            loginSuccess(data.user);
            updateBalance();
        }
    } catch (e) {
        console.log("Usuario no logueado");
    }
}

// --- REGISTRO (CON DEBUG) ---
async function doRegister() {
    console.log("Botón Registro pulsado...");
    
    // 1. Obtener elementos
    const userInput = document.getElementById('regUser');
    const passInput = document.getElementById('regPass');
    const errorMsg = document.getElementById('regError');

    // 2. Validar que existen en el HTML (Evita que no haga nada)
    if (!userInput || !passInput) {
        alert("ERROR CRÍTICO: No encuentro los inputs 'regUser' o 'regPass' en el HTML.");
        return;
    }

    const user = userInput.value;
    const pass = passInput.value;

    if (!user || !pass) {
        errorMsg.innerText = "Por favor, rellena todos los campos.";
        errorMsg.style.display = "block";
        return;
    }

    // 3. Enviar al servidor
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        
        const data = await res.json();
        console.log("Respuesta servidor:", data);

        if (data.status === 'success') {
            alert("✅ ¡CUENTA CREADA CON ÉXITO!\nTe hemos regalado 100 créditos.");
            loginSuccess(data.user);
            document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
            closeModal('registerModal');
            // Limpiar formulario
            userInput.value = '';
            passInput.value = '';
        } else {
            errorMsg.innerText = "Error: " + data.message;
            errorMsg.style.display = "block";
        }
    } catch (error) {
        console.error("Error de red:", error);
        alert("Error de conexión con el servidor (Python). Mira la consola.");
    }
}

// --- LOGIN (CON DEBUG) ---
async function doLogin() {
    console.log("Botón Login pulsado...");

    const userInput = document.getElementById('loginUser');
    const passInput = document.getElementById('loginPass');
    const errorMsg = document.getElementById('loginError');

    if (!userInput || !passInput) {
        alert("ERROR: Faltan inputs de login.");
        return;
    }

    const user = userInput.value;
    const pass = passInput.value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        
        const data = await res.json();

        if (data.status === 'success') {
            // LOGIN CORRECTO
            loginSuccess(data.user);
            document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
            closeModal('loginModal');
            userInput.value = '';
            passInput.value = '';
        } else {
            // LOGIN FALLIDO
            errorMsg.innerText = data.message;
            errorMsg.style.display = "block";
            // Efecto visual de vibración si quieres
            userInput.style.borderColor = "red";
        }
    } catch (error) {
        console.error(error);
        alert("Error al conectar con el servidor.");
    }
}

// --- UTILS ---
function loginSuccess(username) {
    currentUser = username;
    document.querySelector('.guest-view').classList.add('hidden');
    document.querySelector('.logged-view').classList.remove('hidden');
}

async function updateBalance() {
    const res = await fetch('/api/balance');
    const data = await res.json();
    if(data.balance !== undefined) {
        document.getElementById('userBalance').innerText = data.balance.toFixed(2);
    }
}

async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}

function openModal(id) { 
    document.getElementById(id).classList.remove('hidden');
    // Limpiar errores viejos
    document.querySelectorAll('p[id$="Error"]').forEach(e => e.style.display = 'none');
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }