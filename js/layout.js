/* ==========================================================
   AgroIA - Estructura común de las páginas
   Cada página solo necesita:  <aside id="sidebar"></aside><main>…</main>
   y llamar a montarLayout({...}).  Las páginas del diseño nuevo pasan { nuevo: true }.
   ========================================================== */

// Menú del diseño (6 opciones). "p" = páginas que pertenecen a cada opción.
const NAV = [
  { k: "inicio",     t: "Inicio",                   i: "i-home",  h: "dashboard.html",           p: ["dashboard.html"] },
  { k: "monitoreo",  t: "Monitoreo",                i: "i-chart", h: "pages/monitoreo.html",     p: ["monitoreo.html"] },
  { k: "historial",  t: "Historial de datos",       i: "i-doc",   h: "pages/historial.html",     p: ["historial.html", "alertas.html"] },
  { k: "prediccion", t: "Predicción de fertilidad", i: "i-brain", h: "pages/prediccion.html",    p: ["prediccion.html", "vision.html", "camara.html"] },
  { k: "chat",       t: "Chat con IA",              i: "i-chat",  h: "pages/chat.html",          p: ["chat.html"] },
  { k: "config",     t: "Configuración",            i: "i-gear",  h: "pages/configuracion.html", p: ["configuracion.html"] }
];
// Pestañas internas de las opciones que agrupan varias páginas.
const SUBNAV = {
  // Ocultas (InfluxDB no disponible en Railway): Telemetría InfluxDB, Análisis integrado, Reportes PDF, Control IoT
  monitoreo:  [["Tiempo real", "monitoreo.html"]],
  historial:  [["Historial", "historial.html"], ["Alertas", "alertas.html"]],
  prediccion: [["Clasificador IA", "prediccion.html"], ["Analizar imagen", "vision.html"], ["Cámara en vivo", "camara.html"]],
  config:     [["General", "configuracion.html"]]
};
const ATAJOS = [
  [/inicio|home|panel/, "dashboard.html"], [/temp|humedad|ph\b|tiempo real|monitor/, "pages/monitoreo.html"],
  [/hist|fecha|muestra|dato|csv/, "pages/historial.html"], [/alert/, "pages/alertas.html"],
  [/predic|fertil|clasif/, "pages/prediccion.html"], [/imagen|yolo|camara|cámara/, "pages/vision.html"],
  [/chat|mensaje|comando/, "pages/chat.html"], [/config|iot|esp|teclado|intervalo|canal/, "pages/configuracion.html"]
];

