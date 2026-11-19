/* AgroIA - Teclado virtual del menú LCD (mismas opciones que el teclado físico del ESP32).
   Teclas 2-7 y A: piden a la API las rutas /menu/*. Teclas 1, 8 y 9: se calculan con la última lectura de ThingSpeak.
   Tecla 0: orden del LED (POST /esp32/comando). Tecla B: el ESP32 no envía su WiFi ni su IP, así que no está disponible.
   No toca el firmware ni la pantalla física. */
montarLayout({ nuevo: true });
(function () {
  "use strict";
  $("tec-cab").insertAdjacentHTML("afterbegin", ico("i-teclado"));

  // tecla, etiqueta corta, origen, ruta de la API (si la hay)
  const TECLAS = [
    ["1", "Lectura actual", "ThingSpeak"], ["2", "Último registro", "API", "/menu/ultimo-registro"], ["3", "Promedio 24 h", "API", "/menu/promedio-24h"],
    ["4", "Máx. y mín. hoy", "API", "/menu/max-min-hoy"], ["5", "Promedio por hora", "API", "/menu/promedio-por-hora"], ["6", "Muestras por día", "API", "/menu/muestras-por-dia"],
    ["7", "Días bajo umbral", "API", "/menu/dias-bajo-umbral"], ["8", "Alerta suelo < 30 %", "ThingSpeak"], ["9", "Temperatura en °F", "ThingSpeak"],
    ["A", "Desviación estándar", "API", "/menu/desviacion"], ["0", "LED", "ESP32"], ["B", "WiFi e IP", "No disponible"]
  ];
  const UMBRAL_SUELO = 30;
  let ocupado = false;

  const cont = $("tec-teclas");
  cont.innerHTML = TECLAS.map(t =>
    '<button type="button" class="tec-tecla" data-k="' + t[0] + '"><span class="tec-n">' + t[0] + '</span><span class="tec-t">' + esc(t[1]) +
    '</span><span class="tec-o">' + esc(t[2]) + '</span></button>').join("");
  cont.addEventListener("click", e => { const b = e.target.closest(".tec-tecla"); if (b) pulsar(b.dataset.k); });
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || ""; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    const k = String(e.key || "").toUpperCase();
    if (TECLAS.some(t => t[0] === k)) pulsar(k);
  });

  // ---------- pantalla LCD y consola ----------
  const lcd = (l1, l2) => { $("tec-l1").textContent = String(l1 || "").slice(0, 16); $("tec-l2").textContent = String(l2 || "").slice(0, 16); };
  const detalle = t => { $("tec-detalle").textContent = t || ""; };
  function consola(k, origen, texto, ok) {
    const c = $("tec-consola"), v = c.querySelector(".tec-vacio"); if (v) v.remove();
    const f = document.createElement("div"); f.className = "tec-fila" + (ok === false ? " mal" : "");
    const h = new Date();
    f.innerHTML = '<span class="tec-hora">' + dos(h.getHours()) + ":" + dos(h.getMinutes()) + ":" + dos(h.getSeconds()) + '</span> <b>Tecla ' + esc(k) + "</b> · " + esc(origen) + "<br>" + esc(texto);
    c.insertBefore(f, c.firstChild);
    while (c.children.length > 40) c.removeChild(c.lastChild);
  }
  $("tec-limpiar").onclick = () => { $("tec-consola").innerHTML = '<div class="tec-vacio">Aquí aparece cada consulta que haces.</div>'; };

  const marcar = k => cont.querySelectorAll(".tec-tecla").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  const bloquear = si => { ocupado = si; cont.classList.toggle("espera", si); };

  // ---------- llamadas a la API (con aviso si el servidor está despertando) ----------
  const ESPERA = { intentos: 6, esperaMs: 5000, timeoutMs: 20000 };
  async function pedir(metodo, ruta, cuerpo, k) {
    const h = { "Content-Type": "application/json" }, tk = obtenerToken(); if (tk) h["Authorization"] = "Bearer " + tk;
    let ultimo = null;
    for (let i = 0; i < ESPERA.intentos; i++) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ESPERA.timeoutMs);
        const r = await fetch(API_BASE_URL + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: ctl.signal });
        clearTimeout(to);
        if (![502, 503, 504].includes(r.status)) { let d = {}; try { d = await r.json(); } catch (e) { /* sin cuerpo */ } return { ok: r.ok, status: r.status, datos: d }; }
        ultimo = r.status;
      } catch (e) { ultimo = 0; }
      if (i < ESPERA.intentos - 1) { lcd("Despertando...", "intento " + (i + 2) + "/" + ESPERA.intentos); detalle("El servidor estaba dormido; se está despertando. Un momento…"); await new Promise(res => setTimeout(res, ESPERA.esperaMs)); }
    }
    return { ok: false, status: ultimo, datos: {}, dormido: true };
  }

  // ---------- lecturas de ThingSpeak (teclas 1, 8, 9) ----------
  async function ultimaLectura() {
    const r = await tsFeeds({ results: 20 }); if (!r) return null;
    const res = tsResumen(r.feeds), f = r.feeds.length ? r.feeds[r.feeds.length - 1].t : null;
    return { t: res.temp.ult, a: res.humAire.ult, s: res.humSuelo.ult, d: res.tds.ult, hora: f };
  }
  const hace = f => { if (!f) return ""; const m = (Date.now() - f.getTime()) / 60000; return m < 60 ? Math.max(1, Math.round(m)) + " min" : m < 1440 ? Math.floor(m / 60) + " h" : Math.floor(m / 1440) + " día(s)"; };
  const n1 = v => (v === null || v === undefined ? "--" : Number(v).toFixed(1));
  const n0 = v => (v === null || v === undefined ? "--" : Math.round(v));

  async function localTS(k) {
    const L = await ultimaLectura();
    if (!L || L.hora === null) return { l1: "Sin datos", l2: "ThingSpeak", det: "ThingSpeak no devolvió lecturas.", ok: false };
    const viejo = (Date.now() - L.hora.getTime()) / 60000 > 5, aviso = viejo ? " (última lectura hace " + hace(L.hora) + ": el ESP32 no está enviando datos recientes)" : "";
    if (k === "1") return { l1: "T" + n1(L.t) + "C A" + n0(L.a) + "%", l2: "S" + n0(L.s) + "% D" + n0(L.d),
      det: "Temperatura " + n1(L.t) + " °C · humedad del aire " + n0(L.a) + " % · humedad del suelo " + n0(L.s) + " % · TDS " + n0(L.d) + " ppm" + aviso };
    if (k === "8") {
      if (L.s === null) return { l1: "Alerta suelo", l2: "Sin dato", det: "No hay lectura de humedad del suelo." + aviso, ok: false };
      const baja = L.s < UMBRAL_SUELO;
      return { l1: baja ? "ALERTA SUELO" : "Suelo OK", l2: "S" + n0(L.s) + "% " + (baja ? "<" : ">=") + UMBRAL_SUELO + "%",
        det: "Humedad del suelo " + n0(L.s) + " %: " + (baja ? "por debajo del umbral de " + UMBRAL_SUELO + " %, conviene regar." : "igual o por encima del umbral de " + UMBRAL_SUELO + " %.") + aviso };
    }
    if (L.t === null) return { l1: "Temperatura", l2: "Sin dato", det: "No hay lectura de temperatura." + aviso, ok: false };
    const f = L.t * 9 / 5 + 32;
    return { l1: "Temperatura", l2: f.toFixed(1) + " F", det: n1(L.t) + " °C = " + f.toFixed(1) + " °F" + aviso };
  }

  // ---------- LED (tecla 0) ----------
  async function enviarLed(accion) {
    if (ocupado) return;
    const nombre = accion === "encender_led" ? "encender" : "apagar";
    bloquear(true); $("led-on").disabled = $("led-off").disabled = true; lcd("LED", "enviando...");
    try {
      const r = await pedir("POST", "/esp32/comando", { accion: accion }, "0");
      if (r.ok && r.datos.ok !== false) { lcd("LED", "orden enviada"); detalle("Orden de " + nombre + " el LED enviada. El ESP32 la ejecutará cuando consulte las órdenes (en unos segundos). Se entrega una sola vez."); consola("0", "API · POST /esp32/comando", "Orden: " + nombre + " el LED → enviada", true); }
      else { lcd("LED", "no se envio"); const m = r.dormido ? "el servidor tardó demasiado en despertar" : String((r.datos && (r.datos.detalle || r.datos.mensaje)) || "el servidor respondió " + r.status); detalle("No se pudo enviar la orden: " + m + "."); consola("0", "API · POST /esp32/comando", "Error: " + m, false); }
    } finally { bloquear(false); $("led-on").disabled = $("led-off").disabled = false; }
  }
  $("led-on").onclick = () => enviarLed("encender_led");
  $("led-off").onclick = () => enviarLed("apagar_led");

  // ---------- pulsar una tecla ----------
  async function pulsar(k) {
    if (ocupado) { avisarToast("Espera a que termine la consulta anterior."); return; }
    const t = TECLAS.find(x => x[0] === k); if (!t) return;
    marcar(k); $("tec-led").hidden = (k !== "0");
    if (k === "0") { lcd("LED del ESP32", "elige abajo"); detalle("Elige «Encender LED» o «Apagar LED»."); consola("0", "ESP32", "Panel del LED abierto (no se envió ninguna orden)", true); return; }
    if (k === "B") { lcd("WiFi / IP", "No disponible"); detalle("Solo el ESP32 conoce su WiFi y su dirección IP, y no las envía a la API. Se ven en la pantalla física."); consola("B", "No disponible", "El ESP32 no envía su WiFi ni su IP", false); return; }
    bloquear(true); lcd("Consultando...", t[1]); detalle("");
    try {
      if (!t[3]) {                                                              // 1, 8, 9: ThingSpeak
        let r; try { r = await localTS(k); } catch (e) { r = { l1: "Error", l2: "ThingSpeak", det: "No se pudo leer ThingSpeak: " + (e.message || e), ok: false }; }
        lcd(r.l1, r.l2); detalle(r.det); consola(k, "ThingSpeak", r.l1 + " | " + r.l2 + " — " + r.det, r.ok !== false);
      } else {                                                                  // 2-7, A: API
        const t0 = Date.now(), r = await pedir("GET", t[3], null, k), seg = ((Date.now() - t0) / 1000).toFixed(1);
        const d = r.datos || {};
        if (r.ok && d.linea1 !== undefined) { lcd(d.linea1, d.linea2); detalle(d.detalle || ""); consola(k, "API · GET " + t[3] + " · " + seg + " s", String(d.linea1) + " | " + String(d.linea2 || "") + (d.detalle ? " — " + d.detalle : ""), true); }
        else {
          const m = r.dormido ? "el servidor tardó demasiado en despertar" : String(d.detail || d.detalle || "la API respondió " + r.status);
          lcd("Error", r.dormido ? "sin respuesta" : "API " + r.status); detalle("No se pudo consultar: " + m + "."); consola(k, "API · GET " + t[3], "Error: " + m, false);
        }
      }
    } finally { bloquear(false); }
  }
})();
