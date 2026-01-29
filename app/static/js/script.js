let currentUser = null;
let currentCrashBet = 0;
let hasCashedOut = false;
let lastGameState = "";
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

socket.on('disconnect', () => showToast("🔴 Conexión perdida", "error"));

// 2. SALDO
function updateGlobalBalance(n){const f=parseFloat(n).toFixed(2);const b=document.getElementById('userBalance');if(b){b.innerText=f;b.style.color="#00ff88";setTimeout(()=>b.style.color="",500);}const p=document.getElementById('profileBalanceDisplay');if(p)p.innerText=f;}
socket.on('balance_update',(d)=>updateGlobalBalance(d.saldo));

// 3. NAVEGACIÓN
function enterGame(n){if(!currentUser)return openModal('loginModal');if(n==='crash'){document.getElementById('gamesMenu').classList.add('hidden');document.getElementById('gameInterface-crash').classList.remove('hidden');socket.emit('join_crash');}}
function backToGames(){document.getElementById('gameInterface-crash').classList.add('hidden');document.getElementById('gamesMenu').classList.remove('hidden');}
function showLayer(id){document.getElementById('gameLayer').className='layer hidden';document.getElementById('waitingLayer').className='layer hidden';document.getElementById('crashedLayer').className='layer hidden';document.getElementById(id).className='layer visible';}

// === SOCKETS CRASH ===

socket.on('crash_sync', (data) => {
    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        hasCashedOut = data.my_bet.cashed_out;
    } else {
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    lastGameState = data.state;
    handleGameState(data.state, data.multiplier, data.time_left);
    updateButtons(data.state);

    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });
});

