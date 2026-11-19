/* ==========================================================
   AgroIA - Voz del asistente Agro
   - escuchar(): dictado con el micrófono (Web Speech del navegador, Chrome/Edge). Gratis, sin claves.
   - hablar():   lee la respuesta. Usa la voz natural del servidor (POST /agro/voz) y, si no está disponible
                 o falla, la voz del navegador. Solo se llama cuando la persona habló por el micrófono.
   Aquí NO hay claves: la voz natural pasa por el backend.
   ========================================================== */
const AgroVoz = (function () {
  "use strict";
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LS_SILENCIO = "agroia_voz_silencio";
  const MAX_TROZO = 600, MAX_TROZOS = 2;          // se lee como máximo ~1200 caracteres; el resto queda solo en pantalla
  const ESPERA_NUBE_MS = 5 * 60000;               // si la voz del servidor falla, se usa la del navegador este tiempo
  let silenciado = false, turno = 0, audio = null, liberar = null, desbloqueado = false, rec = null, nubeCaidaHasta = 0;
  let estadoIA = { t: 0, ia: null };
  try { silenciado = localStorage.getItem(LS_SILENCIO) === "1"; } catch (e) { /* sin almacenamiento */ }

  const micDisponible = () => !!SR;
  const vozNavegadorDisponible = () => "speechSynthesis" in window;

  /* Los navegadores solo dejan sonar audio después de un clic: se «desbloquea» en el primer gesto */
  function desbloquear() {
    if (desbloqueado) return; desbloqueado = true;
    try { const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="); a.play().catch(function () {}); } catch (e) { /* nada */ }
  }

  function esSilenciado() { return silenciado; }
  function fijarSilencio(v) {
    silenciado = !!v;
    try { localStorage.setItem(LS_SILENCIO, silenciado ? "1" : "0"); } catch (e) { /* nada */ }
    if (silenciado) detener();
  }

  /* ¿El servidor tiene la IA / voz activada? (se consulta como mucho cada 5 minutos; un fallo no se guarda) */
  async function servidorConIA() {
    if (estadoIA.ia !== null && Date.now() - estadoIA.t < 5 * 60000) return estadoIA.ia;
    try {
      const ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 8000);
      const r = await fetch(AGRO_ESTADO_ENDPOINT, { cache: "no-store", signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) return false;
      const d = await r.json();
      estadoIA = { t: Date.now(), ia: !!(d && d.ia) };
      return estadoIA.ia;
    } catch (e) { return false; }
  }

  /* ---------- dictado ---------- */
  function escuchar(cb) {                         // cb: { alTexto(t), alTerminar(), alError(msg) }
    if (!SR) { if (cb.alError) cb.alError("Tu navegador no permite dictado por voz. Usa Chrome o Edge."); return null; }
    detener(); desbloquear();
    let recibido = false;
    const r = new SR(); rec = r;
    r.lang = "es-CO"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onresult = function (ev) {
      const t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript.trim() : "";
      if (t) { recibido = true; if (cb.alTexto) cb.alTexto(t); }
    };
    r.onerror = function (ev) {
      const e = ev && ev.error;
      const msg = e === "not-allowed" || e === "service-not-allowed" ? "El navegador no tiene permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones."
        : e === "no-speech" ? "No te escuché. Pulsa el micrófono e inténtalo de nuevo."
        : e === "audio-capture" ? "No encontré un micrófono."
        : e === "network" ? "El dictado por voz necesita conexión a internet."
        : e === "aborted" ? "" : "No pude usar el micrófono (" + (e || "error") + ").";
      if (msg && cb.alError) cb.alError(msg);
    };
    r.onend = function () { if (rec === r) rec = null; if (cb.alTerminar) cb.alTerminar(recibido); };
    try { r.start(); } catch (e) { rec = null; if (cb.alError) cb.alError("No pude iniciar el micrófono. Inténtalo de nuevo."); return null; }
    return r;
  }
  function dejarDeEscuchar() { if (rec) { try { rec.stop(); } catch (e) { /* nada */ } } }

  /* ---------- hablar ---------- */
  function trocear(texto) {
    const frases = String(texto).replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*\s*/g) || [String(texto)];
    const trozos = []; let actual = "";
    frases.forEach(function (f) {
      while (f.length > MAX_TROZO) { if (actual) { trozos.push(actual.trim()); actual = ""; } trozos.push(f.slice(0, MAX_TROZO).trim()); f = f.slice(MAX_TROZO); }
      if ((actual + f).length > MAX_TROZO && actual) { trozos.push(actual.trim()); actual = ""; }
      actual += f;
    });
    if (actual.trim()) trozos.push(actual.trim());
    return trozos.filter(Boolean).slice(0, MAX_TROZOS);
  }

  async function pedirAudio(texto) {              // -> { audio, formato } o null
    const h = { "Content-Type": "application/json" }, tk = obtenerToken();
    if (tk) h["Authorization"] = "Bearer " + tk;
    const ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 30000);
    try {
      const r = await fetch(AGRO_VOZ_ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ texto: texto }), signal: ctl.signal });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.ok && d.audio ? { audio: d.audio, formato: d.formato } : null;
    } catch (e) { return null; } finally { clearTimeout(to); }
  }

  function reproducir(r) {
    return new Promise(function (resolve) {
      const a = new Audio("data:" + (r.formato === "wav" ? "audio/wav" : "audio/mpeg") + ";base64," + r.audio);
      audio = a; liberar = resolve;
      a.onended = a.onerror = function () { resolve(); };
      a.play().catch(function () { resolve(); });   // si el navegador bloquea el sonido, se salta sin romper nada
    });
  }

  function hablarNavegador(texto, mio) {
    return new Promise(function (resolve) {
      if (!vozNavegadorDisponible()) return resolve();
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto); u.lang = "es-CO"; u.rate = 1;
        const vs = window.speechSynthesis.getVoices().filter(function (v) { return /^es/i.test(v.lang); });
        const v = vs.find(function (x) { return /CO|MX|US|419/i.test(x.lang); }) || vs[0]; if (v) u.voice = v;
        liberar = resolve; u.onend = u.onerror = function () { resolve(); };
        window.speechSynthesis.speak(u);
      } catch (e) { resolve(); }
    });
  }

  /* Lee el texto (ya sin etiquetas). cb: { alEstado(txt) } -> "Agro está hablando…" / "" */
  async function hablar(texto, cb) {
    if (silenciado) return;
    texto = String(texto || "").replace(/<[^>]*>/g, " ").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/\s+/g, " ").trim(); if (!texto) return;
    detener(); const mio = turno;
    const estado = function (t) { if (cb && cb.alEstado && mio === turno) cb.alEstado(t); };
    estado("Agro está preparando la voz…");
    const trozos = trocear(texto);
    let usoNube = false;
    if (Date.now() >= nubeCaidaHasta && await servidorConIA()) {
      if (mio !== turno) return;
      const pedidos = trozos.map(pedirAudio);     // se piden todos a la vez para que no haya pausas entre trozos
      let fallo = false;
      for (let i = 0; i < pedidos.length; i++) {
        const r = await pedidos[i];
        if (mio !== turno || silenciado) { estado(""); return; }
        if (!r) { fallo = true; break; }
        usoNube = true; estado("Agro está hablando…");
        await reproducir(r);
      }
      if (!fallo) { if (mio === turno) estado(""); return; }
      if (!usoNube) nubeCaidaHasta = Date.now() + ESPERA_NUBE_MS;   // la nube falló desde el primer trozo: se usa la del navegador un rato
      else { if (mio === turno) estado(""); return; }               // ya habló parte: no se repite con otra voz
    }
    if (mio !== turno || silenciado) { estado(""); return; }
    estado("Agro está hablando…");
    await hablarNavegador(texto.slice(0, MAX_TROZO * MAX_TROZOS), mio);
    estado("");
  }

  function detener() {
    turno++;
    if (audio) { try { audio.pause(); } catch (e) { /* nada */ } audio = null; }
    if (vozNavegadorDisponible()) { try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ } }
    if (liberar) { const l = liberar; liberar = null; l(); }
  }

  return { micDisponible: micDisponible, escuchar: escuchar, dejarDeEscuchar: dejarDeEscuchar, hablar: hablar, detener: detener,
           desbloquear: desbloquear, esSilenciado: esSilenciado, fijarSilencio: fijarSilencio, servidorConIA: servidorConIA };
})();
