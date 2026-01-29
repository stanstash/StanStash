let currentUser = null;
let paymentInterval = null;
// INICIALIZAR SOCKET.IO
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
    checkSession();
    simulateLiveWins();
});

// --- CHAT GLOBAL (ESTÉTICO) ---

// Escuchar mensajes nuevos
socket.on('new_message', (data) => {
    const chatBox = document.getElementById('chatMessages');
    const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;

    const msgDiv = document.createElement('div');
    
    // Determinar si el mensaje es mío o de otro
    const isMe = currentUser && data.username === currentUser;
    msgDiv.className = isMe ? 'chat-msg mine' : 'chat-msg theirs';
    
    // Avatar
    let avatarUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    if(data.avatar && data.avatar !== 'default.png') avatarUrl = `/static/uploads/${data.avatar}`;
    
    // HTML del mensaje
    msgDiv.innerHTML = `
        <img src="${avatarUrl}" class="chat-avatar" alt="Avatar">
        <div class="msg-content">
            ${!isMe ? `<span class="msg-username">${data.username}</span>` : ''}
            ${escapeHtml(data.message)}
        </div>
    `;
    
    chatBox.appendChild(msgDiv);

    // Auto-scroll solo si el usuario no ha subido para leer historial
    if (isScrolledToBottom) {
        setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
    }
});

function toggleChat() {
    const chat = document.getElementById('chatSidebar');
    chat.classList.toggle('closed');
    // Al abrir, scroll al final
    if(!chat.classList.contains('closed')) {
        setTimeout(() => {
            const chatBox = document.getElementById('chatMessages');
            chatBox.scrollTop = chatBox.scrollHeight;
        }, 300);
    }
}

function sendMessage() {
    if(!currentUser) return openModal('loginModal');
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        socket.emit('send_message', { message: message });
        input.value = '';
        input.focus();
    }
}

function handleChatKeyPress(e) { 
    if(e.key === 'Enter') sendMessage(); 
}

// Seguridad XSS (Evitar que metan HTML)
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function toggleChat() {
    const chat = document.getElementById('chatSidebar');
    chat.classList.toggle('closed');
    if(!chat.classList.contains('closed')) {
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }
}

function sendMessage() {
    if(!currentUser) return openModal('loginModal');
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('send_message', { message: message });
        input.value = '';
    }
}

function handleChatKeyPress(e) { if(e.key === 'Enter') sendMessage(); }

// Evitar inyección HTML en el chat
function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


// --- SPA NAVIGATION ---
function navigate(viewId) {
    if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) return openModal('loginModal');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const sideItem = document.getElementById('side-' + viewId);
    if(sideItem) sideItem.classList.add('active');
    window.scrollTo(0, 0);
    // Cerrar chat al navegar en móvil
    if(window.innerWidth < 1024) document.getElementById('chatSidebar').classList.add('closed');
}

// --- SESIÓN & AVATARS ---
async function checkSession() {
    try { const res = await fetch('/api/check_session'); const data = await res.json(); if (data.logged_in) loginSuccess(data); } catch (e) {}
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
    if (filename && filename !== 'default.png') url = `/static/uploads/${filename}`;
    if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
    if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
}

// --- PERFIL ---
function handleProfileClick() { if (!currentUser) openModal('loginModal'); else navigate('profile'); }
async function uploadAvatar() {
    const input = document.getElementById('avatarInput'); if (input.files.length === 0) return;
    const formData = new FormData(); formData.append('file', input.files[0]);
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json(); if(data.status === 'success') updateAllAvatars(data.avatar);
}
function togglePasswordEdit() { document.getElementById('passwordEditSection').classList.toggle('hidden'); }
async function changePassword() {
    const current = document.getElementById('currentPass').value; const new1 = document.getElementById('newPass1').value; const new2 = document.getElementById('newPass2').value;
    if (new1 !== new2) return alert("No coinciden");
    const res = await fetch('/api/change_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({current: current, new: new1}) });
    const data = await res.json(); if(data.status === 'success') { alert("Contraseña cambiada"); togglePasswordEdit(); } else alert(data.message);
}

// --- PAGOS (Simulación Mantenida) ---
let selectedCurrency = 'btc';
function selectCrypto(coin) { selectedCurrency = coin; document.querySelectorAll('.crypto-option').forEach(el => el.classList.remove('selected')); document.getElementById('opt-' + coin).classList.add('selected'); }
async function createPayment() {
    const amount = document.getElementById('depositAmount').value; if (!amount || amount < 10) return alert("Mínimo 10 USD");
    const res = await fetch('/api/create_payment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: amount, currency: selectedCurrency}) });
    const data = await res.json();
    if(data.status === 'success') {
        document.getElementById('depositForm').classList.add('hidden'); document.getElementById('depositWaiting').classList.remove('hidden');
        document.getElementById('payAmountDisplay').innerText = data.pay_amount; document.getElementById('payCurrencyDisplay').innerText = data.pay_currency.toUpperCase(); document.getElementById('payAddressDisplay').innerText = data.pay_address;
        startPaymentPolling(data.payment_id);
    } else alert(data.message);
}
function startPaymentPolling(paymentId) {
    if(paymentInterval) clearInterval(paymentInterval);
    paymentInterval = setInterval(async () => {
        const res = await fetch('/api/check_status', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({payment_id: paymentId}) });
        const data = await res.json();
        if(data.payment_status === 'finished') { clearInterval(paymentInterval); alert("✅ ¡PAGO RECIBIDO! Saldo actualizado."); window.location.reload(); }
    }, 3000);
}
function cancelPayment() { if(paymentInterval) clearInterval(paymentInterval); document.getElementById('depositWaiting').classList.add('hidden'); document.getElementById('depositForm').classList.remove('hidden'); }
function copyAddress() { navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText); alert("Dirección copiada"); }

// --- AUTH & UTILS ---
async function doLogin() { const user = document.getElementById('loginUser').value; const pass = document.getElementById('loginPass').value; const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass}) }); const data = await res.json(); if(data.status === 'success') window.location.reload(); else alert(data.message); }
async function doRegister() { const user = document.getElementById('regUser').value; const pass = document.getElementById('regPass').value; const email = document.getElementById('regEmail').value; const phone = document.getElementById('regPhone').value; if(!user || !pass || !email) return alert("Rellena datos"); const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass, email: email, telefono: phone}) }); const data = await res.json(); if(data.status === 'success') window.location.reload(); else alert(data.message); }
async function doLogout() { await fetch('/api/logout'); window.location.reload(); }
function simulateLiveWins() { const games = ['Crash', 'Mines', 'Slots']; const users = ['hecproll', 'Daniel remon', 'PascualGamerRTX', 'ikerLozanoRomero', 'dudu9439']; const tbody = document.getElementById('liveWinsBody'); function addWin() { if(!tbody) return; const game = games[Math.floor(Math.random() * games.length)]; const user = users[Math.floor(Math.random() * users.length)]; const amount = (Math.random() * 100).toFixed(2); const row = document.createElement('tr'); row.innerHTML = `<td>${game}</td><td>${user}</td><td class="win-amount">+${amount}$</td>`; row.style.animation = 'fadeIn 0.5s'; tbody.prepend(row); if(tbody.children.length > 5) tbody.lastChild.remove(); setTimeout(addWin, Math.random() * 3000 + 2000); } addWin(); }
function openModal(id) { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }