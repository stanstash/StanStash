let currentUser = null;
let currentCrashBet = 0;
let hasCashedOut = false;
let lastGameState = ""; // Variable clave para detectar cambios de ronda
let pendingEmail = "";
let recoveryEmail = "";
let paymentInterval = null;
const socket = io();

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    checkSession();
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
});

// 2. SALDO
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

// 3. JUEGO CRASH
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

// === SOCKETS CRASH ===

socket.on('crash_sync', (data) => {
    // Restaurar Estado Local
    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        hasCashedOut = data.my_bet.cashed_out;
    } else {
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    lastGameState = data.state;

    // UI
    updateCrashUI(data.state, data.multiplier, data.time_left);
    updateButtons(); // Usamos una función centralizada

    // Tabla
    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });
});

socket.on('crash_status', (data) => {
    // DETECCIÓN DE NUEVA RONDA:
    // Si veníamos de CRASHED y ahora estamos en IDLE o WAITING -> Limpieza total
    if (lastGameState === 'CRASHED' && (data.status === 'IDLE' || data.status === 'WAITING')) {
        console.log("Nueva ronda detectada. Reseteando...");
        currentCrashBet = 0;
        hasCashedOut = false;
        document.getElementById('crashPlayersList').innerHTML = ''; // Limpiar tabla
    }
    
    lastGameState = data.status;
    updateCrashUI(data.status, 1.00, data.time_left);
    updateButtons();
});

socket.on('crash_start', () => {
    lastGameState = 'RUNNING';
    updateCrashUI('RUNNING', 1.00, 0);
    updateButtons();
});

