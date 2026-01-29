let currentUser = null;
let currentCrashBet = 0;   // 0 = No apostado, >0 = Apostado
let hasCashedOut = false;  // Controla si ya retiraste en la ronda actual
let lastGameState = "";    // Para detectar cambios de fase
let pendingEmail = "";     // Para verificar email
let recoveryEmail = "";    // Para recuperar contraseña
let paymentInterval = null;// Para chequear depósitos
const socket = io();       // Conexión WebSocket

// ==========================================
// 1. INICIALIZACIÓN Y GLOBALES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    checkSession();
    
    // Ocultar nav de logueado por defecto
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
});

socket.on('connect', () => console.log("🟢 Conectado al servidor"));
socket.on('disconnect', () => showToast("🔴 Desconectado", "error"));

// ==========================================
// 2. SISTEMA DE SALDO EN TIEMPO REAL
// ==========================================
function updateGlobalBalance(newBalance) {
    const formatted = parseFloat(newBalance).toFixed(2);
    
    // Navbar
    const navBal = document.getElementById('userBalance');
    if(navBal) {
        navBal.innerText = formatted;
        navBal.style.color = "#00ff88"; // Flash verde
        setTimeout(() => navBal.style.color = "", 500);
    }
    // Perfil
    const profBal = document.getElementById('profileBalanceDisplay');
    if(profBal) profBal.innerText = formatted;
}

// Escuchar cambios de dinero desde el servidor
socket.on('balance_update', (data) => updateGlobalBalance(data.saldo));

// ==========================================
// 3. JUEGO CRASH (LÓGICA BLINDADA)
// ==========================================

function enterGame(gameName) {
    if (!currentUser) return openModal('loginModal');
    if (gameName === 'crash') {
        document.getElementById('gamesMenu').classList.add('hidden');
        document.getElementById('gameInterface-crash').classList.remove('hidden');
        socket.emit('join_crash'); // Pedir estado actual
    }
}

function backToGames() {
    document.getElementById('gameInterface-crash').classList.add('hidden');
    document.getElementById('gamesMenu').classList.remove('hidden');
}

// --- GESTIÓN VISUAL DE CAPAS (LAYERS) ---
function showLayer(layerId) {
    // Ocultar todas
    document.getElementById('gameLayer').className = 'layer hidden';
    document.getElementById('waitingLayer').className = 'layer hidden';
    document.getElementById('crashedLayer').className = 'layer hidden';
    
    // Mostrar la solicitada si existe
    const target = document.getElementById(layerId);
    if(target) target.className = 'layer visible';
}

// --- SOCKETS: RECEPCIÓN DE DATOS ---

// 1. Sincronización Total (Al entrar o F5)
socket.on('crash_sync', (data) => {
    // Restaurar variables locales
    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        hasCashedOut = data.my_bet.cashed_out;
    } else {
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    
    // Actualizar UI
    handleGameState(data.state, data.multiplier, data.time_left);
    updateButtons(data.state);

    // Restaurar Tabla
    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });
});

// 2. Estados de Espera (IDLE / WAITING)
socket.on('crash_status', (data) => {
    handleGameState(data.status, 1.00, data.time_left);
    updateButtons(data.status);
});

// 3. Inicio de Vuelo
socket.on('crash_start', () => {
    handleGameState('RUNNING', 1.00, 0);
    updateButtons('RUNNING');
});

