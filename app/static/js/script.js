let currentUser = null;
let currentCrashBet = 0;
let hasCashedOut = false;
let lastGameState = "";
let pendingEmail = "";
let recoveryEmail = "";
let paymentInterval = null;
const socket = io();

// 1. INICIO
document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    checkSession();
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
});

socket.on('disconnect', () => showToast("🔴 Conexión perdida", "error"));

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

// === CAPAS VISUALES ===
function showLayer(layerId) {
    document.getElementById('gameLayer').className = 'layer hidden';
    document.getElementById('waitingLayer').className = 'layer hidden';
    document.getElementById('crashedLayer').className = 'layer hidden';
    document.getElementById(layerId).className = 'layer visible';
}

// === SOCKETS CRASH ===

socket.on('crash_sync', (data) => {
    // Restaurar mis datos
    if (data.my_bet) {
        currentCrashBet = data.my_bet.amount;
        hasCashedOut = data.my_bet.cashed_out;
    } else {
        currentCrashBet = 0;
        hasCashedOut = false;
    }
    lastGameState = data.state;

    // Restaurar UI
    handleGameState(data.state, data.multiplier, data.time_left);
    updateButtons(data.state);

    // Restaurar Tabla (Limpia y rellena)
    const list = document.getElementById('crashPlayersList');
    list.innerHTML = '';
    data.players.forEach(p => {
        addPlayerToTable(p);
        if(p.cashed_out) markPlayerWin(p.username, p.win, p.mult);
    });
});

socket.on('crash_status', (data) => {
    // === FIX 1: LIMPIEZA DE TABLA AL CAMBIAR DE RONDA ===
    // Si la ronda anterior terminó (CRASHED) y ahora entramos en IDLE o WAITING
    if (lastGameState === 'CRASHED' && (data.status === 'IDLE' || data.status === 'WAITING')) {
        console.log("🔄 Nueva ronda: Limpiando tabla y apuestas...");
        
        // 1. Borrar Tabla
        document.getElementById('crashPlayersList').innerHTML = '';
        
        // 2. Resetear variables locales
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
    
    if(currentCrashBet > 0 && !hasCashedOut) {
        const win = (currentCrashBet * data.multiplier).toFixed(2);
        const btn = document.getElementById('btnCashout');
        btn.innerHTML = `<span>RETIRAR</span> <small style="color:#00ff88">+${win}$</small>`;
        if(btn.disabled) btn.disabled = false;
    }
});

socket.on('crash_boom', (data) => {
    lastGameState = 'CRASHED';
    handleGameState('CRASHED', data.crash_point, 0);
    updateButtons('CRASHED');
    
    // Auto-limpieza de seguridad a los 3s
    setTimeout(() => {
        currentCrashBet = 0;
        hasCashedOut = false;
    }, 3000);
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
        btn.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
    }
});

// === FIX 2: TABLA ROBUSTA ===
socket.on('new_bet_crash', (data) => addPlayerToTable(data));
socket.on('player_cashed_out', (data) => markPlayerWin(data.username, data.win, data.mult));

