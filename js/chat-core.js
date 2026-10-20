/* ==========================================================
   AgroIA — núcleo del chat
   1) Órdenes LED: POST /esp32/comando (ya existe en el backend)
   2) Intenta POST {CHAT_ENDPOINT} { texto } -> { respuesta }
   3) Si no hay /chat, responde con datos de ThingSpeak (temp, humedades, TDS)
   ========================================================== */
async function chatPreguntar(texto) {
  const q = sinAcentos(texto);
  // --- Órdenes al ESP32 (no dependen de /chat) ---
  if (/\b(enciend|prend)/.test(q) && /\b(led|luz|esp32)\b/.test(q)) {
    return await enviarComandoEsp32("encender_led", "Orden enviada: <b>encender LED</b>. El ESP32 la aplicará en el próximo ciclo (GET /esp32/comando).");
  }
  if (/\b(apag)/.test(q) && /\b(led|luz|esp32)\b/.test(q)) {
    return await enviarComandoEsp32("apagar_led", "Orden enviada: <b>apagar LED</b>. El ESP32 la aplicará en el próximo ciclo (GET /esp32/comando).");
  }

  const h = { "Content-Type": "application/json" };
  const tok = typeof obtenerToken === "function" ? obtenerToken() : null;
  if (tok) h["Authorization"] = "Bearer " + tok;
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(CHAT_ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ texto: texto }), signal: ctl.signal });
    if (r.ok) {
      const d = await r.json();
      if (d.respuesta || d.message || d.detail) {
        return { html: d.respuesta || d.message || d.detail, nota: "" };
      }
    }
  } catch (e) { /* servidor sin /chat: respuesta local */ }
  return await respuestaLocal(texto);
}

async function enviarComandoEsp32(accion, mensajeOk) {
  const url = (typeof ESP32_COMANDO_URL !== "undefined") ? ESP32_COMANDO_URL : (API_BASE_URL + "/esp32/comando");
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: accion })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    if (d.ok === false) return { html: "No se pudo fijar la orden: " + (d.detalle || "error"), nota: "" };
    return { html: mensajeOk, nota: "" };
  } catch (e) {
    return { html: "No pude contactar <b>/esp32/comando</b> (" + e.message + "). Revisa que la API esté en línea.", nota: "" };
  }
}

async function respuestaLocal(texto) {
  const q = sinAcentos(texto), NOTA = "Respuesta con datos de ThingSpeak (sin IA de servidor).";
  const quiere = re => re.test(q);
  if (quiere(/\b(hola|buenas|buenos|saludos)\b/))
    return { html: "Hola, soy AgroIA. Puedes preguntarme por temperatura, humedad del aire, humedad del suelo, TDS o el estado general. También: «enciende el LED» / «apaga el LED».", nota: "" };

  let feeds = [];
  try {
    const res = await tsFeeds({ results: 5 });
    feeds = res.feeds || [];
  } catch (e) { /* sin TS */ }
  const ult = feeds[0] && feeds[0].v ? feeds[0].v : {};
  const ant = feeds[0] && feeds[0].t ? " (última lectura: " + fmtFechaHora(feeds[0].t) + ")" : "";

  const frase = (clave, etiqueta) => {
    const v = ult[clave];
    if (v === null || v === undefined) return "No hay dato reciente de " + etiqueta + " en ThingSpeak.";
    const m = tsMedida(clave);
    return etiqueta + ": <b>" + fmtVal(m, v) + "</b>";
  };

  if (quiere(/\btemp|calor|frio|grados\b/)) return { html: frase("temp", "Temperatura del aire") + ant, nota: NOTA };
  if (quiere(/\bhumedad del aire|humedad aire\b/) || (quiere(/\bhumedad\b/) && quiere(/\baire\b/)))
    return { html: frase("humAire", "Humedad del aire") + ant, nota: NOTA };
  if (quiere(/\bhumedad del suelo|humedad suelo|suelo\b/) && !quiere(/\btds\b/))
    return { html: frase("humSuelo", "Humedad del suelo") + ant, nota: NOTA };
  if (quiere(/\btds\b|conductividad|solidos disueltos|ppm\b/) || quiere(/\bph\b/))
    return { html: frase("tds", "TDS") + ant + (quiere(/\bph\b/) ? " <i>(El proyecto usa TDS en lugar de pH.)</i>" : ""), nota: NOTA };
  if (quiere(/\bestado|resumen|como esta|general\b/)) {
    return {
      html: "Estado reciente — temp <b>" + fmtVal(tsMedida("temp"), ult.temp) + "</b>, hum. aire <b>" +
        fmtVal(tsMedida("humAire"), ult.humAire) + "</b>, hum. suelo <b>" + fmtVal(tsMedida("humSuelo"), ult.humSuelo) +
        "</b>, TDS <b>" + fmtVal(tsMedida("tds"), ult.tds) + "</b>." + ant,
      nota: NOTA
    };
  }
  if (quiere(/\b(led|esp32|comando)\b/))
    return { html: "Para el LED escribe <b>enciende el LED</b> o <b>apaga el LED</b>. Se envía a /esp32/comando.", nota: "" };

  return { html: "Puedo informar temperatura, humedad del aire, humedad del suelo, TDS o el estado general. También control del LED del ESP32.", nota: "" };
}

function sinAcentos(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function chatBurbuja(log, tipo, html, nota) {
  const d = document.createElement("div");
  d.className = "chat-burbuja " + (tipo === "yo" ? "yo" : "ia");
  d.innerHTML = html + (nota ? "<div class=\"chat-nota\">" + nota + "</div>" : "");
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

function chatConectar(o) {
  const log = $(o.log), campo = $(o.campo), boton = $(o.boton);
  async function enviar() {
    const t = (campo.value || "").trim();
    if (!t) return;
    campo.value = "";
    chatBurbuja(log, "yo", t.replace(/</g, "&lt;"));
    boton.disabled = true;
    const pensando = chatBurbuja(log, "ia", "Pensando...");
    try {
      const r = await chatPreguntar(t);
      pensando.remove();
      chatBurbuja(log, "ia", r.html, r.nota);
    } catch (e) {
      pensando.remove();
      chatBurbuja(log, "ia", "No pude procesar el mensaje. Intenta de nuevo.");
    }
    boton.disabled = false;
    campo.focus({ preventScroll: true });
  }
  boton.onclick = enviar;
  campo.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });
  return enviar;
}
