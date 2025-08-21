let usuarioIniciado = false;
let usuarioNombre = "";
document.getElementById('send').disabled = true;

window.onload = function () {
  // Recuperar sesión de localStorage
  const iniciado = localStorage.getItem("usuarioIniciado") === "true";
  if (iniciado) {
    usuarioIniciado = true;
    usuarioNombre = localStorage.getItem("usuarioNombre");
    const foto = localStorage.getItem("usuarioFoto");
    document.getElementById('send').disabled = false;
    document.getElementById('infosesicom').style.display = 'none';
    document.getElementById("google-signin-button").style.display = "none";

    crearFotoPerfil(foto, usuarioNombre);
    const nombreInput = document.getElementById("name");
    nombreInput.value = usuarioNombre;
    nombreInput.disabled = true;
  }

  google.accounts.id.initialize({
    client_id: "530053554193-e6rebd4c5733vqa1vimqdrumpbigd465.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById("google-signin-button"),
    { theme: "outline", size: "large" }
  );
  google.accounts.id.prompt();

  activarBotonesRestrictivos();
};
// el usuario a iniciado sesion
function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  const nombre = data.name;
  const foto = data.picture;
  usuarioIniciado = true;
  usuarioNombre = nombre;
  window.usuarioFoto = foto;
crearFotoPerfil(foto, nombre);
actualizarMenuPerfil(foto, nombre);

  // Guardar sesión
  localStorage.setItem("usuarioIniciado", "true");
  localStorage.setItem("usuarioNombre", nombre);
  localStorage.setItem("usuarioFoto", foto);

  document.getElementById("google-signin-button").style.display = "none";
  document.getElementById('send').disabled = false;
  document.getElementById('infosesicom').style.display = 'none';

  crearFotoPerfil(foto, nombre);

  const nombreInput = document.getElementById("name");
  nombreInput.value = nombre;
  nombreInput.disabled = true;

  console.log("Usuario:", nombre);
  console.log("Foto:", foto);
}

function crearFotoPerfil(foto, nombre) {
  const headerRight = document.querySelector(".header-right");
  let contenedor = document.querySelector(".contenedor-sesion");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.classList.add("contenedor-sesion");
    const imagen = document.createElement("img");
    imagen.src = foto;
    imagen.alt = nombre;
    imagen.classList.add("foto-perfil");
    contenedor.appendChild(imagen);
    headerRight.appendChild(contenedor);





  }

  setTimeout(() => {
    contenedor.classList.add("visible");
  }, 50);

  // Crear menú si no existe
  if (!document.getElementById("menu-perfil")) {
    const menu = document.createElement("div");
    menu.id = "menu-perfil";
    menu.classList.add("menu-derecha");
    menu.innerHTML = `
      <ul>
        <li><button id="cerrar-sesion">Cerrar sesión</button></li>
        <li><a href="#">Perfil</a></li>
        <li><a href="#">Configuración</a></li>
      </ul>`;
    document.body.appendChild(menu);

    // Botón cerrar sesión
    document.getElementById("cerrarsesion").addEventListener("click", cerrarSesion);
  }
}

function cerrarSesion() {
  localStorage.removeItem("usuarioIniciado");
  localStorage.removeItem("usuarioNombre");
  localStorage.removeItem("usuarioFoto");
  usuarioIniciado = false;
  usuarioNombre = "";
  window.usuarioFoto = "";

  document.getElementById("google-signin-button").style.display = "block";
  const contenedorSesion = document.querySelector(".contenedor-sesion");
  if (contenedorSesion) contenedorSesion.remove();

  const nombreInput = document.getElementById("name");
  nombreInput.value = "";
  nombreInput.disabled = false;

  document.getElementById('send').disabled = true;

  const menuPerfil = document.getElementById("menu-perfil");
  if (menuPerfil) menuPerfil.classList.remove("visible");
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

// Abrir menú desde foto de perfil
document.addEventListener("click", (e) => {
  const menuPerfil = document.getElementById("menu-perfil");
  const fotoPerfil = document.querySelector(".foto-perfil");


 const foto = document.querySelector('.foto-perfil');

foto.addEventListener('mouseover', () => {
  foto.style.cursor = 'pointer';
});

foto.addEventListener('mouseout', () => {
  foto.style.cursor = 'default';
});


  if (fotoPerfil && e.target === fotoPerfil) {
    menuPerfil.classList.toggle("visible");
  } else if (menuPerfil && !menuPerfil.contains(e.target)) {
    menuPerfil.classList.remove("visible");
  }
});

// Función para activar botones que requieren login
function activarBotonesRestrictivos() {
  const modal = document.getElementById("modal-login");
  const modalDescarga = document.getElementById("modal-descarga");
  const botonesDescargar = document.querySelectorAll("button.descargar");
  botonesDescargar.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });

  const botonesEnviar = document.querySelectorAll("button.enviar");
  botonesEnviar.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });

  const botonesInstrucciones = document.querySelectorAll("button.instrucciones");
  botonesInstrucciones.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      } else {
        modalDescarga.style.display = "flex";
      }
    });
  });

  const cerrarModal = document.getElementById("cerrar-modal");
  cerrarModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  const cerrarDescarga = document.getElementById("cerrar-descarga");
  cerrarDescarga.addEventListener("click", () => {
    modalDescarga.style.display = "none";
  });
}

function googleTranslateElementInit() {
new google.translate.TranslateElement({
pageLanguage: 'es',
layout: google.translate.TranslateElement.InlineLayout.SIMPLE
}, 'google_translate_element');
}

function actualizarMenuPerfil(foto, nombre) {
  const fotoMenu = document.getElementById("foto-menu");
  const nombreMenu = document.getElementById("nombre-menu");
  if(fotoMenu) fotoMenu.src = foto;
  if(nombreMenu) nombreMenu.textContent = nombre;
}