function addPlayerToTable(data) {
    const list = document.getElementById('crashPlayersList');
    
    // Evitar duplicados (Importante)
    if(document.getElementById(`player-${data.username}`)) return;

    const row = document.createElement('div');
    row.className = 'player-row';
    row.id = `player-${data.username}`;
    
    let avatar = data.avatar ? `/static/uploads/${data.avatar}` : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    
    // Usamos data.amount DIRECTAMENTE, sin variables globales que puedan contaminarse
    const safeAmount = parseFloat(data.amount).toFixed(2); // Forzar formato número

    row.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <img src="${avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
            <span style="font-weight:bold; color:#e6edf3;">${data.username}</span>
        </div>
        <div style="font-family:monospace; font-size:1rem; font-weight:bold; color:#ffbe0b;">${safeAmount}$</div>
    `;
    list.appendChild(row);
}

function markPlayerWin(username, win, mult) {
    const row = document.getElementById(`player-${username}`);
    if(row) {
        row.classList.add('winner');
        // Check si ya tiene el badge para no repetirlo
        if(!row.querySelector('.win-badge-btn')) {
            row.innerHTML += `
                <div class="win-badge-btn" style="margin-left:auto; background:rgba(0,255,136,0.2); color:#00ff88; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:bold;">
                    +${parseFloat(win).toFixed(2)}$ (${mult}x)
                </div>
            `;
        }
    }
}

// === GESTOR DE ESTADOS ===
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

    // FASE APUESTAS
    if (state === 'IDLE' || state === 'WAITING') {
        if (currentCrashBet === 0) {
            btnBet.classList.remove('hidden'); btnBet.disabled = false;
            btnBet.innerHTML = `<span>APOSTAR</span><small>Próxima Ronda</small>`;
            btnCash.classList.add('hidden');
        } else {
            btnBet.classList.add('hidden');
            btnCash.classList.remove('hidden'); btnCash.disabled = true;
            btnCash.style.background = "#30363d";
            btnCash.innerHTML = `<span>APOSTADO</span><small>${currentCrashBet}</small>`;
        }
    }
    // FASE JUEGO
    else if (state === 'RUNNING') {
        btnBet.classList.add('hidden');
        if (currentCrashBet > 0 && !hasCashedOut) {
            btnCash.classList.remove('hidden'); btnCash.disabled = false;
            btnCash.style.background = "#ffbe0b";
        } else if (currentCrashBet > 0 && hasCashedOut) {
            btnCash.classList.remove('hidden'); btnCash.disabled = true;
            btnCash.style.background = "#00ff88"; btnCash.style.color = "black";
            btnCash.innerHTML = `<span>GANADO</span>`;
        } else {
            btnCash.classList.add('hidden');
        }
    }
    // FASE CRASH
    else if (state === 'CRASHED') {
        btnBet.classList.add('hidden');
        btnCash.classList.remove('hidden'); btnCash.disabled = true;
        if(currentCrashBet > 0 && !hasCashedOut) {
            btnCash.style.background = "#ff4757"; btnCash.style.color = "white";
            btnCash.innerHTML = `<span>PERDIDO</span>`;
        } else if (currentCrashBet > 0 && hasCashedOut) {
            btnCash.style.background = "#00ff88"; btnCash.style.color = "black";
            btnCash.innerHTML = `<span>GANADO</span>`;
        } else {
            btnCash.classList.add('hidden');
            btnBet.classList.remove('hidden'); btnBet.disabled = true;
            btnBet.innerHTML = `<span>ESPERANDO...</span>`;
        }
    }
}

// RESTO DE FUNCIONES (IGUALES)
function placeBet() { const a = parseFloat(document.getElementById('betInput').value); if(a>0) { document.getElementById('btnBet').disabled=true; socket.emit('place_bet_crash', {amount:a}); }}
function doCashOut() { socket.emit('cash_out_crash'); document.getElementById('btnCashout').disabled = true; }
function modifyBet(type) { const i=document.getElementById('betInput'); let v=parseFloat(i.value); if(type==='half')v=Math.max(1,v/2); if(type==='double')v=v*2; i.value=v.toFixed(2); }
function showToast(m,t='info'){const c=document.getElementById('toast-container');const d=document.createElement('div');d.className=`toast toast-${t}`;d.innerHTML=`<span>${m}</span>`;c.appendChild(d);setTimeout(()=>d.remove(),3000);}
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function switchModal(f,t){closeModal(f);openModal(t);}
function navigate(v){if((v==='deposit'||v==='profile')&&!currentUser)return openModal('loginModal');document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden'));document.getElementById('view-'+v).classList.remove('hidden');if(v!=='games'){document.getElementById('gameInterface-crash').classList.add('hidden');document.getElementById('gamesMenu').classList.remove('hidden');}}
async function checkSession(){try{const r=await fetch('/api/check_session');const d=await r.json();if(d.logged_in){currentUser=d.user;updateGlobalBalance(d.saldo);document.getElementById('guestNav').classList.add('hidden');document.getElementById('loggedNav').classList.remove('hidden');document.getElementById('desktopLogout').classList.remove('hidden');}}catch(e){}}
async function doLogin(){const u=document.getElementById('loginUser').value;const p=document.getElementById('loginPass').value;const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();if(d.status==='success')window.location.reload();else if(d.status==='unverified'){pendingEmail=d.email;closeModal('loginModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doRegister(){const u=document.getElementById('regUser').value;const p=document.getElementById('regPass').value;const e=document.getElementById('regEmail').value;const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,email:e})});const d=await r.json();if(d.status==='verify_needed'){pendingEmail=e;closeModal('registerModal');openModal('verifyModal');}else showToast(d.message,'error');}
async function doVerify(){const c=document.getElementById('verifyCodeInput').value;const r=await fetch('/api/verify_code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:pendingEmail,code:c})});const d=await r.json();if(d.status==='success')window.location.reload();else showToast(d.message,'error');}
async function doLogout(){await fetch('/api/logout');window.location.reload();}
function renderMessage(d,b){const div=document.createElement('div');div.className=(currentUser&&d.username===currentUser)?'chat-msg mine':'chat-msg theirs';let a=d.avatar!=='default.png'?`/static/uploads/${d.avatar}`:'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';div.innerHTML=`<img src="${a}" class="chat-avatar"><div class="msg-content">${div.className.includes('theirs')?`<span class="msg-username">${d.username}</span>`:''}${d.message}</div>`;b.appendChild(div);}
socket.on('chat_history',(d)=>{const b=document.getElementById('chatMessages');b.innerHTML='';d.messages.forEach(m=>renderMessage(m,b));b.scrollTop=b.scrollHeight;});
socket.on('new_message',(d)=>{const b=document.getElementById('chatMessages');renderMessage(d,b);b.scrollTop=b.scrollHeight;});
function toggleChat(){document.getElementById('chatSidebar').classList.toggle('closed');}
function sendMessage(){if(!currentUser)return openModal('loginModal');const i=document.getElementById('chatInput');if(i.value.trim()){socket.emit('send_message',{message:i.value});i.value='';}}
async function createPayment(){const a=document.getElementById('depositAmount').value;const r=await fetch('/api/create_payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:a,currency:'btc'})});const d=await r.json();if(d.status==='success'){document.getElementById('depositForm').classList.add('hidden');document.getElementById('depositWaiting').classList.remove('hidden');document.getElementById('payAmountDisplay').innerText=d.pay_amount;document.getElementById('payAddressDisplay').innerText=d.pay_address;startPaymentPolling(d.payment_id);}}
function startPaymentPolling(pid){paymentInterval=setInterval(async()=>{const r=await fetch('/api/check_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:pid})});const d=await r.json();if(d.payment_status==='finished'){clearInterval(paymentInterval);showToast("Pago OK",'success');setTimeout(()=>window.location.reload(),2000);}},3000);}
function cancelPayment(){clearInterval(paymentInterval);document.getElementById('depositWaiting').classList.add('hidden');document.getElementById('depositForm').classList.remove('hidden');}
function copyAddress(){navigator.clipboard.writeText(document.getElementById('payAddressDisplay').innerText);showToast("Copiado",'info');}