// 4. Tick de Vuelo (Cada 100ms)
socket.on('crash_tick', (data) => {
    const mult = data.multiplier;
    document.getElementById('crashMultiplier').innerText = mult.toFixed(2) + "x";
    
    // Animar Cohete
    const rocket = document.getElementById('rocketIcon');
    const rot = (mult * 2) % 5;
    rocket.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${1 + mult/100})`;

    // Actualizar Botón Retirar en tiempo real
    if(currentCrashBet > 0 && !hasCashedOut) {
        const win = (currentCrashBet * mult).toFixed(2);
        const btn = document.getElementById('btnCashout');
        btn.innerHTML = `<span>RETIRAR</span> <small style="color:#00ff88">+${win}$</small>`;
        
        // FUERZA BRUTA: Asegurar que el botón no esté bloqueado
        if(btn.disabled) {
            btn.disabled = false;
            btn.classList.remove('hidden');
            btn.style.background = "#ffbe0b";
        }
    }
});

// 5. Explosión (Crash)
socket.on('crash_boom', (data) => {
    handleGameState('CRASHED', data.crash_point, 0);
    updateButtons('CRASHED');
    
    // === LIMPIEZA AUTOMÁTICA ===
    // Después de 3 segundos, reseteamos la variable de apuesta local.
    // Esto hace que cuando llegue el próximo estado 'IDLE'/'WAITING', 
    // updateButtons() vea que currentCrashBet es 0 y muestre el botón "APOSTAR".
    setTimeout(() => {
        currentCrashBet = 0;
        hasCashedOut = false;
    }, 3000);
});

// --- SOCKETS: ACCIONES ---

socket.on('bet_accepted', (data) => {
    currentCrashBet = data.amount;
    hasCashedOut = false;
    updateGlobalBalance(data.new_balance);
    showToast("Apuesta aceptada", "success");
    // Forzamos actualización visual inmediata
    updateButtons('WAITING');
});

socket.on('cashout_success', (data) => {
    hasCashedOut = true;
    updateGlobalBalance(data.new_balance);
    showToast(`Ganaste +${parseFloat(data.win).toFixed(2)}$`, "success");
    updateButtons('RUNNING');
});

socket.on('error_msg', (data) => {
    showToast(data.msg, 'error');
    // Si hubo error, reactivar botón apostar
    const btn = document.getElementById('btnBet');
    if(btn.disabled && currentCrashBet === 0) {
        btn.disabled = false;
        btn.querySelector('span').innerText = "APOSTAR";
    }
});

socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));

// --- FUNCIONES LÓGICAS DE UI ---

function handleGameState(state, mult, time) {
    const timeNum = parseFloat(time);

    if (state === 'IDLE') {
        showLayer('waitingLayer');
        document.getElementById('countdownBig').innerText = "ESPERANDO...";
        document.getElementById('progressBarFill').style.width = "0%";
    } 
    else if (state === 'WAITING') {
        showLayer('waitingLayer');
        document.getElementById('countdownBig').innerText = timeNum.toFixed(1) + "s";
        // Barra de progreso (basada en 15s)
        const pct = (timeNum / 15) * 100;
        document.getElementById('progressBarFill').style.width = pct + "%";
    } 
    else if (state === 'RUNNING') {
        showLayer('gameLayer');
    } 
    else if (state === 'CRASHED') {
        showLayer('crashedLayer');
        document.getElementById('finalCrashPoint').innerText = "@ " + parseFloat(mult).toFixed(2) + "x";
    }
}

function updateButtons(state) {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');

    // FASE 1: APUESTAS (IDLE/WAITING)
    if (state === 'IDLE' || state === 'WAITING') {
        if (currentCrashBet === 0) {
            // MODO: Puedo Apostar
            btnBet.classList.remove('hidden');
            btnBet.disabled = false;
            btnBet.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
            btnCash.classList.add('hidden');
        } else {
            // MODO: Ya aposté
            btnBet.classList.add('hidden');
            btnCash.classList.remove('hidden');
            btnCash.disabled = true;
            btnCash.style.background = "#30363d";
            btnCash.innerHTML = `<span>APOSTADO</span><small>${currentCrashBet}$</small>`;
        }
    }
    // FASE 2: VUELO (RUNNING)
    else if (state === 'RUNNING') {
        btnBet.classList.add('hidden');
        
        if (currentCrashBet > 0 && !hasCashedOut) {
            // MODO: Retirar
            btnCash.classList.remove('hidden');
            btnCash.disabled = false;
            btnCash.style.background = "#ffbe0b";
        } else if (currentCrashBet > 0 && hasCashedOut) {
            // MODO: Ganado
            btnCash.classList.remove('hidden');
            btnCash.disabled = true;
            btnCash.style.background = "#00ff88";
            btnCash.style.color = "#000";
            btnCash.innerHTML = `<span>GANADO</span><small>¡Bien!</small>`;
        } else {
            // MODO: Espectador
            btnCash.classList.add('hidden');
        }
    }
    // FASE 3: EXPLOSIÓN (CRASHED)
    else if (state === 'CRASHED') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden');
        btnCash.disabled = true;

        if (currentCrashBet > 0 && !hasCashedOut) {
            // Perdedor
            btnCash.style.background = "#ff4757";
            btnCash.style.color = "#fff";
            btnCash.innerHTML = `<span>PERDIDO</span><small>${currentCrashBet}$</small>`;
        } else if (currentCrashBet > 0 && hasCashedOut) {
            // Ganador
            btnCash.style.background = "#00ff88";
            btnCash.style.color = "#000";
            btnCash.innerHTML = `<span>GANADO</span><small>¡Bien!</small>`;
        } else {
            // Espectador
            btnCash.classList.add('hidden');
            // Mostramos botón apostar desactivado para feedback de "Prepárate"
            btnBet.classList.remove('hidden');
            btnBet.disabled = true;
            btnBet.innerHTML = `<span>ESPERANDO...</span>`;
        }
    }
}

// --- ACCIONES DE JUEGO ---
function placeBet() {
    const amount = parseFloat(document.getElementById('betInput').value);
    if(isNaN(amount) || amount <= 0) return showToast("Monto inválido", "error");
    
    // UI Feedback Optimista
    const btn = document.getElementById('btnBet');
    btn.disabled = true; 
    btn.querySelector('span').innerText = "ENVIANDO...";
    
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

// --- TABLA DE JUGADORES ---
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
// 4. UTILS GENÉRICOS (Toast, Modal, Nav)
// ==========================================

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

function navigate(viewId) {
    if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) return openModal('loginModal');
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');

    // Resetear vistas de juego
    if(viewId !== 'games') {
        document.getElementById('gameInterface-crash').classList.add('hidden');
        document.getElementById('gamesMenu').classList.remove('hidden');
    }
    window.scrollTo(0, 0);
}

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

// ==========================================
// 5. AUTH & PERFIL (Login, Register...)
// ==========================================

async function doLogin() {
    const user = document.getElementById('loginUser').value; const pass = document.getElementById('loginPass').value;
    const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass}) });
    const data = await res.json();
    if(data.status === 'success') window.location.reload();
    else if(data.status === 'unverified') { pendingEmail=data.email; document.getElementById('verifyEmailDisplay').innerText=pendingEmail; closeModal('loginModal'); openModal('verifyModal'); }
    else showToast(data.message, 'error');
}

async function doRegister() {
    const user = document.getElementById('regUser').value; const pass = document.getElementById('regPass').value; const email = document.getElementById('regEmail').value;
    const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass, email: email}) });
    const data = await res.json();
    if(data.status === 'verify_needed') { pendingEmail=email; document.getElementById('verifyEmailDisplay').innerText=pendingEmail; closeModal('registerModal'); openModal('verifyModal'); }
    else showToast(data.message, 'error');
}

async function doVerify() {
    const code = document.getElementById('verifyCodeInput').value;
    const res = await fetch('/api/verify_code', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: pendingEmail, code: code}) });
    const data = await res.json();
    if(data.status === 'success') window.location.reload(); else showToast(data.message, "error");
}

async function doLogout() { await fetch('/api/logout'); window.location.reload(); }

async function sendForgotCode() { 
    const email = document.getElementById('forgotEmail').value;
    const res = await fetch('/api/forgot_password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email})});
    const data = await res.json();
    if(data.status==='success') { recoveryEmail=email; switchModal('forgotModal','resetModal'); } else showToast(data.message,'error');
}

async function doResetPassword() {
    const code = document.getElementById('resetCode').value; const newPass = document.getElementById('resetNewPass').value;
    const res = await fetch('/api/reset_password_with_code', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:recoveryEmail, code:code, password:newPass})});
    const data = await res.json();
    if(data.status==='success') { showToast("Contraseña cambiada",'success'); switchModal('resetModal','loginModal'); } else showToast(data.message,'error');
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput'); if (input.files.length === 0) return;
    const formData = new FormData(); formData.append('file', input.files[0]);
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.status === 'success') { showToast("Avatar actualizado", "success"); setTimeout(() => window.location.reload(), 1000); }
}

function togglePasswordEdit() { document.getElementById('passwordEditSection').classList.toggle('hidden'); }

async function changePassword() {
    const c = document.getElementById('currentPass').value; const n1 = document.getElementById('newPass1').value;
    const res = await fetch('/api/change_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({current: c, new: n1}) });
    const data = await res.json();
    if(data.status === 'success') { showToast("Contraseña cambiada", "success"); togglePasswordEdit(); } else showToast(data.message, "error");
}

// ==========================================
// 6. CHAT Y PAGOS
// ==========================================

function renderMessage(data, chatBox) { 
    const div = document.createElement('div'); 
    div.className = (currentUser && data.username === currentUser) ? 'chat-msg mine' : 'chat-msg theirs'; 
    let ava = data.avatar!=='default.png' ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'; 
    div.innerHTML = `<img src="${ava}" class="chat-avatar"><div class="msg-content">${div.className.includes('theirs')?`<span class="msg-username">${data.username}</span>`:''}${data.message.replace(/</g,"&lt;")}</div>`; 
    chatBox.appendChild(div); 
}

socket.on('chat_history', (data) => { const box = document.getElementById('chatMessages'); box.innerHTML = ''; data.messages.forEach(m => renderMessage(m, box)); box.scrollTop = box.scrollHeight; });
socket.on('new_message', (data) => { const box = document.getElementById('chatMessages'); renderMessage(data, box); box.scrollTop = box.scrollHeight; });

function toggleChat() { document.getElementById('chatSidebar').classList.toggle('closed'); }
function sendMessage() { if(!currentUser) return openModal('loginModal'); const i = document.getElementById('chatInput'); if(i.value.trim()){ socket.emit('send_message', {message: i.value}); i.value = ''; } }

let selectedCurrency = 'btc';
function selectCrypto(coin) { selectedCurrency = coin; document.querySelectorAll('.crypto-option').forEach(el => el.classList.remove('selected')); document.getElementById('opt-' + coin).classList.add('selected'); }

async function createPayment() { 
    const amt = document.getElementById('depositAmount').value;
    const res = await fetch('/api/create_payment', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount:amt, currency:selectedCurrency})});
    const data = await res.json();
    if(data.status==='success') { document.getElementById('depositForm').classList.add('hidden'); document.getElementById('depositWaiting').classList.remove('hidden'); document.getElementById('payAmountDisplay').innerText=data.pay_amount; document.getElementById('payAddressDisplay').innerText=data.pay_address; startPaymentPolling(data.payment_id); }
}

function startPaymentPolling(pid) { paymentInterval = setInterval(async () => { const res = await fetch('/api/check_status', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({payment_id:pid})}); const d = await res.json(); if(d.payment_status==='finished') { clearInterval(paymentInterval); showToast("Pago recibido","success"); setTimeout(()=>window.location.reload(),2000); } }, 3000); }
function cancelPayment() { clearInterval(paymentInterval); document.getElementById('depositWaiting').classList.add('hidden'); document.getElementById('depositForm').classList.remove('hidden'); }
function copyAddress() { navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText); showToast("Copiado","info"); }