socket.on('crash_status', (data) => {
    if (lastGameState === 'CRASHED' && (data.status === 'IDLE' || data.status === 'WAITING')) {
        document.getElementById('crashPlayersList').innerHTML = '';
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    lastGameState = data.status;
    handleGameState(data.status, 1.00, data.time_left);
    updateButtons(data.status);
});

socket.on('crash_start', () => {
    lastGameState = 'RUNNING';
    handleGameState('RUNNING', 1.00, 0);
    updateButtons('RUNNING');
});

socket.on('crash_tick', (data) => {
    document.getElementById('crashMultiplier').innerText = data.multiplier.toFixed(2) + "x";
    
    // Cohete
    const rocket = document.getElementById('rocketIcon');
    const rot = (data.multiplier * 2) % 5;
    rocket.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${1 + data.multiplier/100})`;

    // === SOLUCIÓN AL PROBLEMA DE CLIC ===
    // Solo actualizamos el TEXTO, no el botón entero.
    if(currentCrashBet > 0 && !hasCashedOut) {
        const winAmount = (currentCrashBet * data.multiplier).toFixed(2);
        
        // Actualizar solo los spans internos (DOM Reflow mínimo)
        const txtLabel = document.getElementById('cashText');
        const txtAmount = document.getElementById('cashAmount');
        
        if(txtLabel) txtLabel.innerText = "RETIRAR";
        if(txtAmount) txtAmount.innerText = `+${winAmount}$`;

        // Asegurar que esté habilitado (solo tocamos la propiedad si es necesario)
        const btn = document.getElementById('btnCashout');
        if(btn.disabled) btn.disabled = false;
    }
});

socket.on('crash_boom', (data) => {
    lastGameState = 'CRASHED';
    handleGameState('CRASHED', data.crash_point, 0);
    updateButtons('CRASHED');
    setTimeout(() => { currentCrashBet = 0; hasCashedOut = false; }, 3000);
});

// ACCIONES
socket.on('bet_accepted', (data) => {
    currentCrashBet = data.amount;
    hasCashedOut = false;
    updateGlobalBalance(data.new_balance);
    showToast("Apuesta aceptada", "success");
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
    const btn = document.getElementById('btnBet');
    if(btn.disabled && currentCrashBet === 0) {
        btn.disabled = false;
        btn.querySelector('span').innerText = "APOSTAR";
    }
});

socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));

// UI HELPERS
function handleGameState(state, mult, time) {
    const timeNum = parseFloat(time);
    if (state === 'IDLE') {
        showLayer('waitingLayer');
        document.getElementById('countdownBig').innerText = "ESPERANDO...";
        document.getElementById('progressBarFill').style.width = "0%";
    } else if (state === 'WAITING') {
        showLayer('waitingLayer');
        document.getElementById('countdownBig').innerText = timeNum.toFixed(1) + "s";
        document.getElementById('progressBarFill').style.width = ((timeNum / 15) * 100) + "%";
    } else if (state === 'RUNNING') {
        showLayer('gameLayer');
    } else if (state === 'CRASHED') {
        showLayer('crashedLayer');
        document.getElementById('finalCrashPoint').innerText = "@ " + parseFloat(mult).toFixed(2) + "x";
    }
}

function updateButtons(state) {
    const btnBet = document.getElementById('btnBet');
    const btnCash = document.getElementById('btnCashout');

    if (state === 'IDLE' || state === 'WAITING') {
        if (currentCrashBet === 0) {
            btnBet.classList.remove('hidden'); btnBet.disabled = false;
            btnBet.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
            btnCash.classList.add('hidden');
        } else {
            btnBet.classList.add('hidden');
            btnCash.classList.remove('hidden'); btnCash.disabled = true;
            btnCash.style.background = "#30363d";
            document.getElementById('cashText').innerText = "APOSTADO";
            document.getElementById('cashAmount').innerText = currentCrashBet;
        }
    } else if (state === 'RUNNING') {
        btnBet.classList.add('hidden');
        if (currentCrashBet > 0 && !hasCashedOut) {
            btnCash.classList.remove('hidden'); btnCash.disabled = false;
            btnCash.style.background = "#ffbe0b";
            // El texto se actualiza en crash_tick
        } else if (currentCrashBet > 0 && hasCashedOut) {
            btnCash.classList.remove('hidden'); btnCash.disabled = true;
            btnCash.style.background = "#00ff88"; btnCash.style.color = "black";
            document.getElementById('cashText').innerText = "GANADO";
            document.getElementById('cashAmount').innerText = "¡Bien!";
        } else {
            btnCash.classList.add('hidden');
        }
    } else if (state === 'CRASHED') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden'); btnCash.disabled = true;
        if(currentCrashBet > 0 && !hasCashedOut) {
            btnCash.style.background = "#ff4757"; btnCash.style.color = "white";
            document.getElementById('cashText').innerText = "PERDIDO";
            document.getElementById('cashAmount').innerText = "-" + currentCrashBet;
        } else if (currentCrashBet > 0 && hasCashedOut) {
            btnCash.style.background = "#00ff88"; btnCash.style.color = "black";
            document.getElementById('cashText').innerText = "GANADO";
            document.getElementById('cashAmount').innerText = "¡Bien!";
        } else {
            btnCash.classList.add('hidden');
            btnBet.classList.remove('hidden'); btnBet.disabled = true;
            btnBet.innerHTML = `<span>ESPERANDO...</span>`;
        }
    }
}

// FUNCIONES USUARIO
function placeBet() { const a = parseFloat(document.getElementById('betInput').value); if(a>0) { document.getElementById('btnBet').disabled=true; socket.emit('place_bet_crash', {amount:a}); }}

function doCashOut() {
    // 1. Enviar evento
    socket.emit('cash_out_crash');
    
    // 2. Bloqueo inmediato para feedback visual y evitar doble clic
    const btn = document.getElementById('btnCashout');
    btn.disabled = true;
    document.getElementById('cashText').innerText = "PROCESANDO";
}

function modifyBet(type) { const i=document.getElementById('betInput'); let v=parseFloat(i.value); if(type==='half')v=Math.max(1,v/2); if(type==='double')v=v*2; i.value=v.toFixed(2); }
function addPlayerToTable(d) { const l=document.getElementById('crashPlayersList'); if(document.getElementById(`player-${d.username}`))return; const r=document.createElement('div'); r.className='player-row'; r.id=`player-${d.username}`; let a=d.avatar?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'; r.innerHTML=`<div style="display:flex;align-items:center;gap:10px;"><img src="${a}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;"><span style="font-weight:bold;color:#e6edf3;">${d.username}</span></div><div style="font-family:monospace;font-weight:bold;color:#ffbe0b;">${parseFloat(d.amount).toFixed(2)}$</div>`; l.appendChild(r); }
function markPlayerWin(u,w,m) { const r=document.getElementById(`player-${u}`); if(r){ r.classList.add('winner'); if(!r.querySelector('.win-badge-btn')) r.innerHTML+=`<div class="win-badge-btn" style="margin-left:auto;background:rgba(0,255,136,0.2);color:#00ff88;padding:2px 6px;border-radius:4px;font-size:0.8rem;font-weight:bold;">+${parseFloat(w).toFixed(2)}$ (${m}x)</div>`; } }

// UTILS GENÉRICOS
function showToast(m,t='info'){const c=document.getElementById('toast-container');const d=document.createElement('div');d.className=`toast toast-${t}`;d.innerHTML=`<span>${m}</span>`;c.appendChild(d);setTimeout(()=>{d.remove()},3000);}
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function switchModal(f,t){closeModal(f);openModal(t);}
function navigate(v){if((v==='deposit'||v==='profile')&&!currentUser)return openModal('loginModal');document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden'));document.getElementById('view-'+v).classList.remove('hidden');if(v!=='games'){document.getElementById('gameInterface-crash').classList.add('hidden');document.getElementById('gamesMenu').classList.remove('hidden');}window.scrollTo(0,0);}
async function checkSession(){try{const r=await fetch('/api/check_session');const d=await r.json();if(d.logged_in){currentUser=d.user;updateGlobalBalance(d.saldo);document.getElementById('guestNav').classList.add('hidden');document.getElementById('loggedNav').classList.remove('hidden');document.getElementById('desktopLogout').classList.remove('hidden');document.getElementById('profileUsername').innerText=d.user;const u=d.avatar!=='default.png'?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';if(document.getElementById('navAvatarImg'))document.getElementById('navAvatarImg').src=u;if(document.getElementById('profileAvatarBig'))document.getElementById('profileAvatarBig').src=u;}}catch(e){}}
async function doLogin(){const u=document.getElementById('loginUser').value;const p=document.getElementById('loginPass').value;const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();if(d.status==='success')window.location.reload();else if(d.status==='unverified'){pendingEmail=d.email;closeModal('loginModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doRegister(){const u=document.getElementById('regUser').value;const p=document.getElementById('regPass').value;const e=document.getElementById('regEmail').value;const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:e})});const d=await r.json();if(d.status==='verify_needed'){pendingEmail=e;closeModal('registerModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doVerify(){const c=document.getElementById('verifyCodeInput').value;const r=await fetch('/api/verify_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:pendingEmail,code:c})});const d=await r.json();if(d.status==='success')window.location.reload();else showToast(d.message,'error');}
async function doLogout(){await fetch('/api/logout');window.location.reload();}
// Chat/Pagos
function renderMessage(d,b){const div=document.createElement('div');div.className=(currentUser&&d.username===currentUser)?'chat-msg mine':'chat-msg theirs';let a=d.avatar!=='default.png'?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';div.innerHTML=`<img src="${a}" class="chat-avatar"><div class="msg-content">${div.className.includes('theirs')?`<span class="msg-username">${d.username}</span>`:''}${d.message}</div>`;b.appendChild(div);}
socket.on('chat_history',(d)=>{const b=document.getElementById('chatMessages');b.innerHTML='';d.messages.forEach(m=>renderMessage(m,b));b.scrollTop=b.scrollHeight;});
socket.on('new_message',(d)=>{const b=document.getElementById('chatMessages');renderMessage(d,b);b.scrollTop=b.scrollHeight;});
function toggleChat(){document.getElementById('chatSidebar').classList.toggle('closed');}
function sendMessage(){if(!currentUser)return openModal('loginModal');const i=document.getElementById('chatInput');if(i.value.trim()){socket.emit('send_message',{message:i.value});i.value='';}}
async function createPayment(){const a=document.getElementById('depositAmount').value;const r=await fetch('/api/create_payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:a,currency:'btc'})});const d=await r.json();if(d.status==='success'){document.getElementById('depositForm').classList.add('hidden');document.getElementById('depositWaiting').classList.remove('hidden');document.getElementById('payAmountDisplay').innerText=d.pay_amount;document.getElementById('payAddressDisplay').innerText=d.pay_address;startPaymentPolling(d.payment_id);}}
function startPaymentPolling(pid){paymentInterval=setInterval(async()=>{const r=await fetch('/api/check_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:pid})});const d=await r.json();if(d.payment_status==='finished'){clearInterval(paymentInterval);showToast("Pago OK",'success');setTimeout(()=>window.location.reload(),2000);}},3000);}
function cancelPayment(){clearInterval(paymentInterval);document.getElementById('depositWaiting').classList.add('hidden');document.getElementById('depositForm').classList.remove('hidden');}
function copyAddress(){navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText);showToast("Copiado",'info');}
function selectCrypto(c){document.querySelectorAll('.crypto-option').forEach(e=>e.classList.remove('selected'));document.getElementById('opt-'+c).classList.add('selected');}
// Otros (Password, Avatar, Forgot)
async function sendForgotCode(){const e=document.getElementById('forgotEmail').value;const r=await fetch('/api/forgot_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e})});const d=await r.json();if(d.status==='success'){recoveryEmail=e;switchModal('forgotModal','resetModal');}else showToast(d.message,'error');}
async function doResetPassword(){const c=document.getElementById('resetCode').value;const n=document.getElementById('resetNewPass').value;const r=await fetch('/api/reset_password_with_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:recoveryEmail,code:c,password:n})});const d=await r.json();if(d.status==='success'){showToast("Hecho",'success');switchModal('resetModal','loginModal');}else showToast(d.message,'error');}
async function uploadAvatar(){const i=document.getElementById('avatarInput');if(i.files.length===0)return;const f=new FormData();f.append('file',i.files[0]);const r=await fetch('/api/upload_avatar',{method:'POST',body:f});const d=await r.json();if(d.status==='success'){showToast("OK",'success');setTimeout(()=>window.location.reload(),1000);}}
function togglePasswordEdit(){document.getElementById('passwordEditSection').classList.toggle('hidden');}
async function changePassword(){const c=document.getElementById('currentPass').value;const n=document.getElementById('newPass1').value;const r=await fetch('/api/change_password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:c,new:n})});const d=await r.json();if(d.status==='success'){showToast("OK",'success');togglePasswordEdit();}else showToast(d.message,'error');}