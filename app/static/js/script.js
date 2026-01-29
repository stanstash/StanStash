let currentUser = null;
let currentCrashBet = 0;
let pendingEmail = "";   // Para verificar email
let recoveryEmail = "";  // Para recuperar contraseña
let paymentInterval = null; // Para depósitos
const socket = io();

// ==========================================
// 1. INICIALIZACIÓN Y GLOBALES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    checkSession();
    
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
});

socket.on('connect', () => {
    console.log("🟢 Conectado al servidor");
});

socket.on('disconnect', () => {
    showToast("Conexión perdida", "error");
});

// ==========================================
// 2. SISTEMA DE SALDO EN TIEMPO REAL
// ==========================================
function updateGlobalBalance(newBalance) {
    const formatted = parseFloat(newBalance).toFixed(2);
    
    const navBal = document.getElementById('userBalance');
    if(navBal) {
        navBal.innerText = formatted;
        navBal.style.color = "#00ff88";
        setTimeout(() => navBal.style.color = "", 500);
    }

    const profBal = document.getElementById('profileBalanceDisplay');
    if(profBal) profBal.innerText = formatted;
}

socket.on('balance_update', (data) => updateGlobalBalance(data.saldo));

// ==========================================
// 3. AUTENTICACIÓN Y USUARIO
// ==========================================

// Login
async function doLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    if(!user || !pass) return showToast("Rellena los campos", "error");

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();

    if(data.status === 'success') {
        window.location.reload();
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

// Registro
async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;

    const btn = document.querySelector('#registerModal .btn-action');
    const txt = btn.innerText; btn.innerText = "..."; btn.disabled = true;

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
            showToast("Código enviado", "success");
        } else {
            showToast(data.message, "error");
        }
    } catch(e) { showToast("Error de red", "error"); } 
    finally { btn.innerText = txt; btn.disabled = false; }
}

// Verificar Email
async function doVerify() {
    const code = document.getElementById('verifyCodeInput').value;
    const res = await fetch('/api/verify_code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: pendingEmail, code: code})
    });
    const data = await res.json();
    if(data.status === 'success') window.location.reload();
    else showToast(data.message, "error");
}

// Logout
async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}

// --- RECUPERAR CONTRASEÑA ---
async function sendForgotCode() {
    const email = document.getElementById('forgotEmail').value;
    if(!email) return showToast("Introduce tu email", "error");
    
    const btn = document.querySelector('#forgotModal .btn-action');
    btn.disabled = true; btn.innerText = "...";

    try {
        const res = await fetch('/api/forgot_password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: email})
        });
        const data = await res.json();
        if(data.status === 'success') {
            recoveryEmail = email;
            switchModal('forgotModal', 'resetModal');
            showToast("Código enviado", "success");
        } else {
            showToast(data.message, "error");
        }
    } catch(e) { showToast("Error", "error"); }
    finally { btn.disabled = false; btn.innerText = "ENVIAR CÓDIGO"; }
}

async function doResetPassword() {
    const code = document.getElementById('resetCode').value;
    const newPass = document.getElementById('resetNewPass').value;
    
    const res = await fetch('/api/reset_password_with_code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: recoveryEmail, code: code, password: newPass})
    });
    const data = await res.json();
    if(data.status === 'success') {
        showToast("Contraseña cambiada", "success");
        switchModal('resetModal', 'loginModal');
    } else {
        showToast(data.message, "error");
    }
}

// --- SESIÓN Y PERFIL ---
async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        if (data.logged_in) {
            currentUser = data.user;
            updateGlobalBalance(data.saldo);
            
            document.getElementById('guestNav').classList.add('hidden');
            document.getElementById('loggedNav').classList.remove('hidden');
            document.getElementById('desktopLogout').classList.remove('hidden');
            document.getElementById('profileUsername').innerText = data.user;
            
            const url = data.avatar !== 'default.png' ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
            if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
            if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
        }
    } catch (e) {}
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    if (input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.status === 'success') {
        showToast("Avatar actualizado", "success");
        setTimeout(() => window.location.reload(), 1000);
    }
}

function togglePasswordEdit() { document.getElementById('passwordEditSection').classList.toggle('hidden'); }

async function changePassword() {
    const c = document.getElementById('currentPass').value;
    const n1 = document.getElementById('newPass1').value;
    if(!c || !n1) return showToast("Rellena los campos", "error");
    
    const res = await fetch('/api/change_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({current: c, new: n1})
    });
    const data = await res.json();
    if(data.status === 'success') {
        showToast("Contraseña cambiada", "success");
        togglePasswordEdit();
    } else {
        showToast(data.message, "error");
    }
}

// ==========================================
// 4. JUEGO CRASH (LÓGICA NUEVA)
// ==========================================

function enterGame(gameName) {
    if (!currentUser) return openModal('loginModal');
    if (gameName === 'crash') {
        document.getElementById('gamesMenu').classList.add('hidden');
        document.getElementById('gameInterface-crash').classList.remove('hidden');
        socket.emit('join_crash');
    }
}

