const RAIZ = location.pathname.includes("/pages/") ? "../" : "";
const USUARIO_KEY = "agroia_usuario";
function guardarSesion(token, nombre, recordar = true) {
  const almacen = recordar ? localStorage : sessionStorage;
  almacen.setItem(TOKEN_KEY, token);
  if (nombre) almacen.setItem(USUARIO_KEY, nombre);
}
const leerUsuarioGuardado = () => localStorage.getItem(USUARIO_KEY) || sessionStorage.getItem(USUARIO_KEY);
function cerrarSesion() {
  [localStorage, sessionStorage].forEach(a => { a.removeItem(TOKEN_KEY); a.removeItem(USUARIO_KEY); });
  location.href = RAIZ + "index.html";
}
function requerirSesion() { if (SESION_OBLIGATORIA && !obtenerToken()) location.replace(RAIZ + "index.html"); }

// Nombre para mostrar arriba a la derecha: el guardado al iniciar sesión,
// o el "username" que viene dentro del JWT (caso login con Google).
function nombreUsuario() {
  const g = leerUsuarioGuardado();
  if (g) return g;
  try {
    const p = JSON.parse(atob(obtenerToken().split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (p.username) return p.username;
  } catch (e) { /* token sin forma de JWT */ }
  return obtenerToken() ? "Usuario" : "Invitado";
}

async function loginTradicional(usuario, clave, recordar = true) {
  const r = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [LOGIN_CAMPOS.usuario]: usuario, [LOGIN_CAMPOS.clave]: clave })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const t = d[LOGIN_CAMPOS.tokenRespuesta];
  if (!t) throw new Error("Respuesta sin token");
  guardarSesion(t, d.user && d.user.Usuario_Nombres, recordar);
}
// Login con Google: el backend (GET /auth/google) redirige a Google y, al volver,
// su /auth/google/callback envía a http://localhost:5500/index.html?token=JWT
function loginGoogle() { location.href = `${API_BASE_URL}/auth/google`; }
