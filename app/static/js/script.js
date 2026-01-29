let currentUser = null;
let paymentInterval = null;
let pendingEmail = "";
let recoveryEmail = "";
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
    checkSession();
    simulateLiveWins();
});

// ==========================================
// 0. NOTIFICACIONES BONITAS (TOAST)
// ==========================================
function showToast(message, type = 'info') {
    // Tipos: 'success', 'error', 'info'
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icono según tipo
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-circle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Auto eliminar
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 400); // Esperar animación CSS
    }, 4000);
}

// ==========================================
// 1. CHAT
// ==========================================
function renderMessage(data, chatBox) {
    const msgDiv = document.createElement('div');
    const isMe = currentUser && data.username === currentUser;
    msgDiv.className = isMe ? 'chat-msg mine' : 'chat-msg theirs';
    let avatarUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    if(data.avatar && data.avatar !== 'default.png') avatarUrl = `/static/uploads/${data.avatar}`;
    msgDiv.innerHTML = `<img src="${avatarUrl}" class="chat-avatar"><div class="msg-content">${!isMe ? `<span class="msg-username">${data.username}</span>` : ''}${escapeHtml(data.message)}</div>`;
    chatBox.appendChild(msgDiv);
}

socket.on('chat_history', (data) => {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = '';
    if(data.messages.length === 0) chatBox.innerHTML = '<div class="chat-msg system"><div class="sys-text">Bienvenido al chat global.</div></div>';
    else data.messages.forEach(msg => renderMessage(msg, chatBox));
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('new_message', (data) => {
    const chatBox = document.getElementById('chatMessages');
    const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 100;
    renderMessage(data, chatBox);
    if (isScrolledToBottom) chatBox.scrollTop = chatBox.scrollHeight;
});

function toggleChat() { document.getElementById('chatSidebar').classList.toggle('closed'); setTimeout(() => { const cb = document.getElementById('chatMessages'); cb.scrollTop = cb.scrollHeight; }, 300); }
function sendMessage() { if(!currentUser) return openModal('loginModal'); const input = document.getElementById('chatInput'); const message = input.value.trim(); if (message) { socket.emit('send_message', { message: message }); input.value = ''; input.focus(); } }
function handleChatKeyPress(e) { if(e.key === 'Enter') sendMessage(); }
function escapeHtml(text) { if (!text) return text; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ==========================================
// 2. NAV
// ==========================================
function navigate(viewId) {
    if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) return openModal('loginModal');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const ni = document.getElementById('nav-' + viewId); if(ni) ni.classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const si = document.getElementById('side-' + viewId); if(si) si.classList.add('active');
    window.scrollTo(0, 0);
    if(window.innerWidth < 1024) document.getElementById('chatSidebar').classList.add('closed');
}

// ==========================================
// 3. AUTH (AHORA CON TOASTS)
// ==========================================
async function doLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    
    // Quitamos alert, ponemos toast
    if(!user || !pass) return showToast("Por favor, rellena los campos", "error");

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();

    if(data.status === 'success') {
        showToast(`Bienvenido, ${data.user}`, "success");
        setTimeout(() => window.location.reload(), 1500); // Esperar a que se vea el toast
    } else if (data.status === 'unverified') {
        pendingEmail = data.email;
        document.getElementById('verifyEmailDisplay').innerText = pendingEmail;
        closeModal('loginModal');
        openModal('verifyModal');
        showToast("Cuenta no verificada. Revisa tu email.", "info");
    } else {
        showToast(data.message, "error");
    }
}

async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    
    if(!user || !pass || !email) return showToast("Faltan datos", "error");

    const btn = document.querySelector('#registerModal .btn-action');
    const txt = btn.innerText; btn.innerText = "ENVIANDO CÓDIGO..."; btn.disabled = true;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass, email: email, telefono: phone})
        });
        const data = await res.json();

        if(data.status === 'verify_needed') {
            pendingEmail = data.email;
            document.getElementById('verifyEmailDisplay').innerText = pendingEmail;
            closeModal('registerModal');
            openModal('verifyModal');
            showToast("Código enviado. Revisa tu correo.", "info");
        } else {
            showToast(data.message, "error");
        }
    } catch(e) {
        showToast("Error de conexión", "error");
    } finally {
        btn.innerText = txt; btn.disabled = false;
    }
}

async function doVerify() {
    const code = document.getElementById('verifyCodeInput').value;
    if(!code) return showToast("Introduce el código", "error");

    const res = await fetch('/api/verify_code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: pendingEmail, code: code})
    });
    const data = await res.json();

    if(data.status === 'success') {
        showToast("Cuenta verificada con éxito", "success");
        setTimeout(() => window.location.reload(), 1500);
    } else {
        showToast(data.message, "error");
    }
}

async function doLogout() {
    await fetch('/api/logout');
    showToast("Cerrando sesión...", "info");
    setTimeout(() => window.location.reload(), 1000);
}

