let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Iniciar en Home
    navigate('home');
    
    // 2. Estado visual inicial (Invitado)
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');

    // 3. Comprobar sesión
    checkSession();
    
    // 4. Iniciar simulación de premios
    simulateLiveWins();
});

// --- SPA NAVIGATION ---
function navigate(viewId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    // Mostrar la elegida
    document.getElementById('view-' + viewId).classList.remove('hidden');
    
    // Nav Móvil (Bottom)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');

    // Sidebar PC (Left)
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const sideItem = document.getElementById('side-' + viewId);
    if(sideItem) sideItem.classList.add('active');
    
    window.scrollTo(0, 0);
}

// --- SESIÓN (Lógica de carga) ---
async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        // Si el servidor dice que estamos dentro, actualizamos la UI
        if (data.logged_in) loginSuccess(data);
    } catch (e) {}
}

function loginSuccess(data) {
    currentUser = data.user;
    
    // Cambiar Navegación
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('loggedNav').classList.remove('hidden');
    document.getElementById('desktopLogout').classList.remove('hidden');
    
    // Poner datos en la web
    document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
    document.getElementById('profileBalanceDisplay').innerText = data.saldo.toFixed(2);
    document.getElementById('profileUsername').innerText = data.user;

    updateAllAvatars(data.avatar);
}

function updateAllAvatars(filename) {
    let url = 'https://via.placeholder.com/100/000000/FFFFFF/?text=User';
    if (filename && filename !== 'default.png') url = `/static/uploads/${filename}`;
    else if (currentUser) url = `https://via.placeholder.com/100/000000/00FF88/?text=${currentUser.charAt(0).toUpperCase()}`;

    if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
    if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
}

// --- PERFIL ---
function handleProfileClick() {
    if (!currentUser) openModal('loginModal');
    else openModal('profileModal');
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    if (input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json();
    // Actualizamos sin recargar
    if(data.status === 'success') updateAllAvatars(data.avatar);
}

// --- LOGIN Y REGISTRO (CON RECARGA) ---

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
        window.location.reload();
    } else {
        alert(data.message);
    }
}

async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    
    if(!user || !pass || !email) return alert("Rellena todos los datos");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass, email: email, telefono: phone})
    });
    const data = await res.json();

    if(data.status === 'success') {
        window.location.reload();
    } else {
        alert(data.message);
    }
}

// --- LOGOUT Y OTROS ---

async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}

async function confirmPayment() {
    alert("Procesando pago...");
    closeModal('depositModal');
}

// --- SIMULACIÓN GANADORES (NOMBRES PERSONALIZADOS) ---
function simulateLiveWins() {
    const games = ['Crash', 'Mines', 'Slots'];
    
    // AQUÍ ESTÁN TUS NOMBRES NUEVOS
    const users = ['hecproll', 'Daniel remon', 'PascualGamerRTX', 'ikerLozanoRomero', 'dudu9439'];
    
    const tbody = document.getElementById('liveWinsBody');

    function addWin() {
        if(!tbody) return;
        const game = games[Math.floor(Math.random() * games.length)];
        // Elegir nombre al azar
        const user = users[Math.floor(Math.random() * users.length)];
        const amount = (Math.random() * 100).toFixed(2);
        
        const row = document.createElement('tr');
        row.innerHTML = `<td>${game}</td><td>${user}</td><td class="win-amount">+${amount}$</td>`;
        row.style.animation = 'fadeIn 0.5s';
        tbody.prepend(row);
        if(tbody.children.length > 5) tbody.lastChild.remove();
        
        setTimeout(addWin, Math.random() * 3000 + 2000);
    }
    addWin();
}

// UTILS
function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }