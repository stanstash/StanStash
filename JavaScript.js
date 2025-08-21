let usuarioIniciado = false;
let usuarioNombre = "";
document.getElementById('send').disabled = true;


// update

setInterval(() => {



  

  
}, 100) 

// cierra update






function handleCredentialResponse(response) {
  // usuario a iniciado sesión
  
  const data = parseJwt(response.credential);
  const nombre = data.name;
  document.getElementById('send').disabled = false;
  document.getElementById('infosesicom').style.display = 'none';
  const foto = data.picture;

 
  usuarioIniciado = true;
  usuarioNombre = nombre;

  console.log("Usuario:", nombre);

  document.getElementById("google-signin-button").style.display = "none";

  const headerRight = document.querySelector(".header-right");
  const contenedor = document.createElement("div");
  contenedor.classList.add("contenedor-sesion");

  const imagen = document.createElement("img");
  imagen.src = foto;
  imagen.alt = nombre;
  imagen.classList.add("foto-perfil");

  contenedor.appendChild(imagen);
  headerRight.appendChild(contenedor);

  setTimeout(() => {
    contenedor.classList.add("visible");
  }, 50);

  const nombreInput = document.getElementById("name");
  nombreInput.value = nombre;
  nombreInput.disabled = true;
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

const modal = document.getElementById("modal-login");
const cerrarModal = document.getElementById("cerrar-modal");

cerrarModal.addEventListener("click", () => {
  modal.style.display = "none";
});

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

  const botones = document.querySelectorAll("button.descargar");
  botones.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });

  const botoness = document.querySelectorAll("button.enviar");
  botoness.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });
  
  const botonesss = document.querySelectorAll("button.instrucciones");
  botonesss.forEach(boton => {
    boton.addEventListener("click", (e) => {
      if (!usuarioIniciado) {
        e.preventDefault();
        modal.style.display = "flex";
      } else {
        modalDescarga.style.display = "flex";
      }
    });
  });
  
}

function googleTranslateElementInit() {
  new google.translate.TranslateElement({pageLanguage: 'es'}, 'google_translate_element');
}

const modalDescarga = document.getElementById("modal-descarga");
const cerrarDescarga = document.getElementById("cerrar-descarga");

cerrarDescarga.addEventListener("click", () => {
  modalDescarga.style.display = "none";
});

const botonesDescarga = document.querySelectorAll("button.descargar");
botonesDescarga.forEach(boton => {
  boton.addEventListener("click", (e) => {
    if (!usuarioIniciado) {
      e.preventDefault();
      modal.style.display = "flex";
    } else {
      modalDescarga.style.display = "flex";
     
    }
  });
});


// ---------------- Comentarios ----------------
const listaComentarios = document.getElementById("comentarios-list");
const enviarBtn = document.getElementById("enviar");
const nombreInput = document.getElementById("nombre");
const mensajeInput = document.getElementById("mensaje");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const paginaActualSpan = document.getElementById("pagina-actual");

let comentarios = [];
let pagina = 1;
const comentariosPorPagina = 5;

function mostrarComentarios() {
  listaComentarios.innerHTML = "";
  const inicio = (pagina - 1) * comentariosPorPagina;
  const fin = inicio + comentariosPorPagina;
  const visibles = comentarios.slice(inicio, fin);

  visibles.forEach(c => {
    const articulo = document.createElement("article");
    articulo.style.background = "#1c1c1c";
    articulo.style.border = "2px solid #ffcc00";
    articulo.style.borderRadius = "12px";
    articulo.style.padding = "12px";
    articulo.style.marginBottom = "10px";
    articulo.style.boxShadow = "0 4px 8px rgba(255,204,0,0.2)";

    const header = document.createElement("header");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.fontWeight = "700";
    header.style.marginBottom = "6px";

    const nombre = document.createElement("span");
    nombre.textContent = c.nombre;
    const tiempo = document.createElement("time");
    tiempo.textContent = c.fecha;

    header.appendChild(nombre);
    header.appendChild(tiempo);

    const mensaje = document.createElement("p");
    mensaje.textContent = c.mensaje;
    mensaje.style.margin = "0";
    mensaje.style.color = "#d0d0d0";

    articulo.appendChild(header);
    articulo.appendChild(mensaje);
    listaComentarios.appendChild(articulo);
  });

  paginaActualSpan.textContent = pagina;
  prevBtn.disabled = pagina === 1;
  nextBtn.disabled = fin >= comentarios.length;
}

enviarBtn.addEventListener("click", (e) => {
      if (usuarioIniciado) {
         const nombre = usuarioNombre || nombreInput.value.trim();
              const mensaje = mensajeInput.value.trim();
              if (nombre && mensaje) {
              const fecha = new Date().toLocaleString();
              comentarios.unshift({nombre, mensaje, fecha});
              mensajeInput.value = "";
              pagina = 1;
              mostrarComentarios();
              
                  
                

              

              }
      } else {

            e.preventDefault();
        modal.style.display = "flex";
        modal.querySelector("p").textContent = "Debes iniciar sesion para añadir un comentario";
            }
});


// 