// RECUPERAR CONTRASEÑA
async function sendForgotCode() {
    const email = document.getElementById('forgotEmail').value;
    if(!email) return showToast("Introduce tu email", "error");
    const btn = document.querySelector('#forgotModal .btn-action'); const txt = btn.innerText; btn.innerText = "..."; btn.disabled = true;
    try {
        const res = await fetch('/api/forgot_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: email}) });
        const data = await res.json();
        if(data.status === 'success') { recoveryEmail = email; switchModal('forgotModal', 'resetModal'); showToast("Código enviado", "success"); } 
        else showToast(data.message, "error");
    } catch(e) { showToast("Error", "error"); } finally { btn.innerText = txt; btn.disabled = false; }
}

async function doResetPassword() {
    const code = document.getElementById('resetCode').value;
    const newPass = document.getElementById('resetNewPass').value;
    if(!code || !newPass) return showToast("Rellena todo", "error");
    const res = await fetch('/api/reset_password_with_code', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: recoveryEmail, code: code, password: newPass}) });
    const data = await res.json();
    if(data.status === 'success') { showToast("Contraseña actualizada", "success"); switchModal('resetModal', 'loginModal'); } 
    else showToast(data.message, "error");
}

// ==========================================
// 4. SESSION & AVATAR
// ==========================================
async function checkSession() { try { const res = await fetch('/api/check_session'); const data = await res.json(); if (data.logged_in) loginSuccess(data); } catch (e) {} }
function loginSuccess(data) { currentUser = data.user; document.getElementById('guestNav').classList.add('hidden'); document.getElementById('loggedNav').classList.remove('hidden'); document.getElementById('desktopLogout').classList.remove('hidden'); document.getElementById('userBalance').innerText = data.saldo.toFixed(2); document.getElementById('profileBalanceDisplay').innerText = data.saldo.toFixed(2); document.getElementById('profileUsername').innerText = data.user; updateAllAvatars(data.avatar); }
function updateAllAvatars(filename) { const defaultImage = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'; let url = defaultImage; if (filename && filename !== 'default.png') url = `/static/uploads/${filename}`; if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url; if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url; }
async function uploadAvatar() { const input = document.getElementById('avatarInput'); if (input.files.length === 0) return; const formData = new FormData(); formData.append('file', input.files[0]); const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData }); const data = await res.json(); if(data.status === 'success') { updateAllAvatars(data.avatar); showToast("Avatar actualizado", "success"); } }
function handleProfileClick() { if (!currentUser) openModal('loginModal'); else navigate('profile'); }
function togglePasswordEdit() { document.getElementById('passwordEditSection').classList.toggle('hidden'); }
async function changePassword() { const c = document.getElementById('currentPass').value; const n1 = document.getElementById('newPass1').value; const n2 = document.getElementById('newPass2').value; if (n1 !== n2) return showToast("No coinciden", "error"); const res = await fetch('/api/change_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({current: c, new: n1}) }); const data = await res.json(); if(data.status === 'success') { showToast("Contraseña cambiada", "success"); togglePasswordEdit(); } else showToast(data.message, "error"); }

// ==========================================
// 5. PAYMENTS & UTILS
// ==========================================
let selectedCurrency = 'btc';
function selectCrypto(coin) { selectedCurrency = coin; document.querySelectorAll('.crypto-option').forEach(el => el.classList.remove('selected')); document.getElementById('opt-' + coin).classList.add('selected'); }
async function createPayment() { const amount = document.getElementById('depositAmount').value; if (!amount || amount < 10) return showToast("Mínimo 10 USD", "error"); const res = await fetch('/api/create_payment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: amount, currency: selectedCurrency}) }); const data = await res.json(); if(data.status === 'success') { document.getElementById('depositForm').classList.add('hidden'); document.getElementById('depositWaiting').classList.remove('hidden'); document.getElementById('payAmountDisplay').innerText = data.pay_amount; document.getElementById('payCurrencyDisplay').innerText = data.pay_currency.toUpperCase(); document.getElementById('payAddressDisplay').innerText = data.pay_address; startPaymentPolling(data.payment_id); } else showToast(data.message, "error"); }
function startPaymentPolling(paymentId) { if(paymentInterval) clearInterval(paymentInterval); paymentInterval = setInterval(async () => { const res = await fetch('/api/check_status', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({payment_id: paymentId}) }); const data = await res.json(); if(data.payment_status === 'finished') { clearInterval(paymentInterval); showToast("¡PAGO RECIBIDO!", "success"); setTimeout(() => window.location.reload(), 2000); } }, 3000); }
function cancelPayment() { if(paymentInterval) clearInterval(paymentInterval); document.getElementById('depositWaiting').classList.add('hidden'); document.getElementById('depositForm').classList.remove('hidden'); }
function copyAddress() { navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText); showToast("Dirección copiada", "info"); }
function simulateLiveWins() { const games = ['Crash', 'Mines', 'Slots']; const users = ['hecproll', 'Daniel remon', 'PascualGamerRTX', 'ikerLozanoRomero', 'dudu9439']; const tbody = document.getElementById('liveWinsBody'); function addWin() { if(!tbody) return; const game = games[Math.floor(Math.random() * games.length)]; const user = users[Math.floor(Math.random() * users.length)]; const amount = (Math.random() * 100).toFixed(2); const row = document.createElement('tr'); row.innerHTML = `<td>${game}</td><td>${user}</td><td class="win-amount">+${amount}$</td>`; row.style.animation = 'fadeIn 0.5s'; tbody.prepend(row); if(tbody.children.length > 5) tbody.lastChild.remove(); setTimeout(addWin, Math.random() * 3000 + 2000); } addWin(); }
function openModal(id) { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }

// === LÓGICA JUEGO CRASH ===
let currentCrashBet = 0;

// Sockets
socket.on('crash_status', (data) => {
    // Limpieza visual
    document.getElementById('crashDisplay').classList.remove('running', 'crashed');
    document.getElementById('crashMultiplier').innerText = "1.00x";
    
    if (data.status === 'IDLE') {
        document.getElementById('crashStatusText').innerText = "ESPERANDO JUGADORES...";
        document.getElementById('crashStatusText').className = "status-badge"; // gris
        resetButtons(true);
    } 
    else if (data.status === 'WAITING') {
        document.getElementById('crashStatusText').innerText = `INICIO EN ${data.time_left}s`;
        document.getElementById('crashStatusText').className = "status-badge waiting"; // amarillo
        resetButtons(true);
    }
});

socket.on('crash_start', () => {
    document.getElementById('crashDisplay').classList.add('running');
    document.getElementById('crashStatusText').innerText = "VOLANDO...";
    resetButtons(false); // Bloquear apuestas
});

socket.on('crash_tick', (data) => {
    document.getElementById('crashMultiplier').innerText = data.multiplier.toFixed(2) + "x";
    
    // Animación cohete suave (Rotación)
    const rocket = document.getElementById('rocketIcon');
    const rot = (data.multiplier * 2) % 5; 
    rocket.style.transform = `rotate(${rot}deg) scale(1.1)`;

    // Actualizar botón retirar (Feedback visual)
    if(currentCrashBet > 0) {
        const win = (currentCrashBet * data.multiplier).toFixed(2);
        document.getElementById('cashoutProfitPreview').innerHTML = `<span style="color:#000">Retirar</span> <b>+${win}$</b>`;
    }
});

socket.on('crash_boom', (data) => {
    document.getElementById('crashDisplay').classList.remove('running');
    document.getElementById('crashDisplay').classList.add('crashed');
    document.getElementById('crashMultiplier').innerText = data.crash_point + "x";
    document.getElementById('crashStatusText').innerText = "CRASHED";
    
    currentCrashBet = 0;
    
    // Volver a mostrar botón de apostar
    document.getElementById('btnBet').classList.remove('hidden');
    document.getElementById('btnCashout').classList.add('hidden');
});

socket.on('cashout_success', (data) => {
    // NOTIFICACIÓN SUTIL (TOAST)
    showToast(`🤑 Ganaste +${parseFloat(data.win).toFixed(2)}$`, 'success');
    
    // Cambiar botón visualmente para confirmar
    const btn = document.getElementById('btnCashout');
    btn.innerHTML = `<span>¡GANADO!</span> <small>+${parseFloat(data.win).toFixed(2)}$</small>`;
    btn.style.background = "#00ff88"; // Verde victoria
    
    currentCrashBet = 0;
});

// Botones y Lógica
function placeBet() {
    const amount = parseFloat(document.getElementById('betInput').value);
    if(isNaN(amount) || amount <= 0) return showToast("Monto inválido", "error");
    
    socket.emit('place_bet_crash', {amount: amount});
    
    // UI Optimista
    document.getElementById('btnBet').classList.add('hidden');
    const btnCash = document.getElementById('btnCashout');
    btnCash.classList.remove('hidden');
    btnCash.style.background = ""; // Resetear color
    btnCash.innerHTML = `<span>ESPERANDO...</span> <small>Apuesta: ${amount}$</small>`;
    btnCash.disabled = true; // Desactivado hasta que arranque
    
    currentCrashBet = amount;
}

function doCashOut() {
    socket.emit('cash_out_crash');
    // Evitar doble click
    document.getElementById('btnCashout').disabled = true;
}

function resetButtons(canBet) {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');
    
    if(canBet) {
        btnBet.classList.remove('hidden');
        btnBet.disabled = false;
        
        btnCash.classList.add('hidden');
        btnCash.disabled = false;
        btnCash.style.background = ""; // Reset color
        
        // Limpiar lista de jugadores al reiniciar ronda
        document.getElementById('crashPlayersList').innerHTML = '';
        currentCrashBet = 0;
    } else {
        // Ronda empezada
        btnBet.disabled = true;
        // Si aposté, habilitar retirar
        if(currentCrashBet > 0) {
            btnCash.disabled = false;
        }
    }
}