let currentUser = null;
let chatInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
    checkSession();
    simulateLiveWins();
});

// --- SPA NAVIGATION ---
function navigate(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');
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
    
    document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
    document.getElementById('profileBalanceDisplay').innerText = data.saldo.toFixed(2);
    document.getElementById('profileUsername').innerText = data.user;
    
    // Bio
    if(data.bio) document.getElementById('bioDisplay').innerText = data.bio;
    
    updateAllAvatars(data.avatar);
}

function updateAllAvatars(filename) {
    let url = 'https://via.placeholder.com/100/000000/FFFFFF/?text=User';
    if (filename && filename !== 'default.png') url = `/static/uploads/${filename}`;
    
    if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
    if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
}

// --- CHAT SYSTEM (NUEVO) ---
function openChat() {
    if (!currentUser) return openModal('loginModal');
    openModal('chatModal');
    loadChat();
    if (!chatInterval) chatInterval = setInterval(loadChat, 3000); // Actualizar cada 3s
}

async function loadChat() {
    try {
        const res = await fetch('/api/chat/get');
        const data = await res.json();
        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML = ''; // Limpiar
        
        data.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            const avatarUrl = msg.avatar && msg.avatar !== 'default.png' ? `/static/uploads/${msg.avatar}` : 'https://via.placeholder.com/30';
            
            div.innerHTML = `
                <img src="${avatarUrl}" class="chat-avatar">
                <div class="msg-bubble">
                    <div class="msg-user">${msg.user}</div>
                    ${msg.text}
                </div>
            `;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll abajo
    } catch(e) {}
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    input.value = ''; // Limpiar input rápido
    await fetch('/api/chat/send', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({texto: text})
    });
    loadChat();
}

// --- PERFIL ---
function handleProfileClick() {
    if (!currentUser) openModal('loginModal');
    else openModal('profileModal');
}

function toggleBioEdit() {
    document.getElementById('bioEditSection').classList.toggle('hidden');
}

async function saveBio() {
    const bio = document.getElementById('profileBio').value;
    await fetch('/api/update_bio', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({bio: bio})
    });
    document.getElementById('bioDisplay').innerText = bio;
    toggleBioEdit();
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
    if(data.status === 'success') {
        closeModal('loginModal');
        loginSuccess({user: data.user, saldo: data.saldo, avatar: data.avatar, bio: data.bio || ""});
    } else alert(data.message);
}

async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    
    if(!user || !pass || !email) return alert("Rellena datos");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass, email: email, telefono: phone})
    });
    const data = await res.json();
    if(data.status === 'success') {
        closeModal('registerModal');
        loginSuccess({user: data.user, saldo: 100.00, avatar: 'default.png', bio: ""});
        alert("¡Cuenta Creada!");
    } else alert(data.message);
}

async function doLogout() {
    await fetch('/api/logout');
    location.reload();
}

// --- FAKE WINS ---
function simulateLiveWins() {
    const games = ['Crash', 'Mines', 'Slots'];
    const users = ['Alex', 'Juan', 'CryptoKing', 'LuckyBoy', 'Sarah'];
    const tbody = document.getElementById('liveWinsBody');

    function addWin() {
        const game = games[Math.floor(Math.random() * games.length)];
        const user = users[Math.floor(Math.random() * users.length)] + '***';
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
function closeModal(id) { document.getElementById(id).classList.add('hidden'); if(id==='chatModal') clearInterval(chatInterval); }
function switchModal(from, to) { closeModal(from); openModal(to); }