function montarLayout(op) {
  op = op || {};
  requerirSesion();
  inyectarIconos();
  const actual = location.pathname.split("/").pop() || "index.html";
  const grupo = (NAV.find(n => n.p.includes(actual)) || NAV[0]).k;
  const sesion = !!obtenerToken();

  // ---- Menú lateral
  const aside = document.getElementById("sidebar") || document.createElement("aside");
  aside.id = "sidebar"; aside.className = "sidebar"; aside.setAttribute("aria-label", "Menú principal");
  aside.innerHTML =
    `<a class="brand" href="${RAIZ}dashboard.html">${ico("logo-hoja", "brand-leaf")}<span class="brand-name">Agro<b>IA</b></span></a>` +
    `<p class="tagline">Cultivos más sanos,<br>mejores cosechas</p>` +
    `<nav class="menu">` + NAV.map(n =>
      `<a href="${RAIZ}${n.h}" class="menu-item${n.k === grupo ? " activo" : ""}">${ico(n.i)}<span>${n.t}</span></a>`).join("") +
    `<a href="#" class="menu-salir" id="salir-movil">${ico(sesion ? "i-logout" : "i-login")}<span>${sesion ? "Cerrar sesión" : "Iniciar sesión"}</span></a></nav>` +
    `<div class="sidebar-hojas" aria-hidden="true"></div>` +
    `<div class="sidebar-estado"><div class="se-fila"><i class="punto gris" id="punto-lateral"></i><span id="estado-lateral">Verificando...</span></div>` +
    `<small id="hora-lateral">Última actualización: —</small></div>`;

  const overlay = document.createElement("div"); overlay.className = "overlay"; overlay.id = "overlay";

  // ---- Barra móvil / tablet
  const mobilebar = document.createElement("header"); mobilebar.className = "mobilebar";
  mobilebar.innerHTML =
    `<button class="btn-hamb" id="btn-hamb-m" aria-label="Abrir menú">${ico("i-menu")}</button>` +
    `<a class="brand-m" href="${RAIZ}dashboard.html">${ico("logo-hoja", "brand-leaf")}<span>Agro<b>IA</b></span></a>` +
    `<div class="mb-der">${ico("i-wifi", "wifi")}<span class="mb-user">${ico("i-user", "avatar")}<span class="mb-nombre">${esc(nombreUsuario())}</span>${ico("i-down", "chev")}</span></div>`;

  // ---- Barra superior (escritorio)
  const topbar = document.createElement("header"); topbar.className = "topbar";
  topbar.innerHTML =
    `<button class="btn-hamb" id="btn-hamb" aria-label="Mostrar u ocultar el menú">${ico("i-menu")}</button>` +
    `<label class="buscador">${ico("i-search")}<input type="search" id="buscador" placeholder="${esc(op.buscador || "Buscar datos, parámetros o comandos...")}" autocomplete="off"></label>` +
    `<div class="topbar-der"><span class="estado-sistema"><i class="punto gris" id="punto-sistema"></i><span id="texto-sistema">Verificando...</span></span>` +
    `${ico("i-wifi", "wifi")}` +
    `<div class="usuario-wrap"><button class="usuario" id="btn-usuario" aria-haspopup="true">${ico("i-user", "avatar")}<span id="nombre-usuario">${esc(nombreUsuario())}</span>${ico("i-down", "chev")}</button>` +
    `<div class="menu-usuario" id="menu-usuario"><div class="sub">${sesion ? "Sesión iniciada" : "Sin sesión iniciada"}</div>` +
    `<button id="salir">${ico(sesion ? "i-logout" : "i-login")}${sesion ? "Cerrar sesión" : "Iniciar sesión"}</button></div></div></div>`;

  // ---- Contenido
  const main = document.querySelector("main");
  main.classList.add("content"); if (!op.nuevo) main.classList.add("pagina");
  if (SUBNAV[grupo]) {
    const nav = document.createElement("nav"); nav.className = "subnav"; nav.setAttribute("aria-label", "Secciones");
    nav.innerHTML = SUBNAV[grupo].map(([t, h]) => `<a href="${h}" class="${h === actual ? "on" : ""}">${t}</a>`).join("");
    main.insertBefore(nav, main.firstChild);
  }
  const wrap = document.createElement("div"); wrap.className = "main";
  wrap.append(mobilebar, topbar, main);

  // ---- Barra inferior (móvil)
  const bn = [["inicio", "Inicio", "i-home", "dashboard.html"], ["monitoreo", "Monitoreo", "i-chart", "pages/monitoreo.html"],
              ["prediccion", "Análisis", "i-brain", "pages/vision.html"], ["historial", "Historial", "i-doc", "pages/historial.html"]];
  const bottom = document.createElement("nav"); bottom.className = "bottomnav"; bottom.setAttribute("aria-label", "Navegación móvil");
  bottom.innerHTML = bn.map(([k, t, i, h]) => `<a href="${RAIZ}${h}" class="${k === grupo ? "activo" : ""}">${ico(i)}<span>${t}</span></a>`).join("") +
    `<a href="#" id="mas">${ico("i-dots")}<span>Más</span></a>`;

  const toast = document.createElement("div"); toast.className = "toast"; toast.id = "toast"; toast.setAttribute("role", "status");

  const shell = document.createElement("div"); shell.className = "shell"; shell.id = "shell";
  shell.append(aside, overlay, wrap, bottom);
  document.body.insertBefore(shell, document.body.firstChild.nextSibling);   // después del sprite
  document.body.appendChild(toast);

  // ---- Comportamiento
  const estrecho = () => window.matchMedia("(max-width:1100px)").matches;
  const drawer = abrir => { aside.classList.toggle("abierto", abrir); overlay.classList.toggle("ver", abrir); };
  if (!estrecho() && localStorage.getItem("agroia_menu") === "1") shell.classList.add("colapsado");
  const hamb = () => {
    if (estrecho()) drawer(!aside.classList.contains("abierto"));
    else { shell.classList.toggle("colapsado"); localStorage.setItem("agroia_menu", shell.classList.contains("colapsado") ? "1" : "0"); }
  };
  $("btn-hamb").onclick = hamb; $("btn-hamb-m").onclick = hamb;
  overlay.onclick = () => drawer(false);
  $("mas").onclick = e => { e.preventDefault(); drawer(true); };
  aside.querySelectorAll("a.menu-item").forEach(a => a.addEventListener("click", () => drawer(false)));

  const salir = e => { e.preventDefault(); if (sesion) cerrarSesion(); else location.href = RAIZ + "index.html"; };
  $("salir").onclick = salir; $("salir-movil").onclick = salir;
  $("btn-usuario").onclick = e => { e.stopPropagation(); $("menu-usuario").classList.toggle("abierto"); };
  document.addEventListener("click", () => $("menu-usuario").classList.remove("abierto"));

  // Buscador: si la página define alBuscar(texto) filtra en vivo; si no, salta a la sección que corresponda.
  const inp = $("buscador");
  inp.addEventListener("input", () => { if (typeof window.alBuscar === "function") window.alBuscar(inp.value.trim()); });
  inp.addEventListener("keydown", e => {
    if (e.key !== "Enter" || typeof window.alBuscar === "function") return;
    const q = inp.value.toLowerCase().trim(); if (!q) return;
    const hit = ATAJOS.find(([re]) => re.test(q));
    if (hit) location.href = RAIZ + hit[1]; else avisarToast(`Sin resultados para «${inp.value}».`);
  });

  // Las páginas con datos de ThingSpeak actualizan el estado ellas mismas; las demás consultan la API.
  if (!op.estadoPropio) verificarApi();
}

