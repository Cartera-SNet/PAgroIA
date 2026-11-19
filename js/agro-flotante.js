/* AgroIA - Agro flotante: botón redondo abajo a la derecha que abre el chat con Agro encima de cualquier pantalla.
   Lo carga js/layout.js en todas las pantallas (menos «Chat con Agro», que ya es el chat completo).
   El chat va dentro de un iframe (pages/chat.html?embed=1): usa el mismo asistente, con IA y voz, pero aislado de la
   pantalla donde estás (no puede chocar con sus scripts) y no se descarga hasta que se abre por primera vez. */
(function () {
  "use strict";
  if (window.__agroFlotante || /[?&]embed=1/.test(location.search)) return;
  window.__agroFlotante = true;

  const URL_CHAT = RAIZ + "pages/chat.html?embed=1", URL_COMPLETO = RAIZ + "pages/chat.html";
  const html = document.documentElement;
  const fab = document.createElement("button");
  fab.type = "button"; fab.id = "agro-fab"; fab.className = "agro-fab";
  fab.setAttribute("aria-label", "Abrir el chat con Agro"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "agro-panel");
  fab.innerHTML = '<span class="agro-fab-ico">' + ico("i-leaf") + '</span><span class="agro-fab-x">' + ico("i-close") + '</span>';

  const burbuja = document.createElement("div");
  burbuja.id = "agro-burbuja"; burbuja.className = "agro-burbuja"; burbuja.setAttribute("role", "status");
  burbuja.innerHTML = '<span>Hola, soy Agro. ¿En qué te ayudo?</span><button type="button" aria-label="Cerrar el saludo">×</button>';

  const panel = document.createElement("section");
  panel.id = "agro-panel"; panel.className = "agro-panel"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Chat con Agro");
  panel.innerHTML =
    '<header class="agro-panel-cab"><span class="agro-av">' + ico("i-leaf") + '</span>' +
    '<div class="agro-panel-tit"><b>Agro</b><small>Asistente de AgroIA</small></div>' +
    '<a class="agro-pb" href="' + URL_COMPLETO + '" title="Abrir en pantalla completa" aria-label="Abrir el chat en pantalla completa">' + ico("i-expand") + '</a>' +
    '<button type="button" class="agro-pb" id="agro-cerrar" title="Cerrar" aria-label="Cerrar el chat">' + ico("i-close") + '</button></header>' +
    '<div class="agro-panel-cuerpo" id="agro-cuerpo"><p class="agro-cargando">Cargando a Agro…</p></div>';

  document.body.append(panel, burbuja, fab);

  let iframe = null, timerBurbuja = null;
  const abierto = () => !panel.hidden;
  function ocultarBurbuja() { clearTimeout(timerBurbuja); burbuja.classList.remove("ver"); }
  function abrir() {
    ocultarBurbuja();
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.title = "Chat con Agro"; iframe.src = URL_CHAT; iframe.setAttribute("allow", "microphone; autoplay");
      $("agro-cuerpo").appendChild(iframe);
    }
    panel.hidden = false; html.classList.add("agro-abierto");
    fab.classList.add("abierto"); fab.setAttribute("aria-expanded", "true"); fab.setAttribute("aria-label", "Cerrar el chat con Agro");
    try { sessionStorage.setItem("agro_burbuja", "1"); } catch (e) { /* sin almacenamiento */ }
  }
  function cerrar() {
    panel.hidden = true; html.classList.remove("agro-abierto");
    fab.classList.remove("abierto"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Abrir el chat con Agro");
    fab.focus({ preventScroll: true });
  }
  fab.onclick = () => (abierto() ? cerrar() : abrir());
  $("agro-cerrar").onclick = cerrar;
  burbuja.querySelector("span").onclick = abrir;
  burbuja.querySelector("button").onclick = ocultarBurbuja;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && abierto()) cerrar(); });
  // Escape dentro del chat (el foco está en el iframe) también lo cierra: el chat avisa con un mensaje.
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || !iframe || e.source !== iframe.contentWindow) return;
    if (e.data && e.data.agro === "cerrar" && abierto()) cerrar();
  });
  window.addEventListener("pagehide", () => { if (iframe) iframe.src = "about:blank"; });   // corta la voz si se cambia de pantalla

  // Saludo en burbuja: una vez por sesión del navegador, unos segundos después de entrar.
  let yaSaludo = false; try { yaSaludo = sessionStorage.getItem("agro_burbuja") === "1"; } catch (e) { /* sin almacenamiento */ }
  if (!yaSaludo) {
    setTimeout(() => {
      if (abierto()) return;
      burbuja.classList.add("ver");
      try { sessionStorage.setItem("agro_burbuja", "1"); } catch (e) { /* sin almacenamiento */ }
      timerBurbuja = setTimeout(ocultarBurbuja, 8000);
    }, 1500);
  }
})();
