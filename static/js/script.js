// --- VARIABLES GLOBALES ---
let currentUser = null;
let paymentInterval = null; // Para comprobar si el pago llega
let pendingEmail = "";      // Para guardar el email mientras se verifica el código

// Inicializar conexión Socket.IO (Chat en tiempo real)
const socket = io();

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Iniciar en Home
    navigate('home');
    
    // 2. Estado visual inicial (Ocultar cosas de logueado)
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');

    // 3. Comprobar si ya hay sesión iniciada
    checkSession();
    
    // 4. Iniciar la simulación de ganadores en la home
    simulateLiveWins();
});

// --- CHAT GLOBAL MEJORADO ---

// Función auxiliar para pintar un mensaje (se usa en historial y en nuevos)
function renderMessage(data, chatBox) {
    const msgDiv = document.createElement('div');
    const isMe = currentUser && data.username === currentUser;
    msgDiv.className = isMe ? 'chat-msg mine' : 'chat-msg theirs';
    
    let avatarUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
    if(data.avatar && data.avatar !== 'default.png') avatarUrl = `/static/uploads/${data.avatar}`;
    
    msgDiv.innerHTML = `
        <img src="${avatarUrl}" class="chat-avatar">
        <div class="msg-content">
            ${!isMe ? `<span class="msg-username">${data.username}</span>` : ''}
            ${escapeHtml(data.message)}
        </div>
    `;
    
    // IMPORTANTE: appendChild pone el mensaje AL FINAL (abajo)
    chatBox.appendChild(msgDiv);
}

// 1. Cargar Historial al conectar (Viejos arriba, nuevos abajo)
socket.on('chat_history', (data) => {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = ''; // Limpiar chat al entrar
    
    if(data.messages.length === 0) {
        chatBox.innerHTML = '<div class="chat-msg system"><div class="sys-text">Bienvenido al chat global.</div></div>';
    } else {
        data.messages.forEach(msg => {
            renderMessage(msg, chatBox);
        });
    }
    
    // Forzar scroll al fondo inmediatamente
    chatBox.scrollTop = chatBox.scrollHeight;
});

// 2. Recibir mensaje nuevo en tiempo real
socket.on('new_message', (data) => {
    const chatBox = document.getElementById('chatMessages');
    
    // Detectar si el usuario estaba abajo del todo
    const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 100;

    renderMessage(data, chatBox);

    // Si estaba abajo, bajar el scroll automáticamente para ver el nuevo
    if (isScrolledToBottom) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

function toggleChat() { 
    document.getElementById('chatSidebar').classList.toggle('closed'); 
    // Al abrir, bajar scroll
    setTimeout(() => { 
        const cb = document.getElementById('chatMessages'); 
        cb.scrollTop = cb.scrollHeight; 
    }, 300); 
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

function handleChatKeyPress(e) { if(e.key === 'Enter') sendMessage(); }
function escapeHtml(text) { if (!text) return text; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
// ==========================================
// 2. NAVEGACIÓN (SPA)
// ==========================================

function navigate(viewId) {
    // Si intenta entrar a Perfil o Depósito sin estar logueado -> Login
    if ((viewId === 'deposit' || viewId === 'profile') && !currentUser) {
        return openModal('loginModal');
    }

    // Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    // Mostrar la sección deseada
    const target = document.getElementById('view-' + viewId);
    if(target) target.classList.remove('hidden');
    
    // Actualizar menú inferior (Móvil)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');

    // Actualizar menú lateral (PC)
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const sideItem = document.getElementById('side-' + viewId);
    if(sideItem) sideItem.classList.add('active');
    
    window.scrollTo(0, 0);

    // En móvil, si cambias de página, cerrar el chat si estaba abierto
    if(window.innerWidth < 1024) {
        document.getElementById('chatSidebar').classList.add('closed');
    }
}

// ==========================================
// 3. AUTENTICACIÓN Y VERIFICACIÓN EMAIL
// ==========================================

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
        window.location.reload();
    } else if (data.status === 'unverified') {
        // Si el usuario existe pero no ha verificado email
        pendingEmail = data.email;
        document.getElementById('verifyEmailDisplay').innerText = pendingEmail;
        closeModal('loginModal');
        openModal('verifyModal');
        alert("Cuenta no verificada. Revisa tu correo.");
    } else {
        alert(data.message);
    }
}

async function doRegister() {
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    
    if(!user || !pass || !email) return alert("Rellena todos los datos");

    // Feedback visual en el botón
    const btn = document.querySelector('#registerModal .btn-action');
    const originalText = btn.innerText;
    btn.innerText = "ENVIANDO CÓDIGO...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass, email: email, telefono: phone})
        });
        const data = await res.json();

        if(data.status === 'verify_needed') {
            // Registro OK, ahora pedir código
            pendingEmail = data.email;
            document.getElementById('verifyEmailDisplay').innerText = pendingEmail;
            closeModal('registerModal');
            openModal('verifyModal');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert("Error de conexión");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function doVerify() {
    const code = document.getElementById('verifyCodeInput').value;
    if(!code) return alert("Introduce el código de 6 dígitos");

    const res = await fetch('/api/verify_code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: pendingEmail, code: code})
    });
    const data = await res.json();

    if(data.status === 'success') {
        alert("✅ ¡Cuenta Verificada! Bienvenido.");
        window.location.reload();
    } else {
        alert("❌ " + data.message);
    }
}

async function doLogout() {
    await fetch('/api/logout');
    window.location.reload();
}

// ==========================================
// 4. SESIÓN Y PERFIL
// ==========================================

async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        if (data.logged_in) loginSuccess(data);
    } catch (e) {}
}

function loginSuccess(data) {
    currentUser = data.user;
    
    // Actualizar UI
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('loggedNav').classList.remove('hidden');
    document.getElementById('desktopLogout').classList.remove('hidden');
    
    // Actualizar Textos
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

function handleProfileClick() {
    if (!currentUser) openModal('loginModal');
    else navigate('profile');
}

// Subir Avatar
async function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    if (input.files.length === 0) return;
    
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
    const data = await res.json();
    
    if(data.status === 'success') updateAllAvatars(data.avatar);
}

// Cambiar Contraseña
function togglePasswordEdit() {
    document.getElementById('passwordEditSection').classList.toggle('hidden');
    // Girar flechita (opcional, visual)
    document.getElementById('passChevron').classList.toggle('fa-chevron-up');
}

async function changePassword() {
    const current = document.getElementById('currentPass').value;
    const new1 = document.getElementById('newPass1').value;
    const new2 = document.getElementById('newPass2').value;

    if (new1 !== new2) return alert("Las contraseñas nuevas no coinciden");

    const res = await fetch('/api/change_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({current: current, new: new1})
    });
    const data = await res.json();
    
    if(data.status === 'success') {
        alert("Contraseña actualizada correctamente");
        togglePasswordEdit();
        // Limpiar campos
        document.getElementById('currentPass').value = '';
        document.getElementById('newPass1').value = '';
        document.getElementById('newPass2').value = '';
    } else {
        alert("Error: " + data.message);
    }
}

// ==========================================
// 5. SISTEMA DE DEPÓSITO (NowPayments Simulado)
// ==========================================

let selectedCurrency = 'btc';

function selectCrypto(coin) {
    selectedCurrency = coin;
    // Quitar clase selected de todos
    document.querySelectorAll('.crypto-option').forEach(el => el.classList.remove('selected'));
    // Poner clase selected al elegido
    const el = document.getElementById('opt-' + coin);
    if(el) el.classList.add('selected');
}

async function createPayment() {
    const amount = document.getElementById('depositAmount').value;
    if (!amount || amount < 10) return alert("El depósito mínimo es de 10$");

    const res = await fetch('/api/create_payment', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({amount: amount, currency: selectedCurrency})
    });
    const data = await res.json();

    if(data.status === 'success') {
        // Ocultar formulario, mostrar espera
        document.getElementById('depositForm').classList.add('hidden');
        document.getElementById('depositWaiting').classList.remove('hidden');
        
        // Rellenar datos
        document.getElementById('payAmountDisplay').innerText = data.pay_amount;
        document.getElementById('payCurrencyDisplay').innerText = data.pay_currency.toUpperCase();
        document.getElementById('payAddressDisplay').innerText = data.pay_address;
        
        // Empezar a preguntar al servidor si ya pagó
        startPaymentPolling(data.payment_id);
    } else {
        alert(data.message);
    }
}

function startPaymentPolling(paymentId) {
    if(paymentInterval) clearInterval(paymentInterval);
    
    paymentInterval = setInterval(async () => {
        const res = await fetch('/api/check_status', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({payment_id: paymentId})
        });
        const data = await res.json();
        
        if(data.payment_status === 'finished') {
            clearInterval(paymentInterval);
            alert("✅ ¡PAGO RECIBIDO EXITOSAMENTE!\nTu saldo ha sido actualizado.");
            window.location.reload();
        }
    }, 3000); // Preguntar cada 3 segundos
}

function cancelPayment() {
    if(paymentInterval) clearInterval(paymentInterval);
    document.getElementById('depositWaiting').classList.add('hidden');
    document.getElementById('depositForm').classList.remove('hidden');
}

function copyAddress() {
    const text = document.getElementById('payAddressDisplay').innerText;
    navigator.clipboard.writeText(text);
    alert("Dirección copiada al portapapeles");
}

// ==========================================
// 6. UTILIDADES VARIAS
// ==========================================

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

function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function switchModal(from, to) {
    closeModal(from);
    openModal(to);
}