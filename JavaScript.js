let usuarioIniciado = false;

function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  const nombre = data.name;
  const foto = data.picture;

  usuarioIniciado = true;

  console.log("Usuario:", nombre);

  // Ocultar botón de login
  document.getElementById("google-signin-button").style.display = "none";

  // Crear solo la foto de perfil
  const headerRight = document.querySelector(".header-right");
  const contenedor = document.createElement("div");
  contenedor.classList.add("contenedor-sesion");

  const imagen = document.createElement("img");
  imagen.src = foto;
  imagen.alt = nombre;
  imagen.classList.add("foto-perfil");

  contenedor.appendChild(imagen);
  headerRight.appendChild(contenedor);

  // Activar animación
  setTimeout(() => {
    contenedor.classList.add("visible");
  }, 50);
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );
  return JSON.parse(jsonPayload);
}

// Modal de inicio de sesión
const modal = document.getElementById("modal-login");
const cerrarModal = document.getElementById("cerrar-modal");

cerrarModal.addEventListener("click", () => {
  modal.style.display = "none";
});

// Inicializar Google Sign-In
window.onload = function () {
  google.accounts.id.initialize({
    client_id: "530053554193-e6rebd4c5733vqa1vimqdrumpbigd465.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById("google-signin-button"),
    { theme: "outline", size: "large" }
  );
  google.accounts.id.prompt();

  // Botones de descarga
  const botones = document.querySelectorAll("button.descargar");
  botones.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });
}

// Inicializar Google Translate
function googleTranslateElementInit() {
  new google.translate.TranslateElement({pageLanguage: 'es'}, 'google_translate_element');
}


// Modal de descarga exitosa
const modalDescarga = document.getElementById("modal-descarga");
const cerrarDescarga = document.getElementById("cerrar-descarga");

cerrarDescarga.addEventListener("click", () => {
  modalDescarga.style.display = "none";
});

// Botones de descarga
const botones = document.querySelectorAll("button.descargar");
botones.forEach(boton => {
  boton.addEventListener("click", (e) => {
    if (!usuarioIniciado) {
      e.preventDefault();
      modal.style.display = "flex";
    } else {
      // Mostrar modal sin bloquear la descarga
      modalDescarga.style.display = "flex";
      // Opcional: cerrar el modal automáticamente después de unos segundos
      setTimeout(() => {
        modalDescarga.style.display = "none";
      },99999 );
    }
  });
});