function backToGames() {
    document.getElementById('gameInterface-crash').classList.add('hidden');
    document.getElementById('gamesMenu').classList.remove('hidden');
}

// Sockets Crash
socket.on('crash_sync', (data) => {
    updateCrashUI(data.state, data.multiplier, data.time_left);
    
    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });

    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        if (!data.my_bet.cashed_out && data.state === 'RUNNING') {
            setButtonState('cashout_active');
        } else if (!data.my_bet.cashed_out) {
            setButtonState('bet_placed', data.my_bet.amount);
        } else {
            setButtonState('finished');
        }
    } else {
        if(data.state === 'IDLE' || data.state === 'WAITING') setButtonState('can_bet');
        else setButtonState('disabled');
    }
});

socket.on('crash_status', (data) => updateCrashUI(data.status, 1.00, data.time_left));
socket.on('crash_start', () => updateCrashUI('RUNNING', 1.00, 0));

socket.on('crash_tick', (data) => {
    const mult = data.multiplier;
    document.getElementById('crashMultiplier').innerText = mult.toFixed(2) + "x";
    
    const rocket = document.getElementById('rocketIcon');
    const rot = (mult * 2) % 5;
    rocket.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${1 + mult/100})`;

    if(currentCrashBet > 0) {
        const win = (currentCrashBet * mult).toFixed(2);
        const btn = document.getElementById('btnCashout');
        if(!btn.disabled) {
            btn.innerHTML = `<span>RETIRAR</span> <small style="color:#00ff88">+${win}$</small>`;
        }
    }
});

socket.on('crash_boom', (data) => {
    updateCrashUI('CRASHED', data.crash_point, 0);
    currentCrashBet = 0;
    setTimeout(() => setButtonState('can_bet'), 2000);
});

socket.on('bet_accepted', (data) => {
    currentCrashBet = data.amount;
    updateGlobalBalance(data.new_balance);
    setButtonState('bet_placed', data.amount);
    showToast("Apuesta aceptada", "success");
});

socket.on('cashout_success', (data) => {
    showToast(`¡Has ganado +${parseFloat(data.win).toFixed(2)}$!`, 'success');
    setButtonState('finished');
    currentCrashBet = 0;
});

socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));
socket.on('error_msg', (data) => {
    showToast(data.msg, 'error');
    if(document.getElementById('btnBet').disabled) {
        document.getElementById('btnBet').disabled = false;
        document.getElementById('btnBet').innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
    }
});

// UI Helpers Crash
function updateCrashUI(state, mult, time) {
    const display = document.getElementById('crashDisplay');
    const statusText = document.getElementById('crashStatusText');
    const multText = document.getElementById('crashMultiplier');

    display.classList.remove('running', 'crashed');
    document.getElementById('winOverlay').classList.add('hidden');

    if (state === 'IDLE') {
        statusText.innerText = "ESPERANDO JUGADORES...";
        statusText.className = "status-badge";
        multText.innerText = "1.00x";
    } else if (state === 'WAITING') {
        const t = Math.max(0, time).toFixed(1);
        statusText.innerText = `INICIO EN ${t}s`;
        statusText.className = "status-badge waiting";
        multText.innerText = "1.00x";
    } else if (state === 'RUNNING') {
        statusText.innerText = "";
        display.classList.add('running');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
        setButtonState('game_started');
    } else if (state === 'CRASHED') {
        statusText.innerText = "CRASHED";
        display.classList.add('crashed');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
    }
}

function setButtonState(state, amount=0) {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');

    if(state === 'can_bet') {
        btnBet.classList.remove('hidden'); btnBet.disabled = false; 
        btnBet.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
        btnCash.classList.add('hidden');
    } 
    else if(state === 'bet_placed') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden'); btnCash.disabled = true; 
        btnCash.style.background = "#30363d";
        btnCash.innerHTML = `<span>APOSTADO</span><small>${amount}$</small>`;
    } 
    else if(state === 'game_started' || state === 'cashout_active') {
        btnBet.classList.add('hidden');
        if(currentCrashBet > 0) { 
            btnCash.classList.remove('hidden'); btnCash.disabled = false; 
            btnCash.style.background = "#ffbe0b";
            btnCash.innerHTML = `<span>RETIRAR</span><small>...</small>`;
        } else {
            btnCash.classList.add('hidden');
        }
    } 
    else if(state === 'finished') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden'); btnCash.disabled = true; 
        btnCash.style.background = "#00ff88"; btnCash.style.color = "#000";
        btnCash.innerHTML = `<span>GANADO</span><small>¡Bien hecho!</small>`;
    }
    else if(state === 'disabled') {
        btnBet.disabled = true;
    }
}

function placeBet() {
    const amount = parseFloat(document.getElementById('betInput').value);
    if(isNaN(amount) || amount <= 0) return showToast("Monto inválido", "error");
    const btn = document.getElementById('btnBet');
    btn.disabled = true; btn.querySelector('span').innerText = "ENVIANDO...";
    socket.emit('place_bet_crash', {amount: amount});
}

function doCashOut() {
    socket.emit('cash_out_crash');
    document.getElementById('btnCashout').disabled = true;
}

function modifyBet(type) {
    const input = document.getElementById('betInput');
    let val = parseFloat(input.value);
    if(type === 'half') val = Math.max(1, val / 2);
    if(type === 'double') val = val * 2;
    input.value = val.toFixed(2);
}

function addPlayerToTable(data) {
    const list = document.getElementById('crashPlayersList');
    if(document.getElementById(`player-${data.username}`)) return;
    const row = document.createElement('div');
    row.className = 'player-row';
    row.id = `player-${data.username}`;
    let avatar = data.avatar ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    row.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><img src="${avatar}" style="width:24px; height:24px; border-radius:50%;"><span>${data.username}</span></div><div style="color:#ffbe0b; font-weight:bold;">${data.amount}$</div>`;
    list.appendChild(row);
}

