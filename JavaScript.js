function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  const nombre = data.name;
  const foto = data.picture;

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
}
