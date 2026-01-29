let currentUser = null;
let currentCrashBet = 0; 
let hasCashedOut = false; 
let roundEnded = false; // <--- NUEVA VARIABLE CRÍTICA
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
    // Restaurar variables
    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        hasCashedOut = data.my_bet.cashed_out;
    } else {
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    
    // Si entramos y está explotado, marcamos fin de ronda
    if(data.state === 'CRASHED') roundEnded = true;
    else roundEnded = false;

    // UI
    updateCrashTexts(data.state, data.multiplier, data.time_left);
    decideButtonState(data.state);

    // Tabla
    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });
});

socket.on('crash_status', (data) => {
    // === LÓGICA DE LIMPIEZA DE RONDA (EL ARREGLO DEL BOTÓN) ===
    // Si el servidor está en IDLE o WAITING y nosotros venimos de un final de ronda...
    if ((data.status === 'IDLE' || data.status === 'WAITING') && roundEnded) {
        console.log("Limpiando ronda anterior...");
        currentCrashBet = 0;
        hasCashedOut = false;
        roundEnded = false; // Ya estamos limpios
        
        // Limpiar tabla de ganadores antiguos
        document.getElementById('crashPlayersList').innerHTML = '';
    }

    updateCrashTexts(data.status, 1.00, data.time_left);
    decideButtonState(data.status);
});

socket.on('crash_start', () => {
    roundEnded = false;
    updateCrashTexts('RUNNING', 1.00, 0);
    decideButtonState('RUNNING');
});

socket.on('crash_tick', (data) => {
    const mult = data.multiplier;
    document.getElementById('crashMultiplier').innerText = mult.toFixed(2) + "x";
    
    const rocket = document.getElementById('rocketIcon');
    const rot = (mult * 2) % 5;
    rocket.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${1 + mult/100})`;

    if(currentCrashBet > 0 && !hasCashedOut) {
        const btn = document.getElementById('btnCashout');
        const win = (currentCrashBet * mult).toFixed(2);
        btn.innerHTML = `<span>RETIRAR</span> <small style="color:#00ff88">+${win}$</small>`;
        
        // Fuerza bruta para desbloquear botón
        if(btn.disabled) {
            btn.disabled = false;
            btn.classList.remove('hidden');
            btn.style.background = "#ffbe0b"; 
        }
    }
});

socket.on('crash_boom', (data) => {
    roundEnded = true; // MARCAMOS EL FIN DE RONDA
    updateCrashTexts('CRASHED', data.crash_point, 0);
    decideButtonState('CRASHED');
});

// ACCIONES
socket.on('bet_accepted', (data) => {
    currentCrashBet = data.amount;
    hasCashedOut = false;
    roundEnded = false; // Nueva apuesta, nueva vida
    updateGlobalBalance(data.new_balance);
    showToast("Apuesta aceptada", "success");
    decideButtonState('WAITING'); 
});

socket.on('cashout_success', (data) => {
    hasCashedOut = true;
    updateGlobalBalance(data.new_balance);
    showToast(`Ganaste +${parseFloat(data.win).toFixed(2)}$`, "success");
    decideButtonState('RUNNING');
});

socket.on('error_msg', (data) => {
    showToast(data.msg, 'error');
    // Reactivar botón si falló
    const btn = document.getElementById('btnBet');
    if(btn.disabled && currentCrashBet === 0) {
        btn.disabled = false;
        btn.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
    }
});

socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));


// === UI HELPERS ===

function updateCrashTexts(state, mult, time) {
    const display = document.getElementById('crashDisplay');
    const statusText = document.getElementById('crashStatusText');
    const multText = document.getElementById('crashMultiplier');

    // Limpieza de clases
    display.classList.remove('running', 'crashed');
    document.getElementById('winOverlay').classList.add('hidden');

    if (state === 'IDLE') {
        statusText.innerHTML = "ESPERANDO JUGADORES...";
        statusText.className = "status-badge"; 
        multText.innerText = "1.00x";
    } 
    else if (state === 'WAITING') {
        // ARREGLO CUENTA ATRÁS
        const t = Math.max(0, parseFloat(time)).toFixed(1);
        statusText.innerHTML = `INICIO EN <b style="color:#fff; font-size:1.4rem;">${t}s</b>`;
        statusText.className = "status-badge waiting";
        multText.innerText = "1.00x";
    } 
    else if (state === 'RUNNING') {
        statusText.innerText = "";
        display.classList.add('running');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
    } 
    else if (state === 'CRASHED') {
        statusText.innerText = "CRASHED";
        display.classList.add('crashed');
        multText.innerText = parseFloat(mult).toFixed(2) + "x";
    }
}

function decideButtonState(gameState) {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');

    // 1. FASE APUESTAS
    if (gameState === 'IDLE' || gameState === 'WAITING') {
        if (currentCrashBet === 0) {
            // HABILITADO PARA APOSTAR
            btnBet.classList.remove('hidden'); 
            btnBet.disabled = false; 
            btnBet.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
            btnCash.classList.add('hidden');
        } else {
            // YA APOSTADO
            btnBet.classList.add('hidden');
            btnCash.classList.remove('hidden'); 
            btnCash.disabled = true; 
            btnCash.style.background = "#30363d";
            btnCash.innerHTML = `<span>APOSTADO</span><small>${currentCrashBet}$</small>`;
        }
    } 
    // 2. FASE JUEGO
    else if (gameState === 'RUNNING') {
        btnBet.classList.add('hidden');
        if (currentCrashBet > 0 && !hasCashedOut) {
            // BOTÓN RETIRAR ACTIVO
            btnCash.classList.remove('hidden'); 
            btnCash.disabled = false; 
            btnCash.style.background = "#ffbe0b";
        } else if (currentCrashBet > 0 && hasCashedOut) {
            // GANADO
            btnCash.classList.remove('hidden'); btnCash.disabled = true; 
            btnCash.style.background = "#00ff88"; btnCash.style.color = "#000";
            btnCash.innerHTML = `<span>GANADO</span><small>¡Bien hecho!</small>`;
        } else {
            // ESPECTADOR
            btnCash.classList.add('hidden');
        }
    } 
    // 3. FASE CRASHED
    else if (gameState === 'CRASHED') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden'); btnCash.disabled = true;
        
        if (currentCrashBet > 0 && !hasCashedOut) {
            // PERDIDO
            btnCash.style.background = "#ff4757"; btnCash.style.color = "#fff";
            btnCash.innerHTML = `<span>PERDIDO</span><small>Intenta de nuevo</small>`;
        } else if (currentCrashBet > 0 && hasCashedOut) {
            // GANADO
            btnCash.style.background = "#00ff88"; btnCash.style.color = "#000";
            btnCash.innerHTML = `<span>GANADO</span><small>¡Bien hecho!</small>`;
        } else {
            // ESPECTADOR
            btnCash.classList.add('hidden');
            // Mostrar botón apostar desactivado para feedback visual
            btnBet.classList.remove('hidden'); btnBet.disabled = true;
            btnBet.innerHTML = `<span>ESPERANDO...</span>`;
        }
    }
}

// RESTO DE FUNCIONES (IGUAL QUE ANTES)
function placeBet() {
    const amount = parseFloat(document.getElementById('betInput').value);
    if(isNaN(amount) || amount <= 0) return showToast("Monto inválido", "error");
    const btn = document.getElementById('btnBet');
    btn.disabled = true; btn.querySelector('span').innerText = "ENVIANDO...";
    socket.emit('place_bet_crash', {amount: amount});
}
function doCashOut() { socket.emit('cash_out_crash'); document.getElementById('btnCashout').disabled = true; }
function modifyBet(type) { const i=document.getElementById('betInput'); let v=parseFloat(i.value); if(type==='half')v=Math.max(1,v/2); if(type==='double')v=v*2; i.value=v.toFixed(2); }
function addPlayerToTable(data) { const list=document.getElementById('crashPlayersList'); if(document.getElementById(`player-${data.username}`))return; const row=document.createElement('div'); row.className='player-row'; row.id=`player-${data.username}`; let ava=data.avatar?`/static/uploads/${data.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'; row.innerHTML=`<div style="display:flex;align-items:center;gap:10px;"><img src="${ava}" style="width:24px;height:24px;border-radius:50%;"><span>${data.username}</span></div><div style="color:#ffbe0b;font-weight:bold;">${data.amount}$</div>`; list.appendChild(row); }
function markPlayerWin(username, win, mult) { const row=document.getElementById(`player-${username}`); if(row){ row.classList.add('winner'); if(!row.querySelector('.win-badge-btn')) row.innerHTML+=`<div class="win-badge-btn" style="margin-left:auto;background:rgba(0,255,136,0.2);color:#00ff88;padding:2px 6px;border-radius:4px;font-size:0.8rem;font-weight:bold;">+${parseFloat(win).toFixed(2)}$ (${mult}x)</div>`; } }
function showToast(message, type = 'info') { const c=document.getElementById('toast-container'); const t=document.createElement('div'); t.className=`toast toast-${type}`; t.innerHTML=`<span>${message}</span>`; c.appendChild(t); setTimeout(()=>{t.classList.add('removing');setTimeout(()=>t.remove(),400);},3000); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }
function navigate(viewId) { if((viewId==='deposit'||viewId==='profile')&&!currentUser)return openModal('loginModal'); document.querySelectorAll('.view-section').forEach(el=>el.classList.add('hidden')); document.getElementById('view-'+viewId).classList.remove('hidden'); document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active')); const n=document.getElementById('nav-'+viewId); if(n)n.classList.add('active'); if(viewId!=='games'){document.getElementById('gameInterface-crash').classList.add('hidden');document.getElementById('gamesMenu').classList.remove('hidden');} window.scrollTo(0,0); }
async function checkSession() { try{const r=await fetch('/api/check_session');const d=await r.json();if(d.logged_in){currentUser=d.user;updateGlobalBalance(d.saldo);document.getElementById('guestNav').classList.add('hidden');document.getElementById('loggedNav').classList.remove('hidden');document.getElementById('desktopLogout').classList.remove('hidden');document.getElementById('profileUsername').innerText=d.user;const u=d.avatar!=='default.png'?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';if(document.getElementById('navAvatarImg'))document.getElementById('navAvatarImg').src=u;if(document.getElementById('profileAvatarBig'))document.getElementById('profileAvatarBig').src=u;}}catch(e){} }
async function doLogin(){const u=document.getElementById('loginUser').value;const p=document.getElementById('loginPass').value;const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();if(d.status==='success')window.location.reload();else if(d.status==='unverified'){pendingEmail=d.email;document.getElementById('verifyEmailDisplay').innerText=pendingEmail;closeModal('loginModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doRegister(){const u=document.getElementById('regUser').value;const p=document.getElementById('regPass').value;const e=document.getElementById('regEmail').value;const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:e})});const d=await r.json();if(d.status==='verify_needed'){pendingEmail=e;document.getElementById('verifyEmailDisplay').innerText=pendingEmail;closeModal('registerModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doVerify(){const c=document.getElementById('verifyCodeInput').value;const r=await fetch('/api/verify_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:pendingEmail,code:c})});const d=await r.json();if(d.status==='success')window.location.reload();else showToast(d.message,'error');}
async function doLogout(){await fetch('/api/logout');window.location.reload();}
async function sendForgotCode(){const e=document.getElementById('forgotEmail').value;const r=await fetch('/api/forgot_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e})});const d=await r.json();if(d.status==='success'){recoveryEmail=e;switchModal('forgotModal','resetModal');}else showToast(d.message,'error');}
async function doResetPassword(){const c=document.getElementById('resetCode').value;const n=document.getElementById('resetNewPass').value;const r=await fetch('/api/reset_password_with_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:recoveryEmail,code:c,password:n})});const d=await r.json();if(d.status==='success'){showToast("Hecho",'success');switchModal('resetModal','loginModal');}else showToast(d.message,'error');}
async function uploadAvatar(){const i=document.getElementById('avatarInput');if(i.files.length===0)return;const f=new FormData();f.append('file',i.files[0]);const r=await fetch('/api/upload_avatar',{method:'POST',body:f});const d=await r.json();if(d.status==='success'){showToast("Avatar OK",'success');setTimeout(()=>window.location.reload(),1000);}}
function togglePasswordEdit(){document.getElementById('passwordEditSection').classList.toggle('hidden');}
async function changePassword(){const c=document.getElementById('currentPass').value;const n=document.getElementById('newPass1').value;const r=await fetch('/api/change_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:c,new:n})});const d=await r.json();if(d.status==='success'){showToast("Clave cambiada",'success');togglePasswordEdit();}else showToast(d.message,'error');}
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