socket.on('crash_tick', (data) => {
    const mult = data.multiplier;
    document.getElementById('crashMultiplier').innerText = mult.toFixed(2) + "x";
    
    // Cohete
    const rocket = document.getElementById('rocketIcon');
    const rot = (mult * 2) % 5;
    rocket.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${1 + mult/100})`;

    // Actualizar texto botón retirar (sin cambiar estado)
    if(currentCrashBet > 0 && !hasCashedOut) {
        const win = (currentCrashBet * mult).toFixed(2);
        const btn = document.getElementById('btnCashout');
        btn.innerHTML = `<span>RETIRAR</span> <small style="color:#00ff88">+${win}$</small>`;
        
        // Parche de seguridad: asegurar que esté habilitado
        if(btn.disabled) {
            btn.disabled = false;
            btn.classList.remove('hidden');
            btn.style.background = "#ffbe0b";
        }
    }
});

socket.on('crash_boom', (data) => {
    lastGameState = 'CRASHED';
    updateCrashUI('CRASHED', data.crash_point, 0);
    updateButtons();
    
    // Opcional: Resetear variable visualmente tras unos segundos para permitir apostar rápido
    setTimeout(() => {
        if(lastGameState === 'CRASHED') {
            // currentCrashBet = 0; // Esperamos al cambio de estado real para borrar la variable lógica
            // Pero podemos preparar la UI
        }
    }, 2000);
});

// ACCIONES
socket.on('bet_accepted', (data) => {
    currentCrashBet = data.amount;
    hasCashedOut = false;
    updateGlobalBalance(data.new_balance);
    showToast("Apuesta aceptada", "success");
    updateButtons();
});

socket.on('cashout_success', (data) => {
    hasCashedOut = true;
    updateGlobalBalance(data.new_balance);
    showToast(`Ganaste +${parseFloat(data.win).toFixed(2)}$`, "success");
    updateButtons();
});

socket.on('error_msg', (data) => {
    showToast(data.msg, 'error');
    // Desbloquear botón apostar si falló
    const btn = document.getElementById('btnBet');
    btn.disabled = false;
    btn.querySelector('span').innerText = "APOSTAR";
});

// EVENTOS TABLA
socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));


// === FUNCIONES UI CENTRALIZADAS ===

function updateCrashUI(state, mult, time) {
    const display = document.getElementById('crashDisplay');
    const statusBadge = document.getElementById('crashStatusText');
    const multText = document.getElementById('crashMultiplier');

    // Resetear clases
    display.classList.remove('running', 'crashed');
    statusBadge.classList.remove('waiting', 'crashed');
    document.getElementById('winOverlay').classList.add('hidden');

    if (state === 'IDLE') {
        statusBadge.innerText = "ESPERANDO JUGADORES...";
        statusBadge.style.display = "block";
        multText.innerText = "1.00x";
    } 
    else if (state === 'WAITING') {
        const t = Math.max(0, time).toFixed(1);
        statusBadge.innerText = `INICIO EN ${t}s`;
        statusBadge.classList.add('waiting'); // Color amarillo
        statusBadge.style.display = "block";
        multText.innerText = "1.00x";
    } 
    else if (state === 'RUNNING') {
        statusBadge.style.display = "none"; // Ocultar badge
        display.classList.add('running');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
    } 
    else if (state === 'CRASHED') {
        statusBadge.innerText = "CRASHED";
        statusBadge.classList.add('crashed'); // Color rojo
        statusBadge.style.display = "block";
        display.classList.add('crashed');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
    }
}

function updateButtons() {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');
    const state = lastGameState;

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
            // El texto se pone en crash_tick
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
            // Espectador (Prepara el botón para la siguiente)
            btnCash.classList.add('hidden');
            btnBet.classList.remove('hidden');
            btnBet.disabled = true;
            btnBet.innerHTML = `<span>ESPERANDO...</span>`;
        }
    }
}

// ACCIONES
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

// UTILS Y TABLA
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

// GLOBAL UTILS
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
function navigate(viewId) { if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) return openModal('loginModal'); document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); const target = document.getElementById('view-' + viewId); if(target) target.classList.remove('hidden'); document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); const navItem = document.getElementById('nav-' + viewId); if(navItem) navItem.classList.add('active'); if(viewId !== 'games') { document.getElementById('gameInterface-crash').classList.add('hidden'); document.getElementById('gamesMenu').classList.remove('hidden'); } window.scrollTo(0, 0); }
async function checkSession() { try { const res = await fetch('/api/check_session'); const data = await res.json(); if (data.logged_in) { currentUser = data.user; updateGlobalBalance(data.saldo); document.getElementById('guestNav').classList.add('hidden'); document.getElementById('loggedNav').classList.remove('hidden'); document.getElementById('desktopLogout').classList.remove('hidden'); document.getElementById('profileUsername').innerText = data.user; const url = data.avatar !== 'default.png' ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'; if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url; if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url; } } catch (e) {} }

// RESTO DE FUNCIONES (Auth, Pagos, Chat)
async function doLogin() {const u=document.getElementById('loginUser').value;const p=document.getElementById('loginPass').value;const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();if(d.status==='success')window.location.reload();else if(d.status==='unverified'){pendingEmail=d.email;document.getElementById('verifyEmailDisplay').innerText=pendingEmail;closeModal('loginModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doRegister() {const u=document.getElementById('regUser').value;const p=document.getElementById('regPass').value;const e=document.getElementById('regEmail').value;const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:e})});const d=await r.json();if(d.status==='verify_needed'){pendingEmail=e;document.getElementById('verifyEmailDisplay').innerText=pendingEmail;closeModal('registerModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doVerify() {const c=document.getElementById('verifyCodeInput').value;const r=await fetch('/api/verify_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:pendingEmail,code:c})});const d=await r.json();if(d.status==='success')window.location.reload();else showToast(d.message,'error');}
async function doLogout() {await fetch('/api/logout');window.location.reload();}
async function sendForgotCode() {const e=document.getElementById('forgotEmail').value;const r=await fetch('/api/forgot_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e})});const d=await r.json();if(d.status==='success'){recoveryEmail=e;switchModal('forgotModal','resetModal');}else showToast(d.message,'error');}
async function doResetPassword() {const c=document.getElementById('resetCode').value;const n=document.getElementById('resetNewPass').value;const r=await fetch('/api/reset_password_with_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:recoveryEmail,code:c,password:n})});const d=await r.json();if(d.status==='success'){showToast("Hecho",'success');switchModal('resetModal','loginModal');}else showToast(d.message,'error');}
async function uploadAvatar() {const i=document.getElementById('avatarInput');if(i.files.length===0)return;const f=new FormData();f.append('file',i.files[0]);const r=await fetch('/api/upload_avatar',{method:'POST',body:f});const d=await r.json();if(d.status==='success'){showToast("Avatar OK",'success');setTimeout(()=>window.location.reload(),1000);}}
function togglePasswordEdit() {document.getElementById('passwordEditSection').classList.toggle('hidden');}
async function changePassword() {const c=document.getElementById('currentPass').value;const n=document.getElementById('newPass1').value;const r=await fetch('/api/change_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:c,new:n})});const d=await r.json();if(d.status==='success'){showToast("Clave cambiada",'success');togglePasswordEdit();}else showToast(d.message,'error');}
function renderMessage(d,b){const div=document.createElement('div');div.className=(currentUser&&d.username===currentUser)?'chat-msg mine':'chat-msg theirs';let a=d.avatar!=='default.png'?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';div.innerHTML=`<img src="${a}" class="chat-avatar"><div class="msg-content">${div.className.includes('theirs')?`<span class="msg-username">${d.username}</span>`:''}${d.message.replace(/</g,"&lt;")}</div>`;b.appendChild(div);}
socket.on('chat_history',(d)=>{const b=document.getElementById('chatMessages');b.innerHTML='';d.messages.forEach(m=>renderMessage(m,b));b.scrollTop=b.scrollHeight;});
socket.on('new_message',(d)=>{const b=document.getElementById('chatMessages');renderMessage(d,b);b.scrollTop=b.scrollHeight;});
function toggleChat(){document.getElementById('chatSidebar').classList.toggle('closed');}
function sendMessage(){if(!currentUser)return openModal('loginModal');const i=document.getElementById('chatInput');if(i.value.trim()){socket.emit('send_message',{message:i.value});i.value='';}}
let selectedCurrency='btc';
function selectCrypto(c){selectedCurrency=c;document.querySelectorAll('.crypto-option').forEach(e=>e.classList.remove('selected'));document.getElementById('opt-'+c).classList.add('selected');}
async function createPayment(){const a=document.getElementById('depositAmount').value;const r=await fetch('/api/create_payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:a,currency:selectedCurrency})});const d=await r.json();if(d.status==='success'){document.getElementById('depositForm').classList.add('hidden');document.getElementById('depositWaiting').classList.remove('hidden');document.getElementById('payAmountDisplay').innerText=d.pay_amount;document.getElementById('payAddressDisplay').innerText=d.pay_address;startPaymentPolling(d.payment_id);}}
function startPaymentPolling(pid){paymentInterval=setInterval(async()=>{const r=await fetch('/api/check_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:pid})});const d=await r.json();if(d.payment_status==='finished'){clearInterval(paymentInterval);showToast("Pago OK",'success');setTimeout(()=>window.location.reload(),2000);}},3000);}
function cancelPayment(){clearInterval(paymentInterval);document.getElementById('depositWaiting').classList.add('hidden');document.getElementById('depositForm').classList.remove('hidden');}
function copyAddress(){navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText);showToast("Copiado",'info');}