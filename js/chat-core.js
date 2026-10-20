/* AgroIA — chat: LED vía /esp32/comando, sensores vía ThingSpeak, resto vía /chat o local */
async function chatPreguntar(texto) {
  const q = sinAcentos(texto || "");

  // 1) Órdenes LED → API ESP32
  if (/\b(enciend|prend)/.test(q) && /\b(led|luz|esp32)\b/.test(q)) {
    return await enviarComandoEsp32("encender_led", "Orden enviada: <b>encender LED</b>. El ESP32 la aplicará en el próximo ciclo (GET /esp32/comando).");
  }
  if (/\b(apag)/.test(q) && /\b(led|luz|esp32)\b/.test(q)) {
    return await enviarComandoEsp32("apagar_led", "Orden enviada: <b>apagar LED</b>. El ESP32 la aplicará en el próximo ciclo (GET /esp32/comando).");
  }

  // 2) Preguntas de sensores / estado → ThingSpeak (datos reales del canal)
  if (esPreguntaSensores(q)) {
    return await respuestaLocal(texto);
  }

  // 3) Resto: intentar /chat del backend; si no aporta, ThingSpeak/local
  const h = { "Content-Type": "application/json" };
  try {
    if (typeof obtenerToken === "function") {
      const tok = obtenerToken();
      if (tok) h["Authorization"] = "Bearer " + tok;
    }
  } catch (e) {}
  try {
    const ctl = new AbortController();
    setTimeout(function () { ctl.abort(); }, 8000);
    const r = await fetch(CHAT_ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ texto: texto }), signal: ctl.signal });
    if (r.ok) {
      const d = await r.json();
      const msg = d.respuesta || d.message || d.detail || "";
      // Ignorar respuesta genérica solo-LED del backend
      if (msg && !/solo|menu\/\*|Monitoreo\/Historial/i.test(msg) && !/^Puedo enviar órdenes al ESP32/i.test(msg)) {
        return { html: msg, nota: "" };
      }
    }
  } catch (e) {}
  return await respuestaLocal(texto);
}

function esPreguntaSensores(q) {
  return (
    /\btemp|calor|frio|grados\b/.test(q) ||
    /\bhumedad\b/.test(q) ||
    /\btds\b|\bph\b|conductividad|solidos|ppm\b/.test(q) ||
    /\bestado|resumen|como esta|general|cultivo\b/.test(q) ||
    /\bhola|buenas|buenos|saludos\b/.test(q)
  );
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
    return { html: "No pude contactar <b>/esp32/comando</b> (" + e.message + ").", nota: "" };
  }
}

async function respuestaLocal(texto) {
  const q = sinAcentos(texto || "");
  const NOTA = "Datos en vivo del canal ThingSpeak.";
  if (/\b(hola|buenas|buenos|saludos)\b/.test(q)) {
    return {
      html: "Hola, soy AgroIA. Puedo decirte la <b>temperatura</b>, <b>humedad del aire</b>, <b>humedad del suelo</b>, <b>TDS</b> o el <b>estado general</b>. También: «enciende el LED» / «apaga el LED».",
      nota: ""
    };
  }

  var feeds = [];
  try {
    var res = await tsFeeds({ results: 10 });
    feeds = (res && res.feeds) ? res.feeds : [];
  } catch (e) {}

  var ult = {};
  var cuando = null;
  if (feeds.length) {
    var best = feeds[0];
    for (var i = 1; i < feeds.length; i++) {
      if (feeds[i].t && best.t && feeds[i].t > best.t) best = feeds[i];
    }
    ult = best.v || {};
    cuando = best.t;
  }

  function frase(clave, etiqueta) {
    var m = tsMedida(clave);
    var v = ult[clave];
    if (v === null || v === undefined) {
      if (clave === "tds") {
        return "Aún no hay lecturas de <b>TDS</b> en ThingSpeak (field 4 vacío). Cuando el ESP32 envíe TDS, aparecerá aquí.";
      }
      return "No hay dato reciente de " + etiqueta + " en ThingSpeak.";
    }
    return etiqueta + ": <b>" + fmtVal(m, v) + "</b>";
  }

  var extra = cuando ? " <span style=\"opacity:.7\">(últ. " + fmtFechaHora(cuando) + ")</span>" : "";

  if (/\btemp|calor|frio|grados\b/.test(q)) return { html: frase("temp", "Temperatura del aire") + extra, nota: NOTA };
  if (/\bhumedad del aire|humedad aire\b/.test(q) || (/\bhumedad\b/.test(q) && /\baire\b/.test(q) && !/\bsuelo\b/.test(q)))
    return { html: frase("humAire", "Humedad del aire") + extra, nota: NOTA };
  if (/\bhumedad del suelo|humedad suelo\b/.test(q) || (/\bhumedad\b/.test(q) && /\bsuelo\b/.test(q)))
    return { html: frase("humSuelo", "Humedad del suelo") + extra, nota: NOTA };
  if (/\btds\b|conductividad|solidos|ppm\b|\bph\b/.test(q))
    return { html: frase("tds", "TDS") + (/\bph\b/.test(q) ? " <i>(El proyecto usa TDS en lugar de pH.)</i>" : "") + extra, nota: NOTA };
  if (/\bestado|resumen|como esta|general|cultivo\b/.test(q)) {
    return {
      html: "Estado del cultivo — temp <b>" + fmtVal(tsMedida("temp"), ult.temp) + "</b>, hum. aire <b>" +
        fmtVal(tsMedida("humAire"), ult.humAire) + "</b>, hum. suelo <b>" + fmtVal(tsMedida("humSuelo"), ult.humSuelo) +
        "</b>, TDS <b>" + fmtVal(tsMedida("tds"), ult.tds) + "</b>." + extra,
      nota: NOTA
    };
  }
  if (/\b(led|esp32|comando)\b/.test(q))
    return { html: "Escribe <b>enciende el LED</b> o <b>apaga el LED</b>.", nota: "" };

  return {
    html: "Puedo informar <b>temperatura</b>, <b>humedades</b>, <b>TDS</b>, el <b>estado general</b> o controlar el <b>LED</b> del ESP32.",
    nota: ""
  };
}

function chatBurbuja(log, tipo, html, nota) {
  if (!log) return null;
  var d = document.createElement("div");
  d.className = "chat-burbuja " + (tipo === "yo" ? "yo" : "ia");
  d.innerHTML = html + (nota ? "<div class=\"chat-nota\">" + nota + "</div>" : "");
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

function chatConectar(o) {
  var log = typeof o.log === "string" ? $(o.log) : o.log;
  var campo = typeof o.campo === "string" ? $(o.campo) : o.campo;
  var boton = typeof o.boton === "string" ? $(o.boton) : o.boton;
  if (!log || !campo || !boton) return function () {};
  async function enviar() {
    var t = (campo.value || "").trim();
    if (!t) return;
    campo.value = "";
    chatBurbuja(log, "yo", (typeof soloTexto === "function" ? soloTexto(t) : String(t).replace(/</g, "&lt;")));
    boton.disabled = true;
    var pensando = chatBurbuja(log, "ia", "Pensando...");
    try {
      var r = await chatPreguntar(t);
      if (pensando) pensando.remove();
      chatBurbuja(log, "ia", r.html, r.nota);
    } catch (e) {
      if (pensando) pensando.remove();
      chatBurbuja(log, "ia", "No pude procesar el mensaje.");
    }
    boton.disabled = false;
    try { campo.focus({ preventScroll: true }); } catch (e) { campo.focus(); }
  }
  boton.onclick = enviar;
  campo.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  });
  return enviar;
}