/* Estado del sistema: nivel = "ok" | "warn" | "bad" | "gris" */
function setEstadoSistema(nivel, texto, hora) {
  const cls = "punto" + (nivel === "ok" ? "" : " " + nivel);
  [["punto-sistema", "texto-sistema"], ["punto-lateral", "estado-lateral"]].forEach(([p, t]) => {
    const pe = $(p), te = $(t); if (pe) pe.className = cls; if (te) te.textContent = texto;
  });
  const h = $("hora-lateral");
  if (h) h.textContent = "Última actualización: " + (hora ? horaAMPM(hora) : "—");
}

let _toastT;
function avisarToast(msg) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("ver");
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove("ver"), 3400);
}

async function verificarApi() {
  try {
    const c = new AbortController(); setTimeout(() => c.abort(), 5000);
    const r = await fetch(`${API_BASE_URL}/iot/configuracion`, { signal: c.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    setEstadoSistema("ok", "API en línea", new Date());
  } catch (e) { setEstadoSistema("bad", "API sin conexión", null); }
}

/* Ventana emergente sencilla (la usan Historial y Configuración) */
function abrirModal(titulo, htmlCuerpo, botones) {
  cerrarModal();
  const m = document.createElement("div"); m.className = "modal"; m.id = "modal";
  m.innerHTML = `<div class="modal-caja" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">` +
    `<div class="modal-cab"><h3>${esc(titulo)}</h3><button class="modal-x" aria-label="Cerrar">${ico("i-close")}</button></div>` +
    `<div class="modal-cuerpo">${htmlCuerpo}</div><div class="modal-pie" id="modal-pie"></div></div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if (e.target === m) cerrarModal(); });
  m.querySelector(".modal-x").onclick = cerrarModal;
  const pie = m.querySelector("#modal-pie");
  (botones || [{ t: "Cerrar", f: cerrarModal, sec: true }]).forEach(b => {
    const bt = document.createElement("button"); bt.className = b.sec ? "btn-s" : "btn-p"; bt.textContent = b.t; bt.onclick = b.f; pie.appendChild(bt);
  });
  return m;
}
function cerrarModal() { const m = document.getElementById("modal"); if (m) m.remove(); }
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });
