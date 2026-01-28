let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
    checkSession();
    simulateLiveWins();
});

// --- SPA NAVIGATION ---
function navigate(viewId) {
    // 1. Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    // 2. Mostrar la deseada
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    // 3. Actualizar Nav Móvil
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');

    // 4. Actualizar Sidebar PC
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const sideItem = document.getElementById('side-' + viewId);
    if(sideItem) sideItem.classList.add('active');
    
    window.scrollTo(0, 0);
}

// --- SESIÓN ---
async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        if (data.logged_in) loginSuccess(data);
    } catch (e) {}
}

function loginSuccess(data) {
    currentUser = data.user;
    
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('loggedNav').classList.remove('hidden');
    document.getElementById('desktopLogout').classList.remove('hidden');
    
    document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
    document.getElementById('profileBalanceDisplay').innerText = data.saldo.toFixed(2);
    document.getElementById('profileUsername').innerText = data.user;

    updateAllAvatars(data.avatar);
}

function updateAllAvatars(filename) {
    const defaultImage = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    let url = defaultImage;

    if (filename && filename !== 'default.png' && filename !== 'null') {
        url = `/static/uploads/${filename}`;
    }

    if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
    if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
}

// --- PERFIL: AHORA LLEVA A LA PÁGINA, NO AL MODAL ---
function handleProfileClick() {
    if (!currentUser) openModal('loginModal');
    else navigate('profile');
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    if (input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.status === 'success') updateAllAvatars(data.avatar);
}

// --- LOGIN/REGISTRO ---
async function doLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();
    if(data.status === 'success') window.location.reload();
    else alert(data.message);
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
    if(data.status === 'success') window.location.reload();
    else alert(data.message);
}

async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}

async function confirmPayment() {
    alert("Procesando pago...");
    closeModal('depositModal');
}

// --- GANADORES ---
function simulateLiveWins() {
    const games = ['Crash', 'Mines', 'Slots'];
    const users = ['hecproll', 'Daniel remon', 'PascualGamerRTX', 'ikerLozanoRomero', 'dudu9439'];
    const tbody = document.getElementById('liveWinsBody');

    function addWin() {
        if(!tbody) return;
        const game = games[Math.floor(Math.random() * games.length)];
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