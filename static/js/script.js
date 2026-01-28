let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ocultar todo lo de usuario AL PRINCIPIO para evitar parpadeos
    document.getElementById('loggedNav').classList.add('hidden');
    document.getElementById('desktopLogout').classList.add('hidden');
    document.getElementById('guestNav').classList.remove('hidden');
    
    // 2. Comprobar sesión
    checkSession();
});

// --- NAVEGACIÓN (SPA) ---
function navigate(viewId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    // Mostrar la deseada
    document.getElementById('view-' + viewId).classList.remove('hidden');
    
    // Actualizar menú inferior
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + viewId);
    if(navItem) navItem.classList.add('active');
    
    // Scroll arriba
    window.scrollTo(0, 0);
}


// --- SESIÓN ---
async function checkSession() {
    try {
        const res = await fetch('/api/check_session');
        const data = await res.json();
        
        if (data.logged_in) {
            loginSuccess(data);
        } else {
            // Asegurar modo invitado
            currentUser = null;
            document.getElementById('loggedNav').classList.add('hidden');
            document.getElementById('guestNav').classList.remove('hidden');
        }
    } catch (e) { console.log("Modo invitado"); }
}

function loginSuccess(data) {
    currentUser = data.user;
    
    // UI Change
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('loggedNav').classList.remove('hidden');
    document.getElementById('desktopLogout').classList.remove('hidden');
    
    // Datos
    document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
    
    // Perfil
    updateAllAvatars(data.avatar);
    document.getElementById('profileUsername').innerText = data.user;
    document.getElementById('profileBio').value = data.bio || "";
}

function updateAllAvatars(filename) {
    // Si no hay avatar, usar placeholder con inicial
    let url = 'https://via.placeholder.com/100/000000/FFFFFF/?text=User';
    
    if (filename && filename !== 'default.png') {
        url = `/static/uploads/${filename}`;
    } else if (currentUser) {
         // Placeholder bonito con la inicial del usuario
         url = `https://via.placeholder.com/100/000000/00FF88/?text=${currentUser.charAt(0).toUpperCase()}`;
    }

    if(document.getElementById('navAvatarImg')) document.getElementById('navAvatarImg').src = url;
    if(document.getElementById('sidebarAvatarImg')) document.getElementById('sidebarAvatarImg').src = url;
    if(document.getElementById('profileAvatarBig')) document.getElementById('profileAvatarBig').src = url;
}


// --- PERFIL Y OPCIONES ---

function handleProfileClick() {
    if (currentUser) {
        openModal('profileModal');
    } else {
        openModal('loginModal');
    }
}

function toggleBioEdit() {
    const section = document.getElementById('bioEditSection');
    section.classList.toggle('hidden');
}

async function saveBio() {
    const bio = document.getElementById('profileBio').value;
    await fetch('/api/update_bio', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({bio: bio})
    });
    toggleBioEdit();
    alert("Biografía actualizada");
}

async function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    if (input.files.length === 0) return;

    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
        const res = await fetch('/api/upload_avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            updateAllAvatars(data.avatar);
        } else { alert(data.message); }
    } catch (e) { alert("Error al subir"); }
}

function shareReferral() {
    const link = window.location.origin + "?ref=" + currentUser;
    navigator.clipboard.writeText(link);
    alert("¡Enlace copiado!\nCompártelo con tus amigos:\n" + link);
}

// --- LOGIN/REGISTRO/LOGOUT (Estándar) ---

async function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass})
    });
    const data = await res.json();
    if (data.status === 'success') {
        closeModal('loginModal');
        loginSuccess({user: data.user, saldo: data.saldo, avatar: data.avatar, bio: ""});
    } else { alert(data.message); }
}

async function doRegister() {
    // Simular el registro para no hacer el código infinito aquí
    // Usa la función completa que te pasé antes, es compatible.
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    
    if(!user || !pass || !email) return alert("Rellena los datos");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: user, password: pass, email: email, telefono: phone})
    });
    const data = await res.json();
    if(data.status === 'success') {
        closeModal('registerModal');
        alert("¡Cuenta Creada! +100 Créditos");
        loginSuccess({user: data.user, saldo: 100.00, avatar: 'default.png', bio: ""});
    } else { alert(data.message); }
}

async function doLogout() {
    await fetch('/api/logout');
    location.reload();
}

// --- UTILS ---
function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function switchModal(from, to) { closeModal(from); openModal(to); }