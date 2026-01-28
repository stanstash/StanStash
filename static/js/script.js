let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    navigate('home');
    checkSession();
    simulateLiveWins();
});

function navigate(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.getElementById('nav-' + viewId);
    if (nav) nav.classList.add('active');

    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    const side = document.getElementById('side-' + viewId);
    if (side) side.classList.add('active');

    window.scrollTo(0, 0);
}

async function checkSession() {
    const res = await fetch('/api/check_session');
    const data = await res.json();
    if (data.logged_in) loginSuccess(data);
}

function loginSuccess(data) {
    currentUser = data.user;
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('loggedNav').classList.remove('hidden');

    document.getElementById('userBalance').innerText = data.saldo.toFixed(2);
    document.getElementById('profileBalanceDisplay').innerText = data.saldo.toFixed(2);
    document.getElementById('profileUsername').innerText = data.user;

    updateAllAvatars(data.avatar);
}

function updateAllAvatars(filename) {
    let url = `/static/uploads/${filename}`;
    document.getElementById('navAvatarImg').src = url;
    document.getElementById('profileAvatarBig').src = url;
}

async function uploadAvatar() {
    const file = document.getElementById('avatarInput').files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/upload_avatar', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.status === 'success') updateAllAvatars(data.avatar);
}

async function doLogout() {
    await fetch('/api/logout');
    location.reload();
}

function simulateLiveWins() {
    const tbody = document.getElementById('liveWinsBody');
    setInterval(() => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>Crash</td><td>User***</td><td class="win-amount">+${(Math.random()*50).toFixed(2)}$</td>`;
        tbody.prepend(tr);
        if (tbody.children.length > 5) tbody.lastChild.remove();
    }, 3000);
}

function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