function markPlayerWin(username, win, mult) {
    const row = document.getElementById(`player-${username}`);
    if(row) {
        row.classList.add('winner');
        if(!row.querySelector('.win-badge-btn')) {
            row.innerHTML += `<div class="win-badge-btn" style="margin-left:auto; background:rgba(0,255,136,0.2); color:#00ff88; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:bold;">+${parseFloat(win).toFixed(2)}$ (${mult}x)</div>`;
        }
    }
}

// ==========================================
// 5. CHAT GLOBAL
// ==========================================
function renderMessage(data, chatBox) {
    const div = document.createElement('div');
    div.className = (currentUser && data.username === currentUser) ? 'chat-msg mine' : 'chat-msg theirs';
    let ava = data.avatar && data.avatar !== 'default.png' ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    div.innerHTML = `<img src="${ava}" class="chat-avatar"><div class="msg-content">${div.className.includes('theirs')?`<span class="msg-username">${data.username}</span>`:''}${data.message.replace(/</g,"&lt;")}</div>`;
    chatBox.appendChild(div);
}

socket.on('chat_history', (data) => {
    const box = document.getElementById('chatMessages');
    box.innerHTML = '';
    data.messages.forEach(m => renderMessage(m, box));
    box.scrollTop = box.scrollHeight;
});

socket.on('new_message', (data) => {
    const box = document.getElementById('chatMessages');
    const scroll = box.scrollHeight - box.clientHeight <= box.scrollTop + 100;
    renderMessage(data, box);
    if(scroll) box.scrollTop = box.scrollHeight;
});

function toggleChat() { document.getElementById('chatSidebar').classList.toggle('closed'); }
function sendMessage() {
    if(!currentUser) return openModal('loginModal');
    const i = document.getElementById('chatInput');
    if(i.value.trim()){ socket.emit('send_message', {message: i.value}); i.value = ''; }
}

// ==========================================
// 6. PAGOS Y NAVEGACIÓN
// ==========================================
let selectedCurrency = 'btc';
function selectCrypto(coin) {
    selectedCurrency = coin;
    document.querySelectorAll('.crypto-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('opt-' + coin).classList.add('selected');
}

async function createPayment() {
    const amount = document.getElementById('depositAmount').value;
    if (!amount || amount < 10) return showToast("Mínimo 10 USD", "error");
    const res = await fetch('/api/create_payment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: amount, currency: selectedCurrency}) });
    const data = await res.json();
    if(data.status === 'success') {
        document.getElementById('depositForm').classList.add('hidden');
        document.getElementById('depositWaiting').classList.remove('hidden');
        document.getElementById('payAmountDisplay').innerText = data.pay_amount;
        document.getElementById('payCurrencyDisplay').innerText = data.pay_currency.toUpperCase();
        document.getElementById('payAddressDisplay').innerText = data.pay_address;
        startPaymentPolling(data.payment_id);
    } else showToast(data.message, "error");
}

function startPaymentPolling(paymentId) {
    if(paymentInterval) clearInterval(paymentInterval);
    paymentInterval = setInterval(async () => {
        const res = await fetch('/api/check_status', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({payment_id: paymentId}) });
        const data = await res.json();
        if(data.payment_status === 'finished') {
            clearInterval(paymentInterval);
            showToast("¡PAGO RECIBIDO!", "success");
            setTimeout(() => window.location.reload(), 2000);
        }
    }, 3000);
}

function cancelPayment() {
    if(paymentInterval) clearInterval(paymentInterval);
    document.getElementById('depositWaiting').classList.add('hidden');
    document.getElementById('depositForm').classList.remove('hidden');
}

function copyAddress() {
    navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText);
    showToast("Dirección copiada", "info");
}

function navigate(viewId) {
    if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) return openModal('loginModal');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');

    // Resetear Crash si salimos
    if(viewId !== 'games') {
        document.getElementById('gameInterface-crash').classList.add('hidden');
        document.getElementById('gamesMenu').classList.remove('hidden');
    }
    window.scrollTo(0, 0);
}

// Utils
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 400); }, 3000);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }