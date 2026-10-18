/* ==========================================================
   AgroIA - Chat con AgroIA (lo usan el Inicio y la página de Chat)
   1) Intenta el servidor:  POST {CHAT_ENDPOINT}  { texto }  ->  { respuesta }
   2) Si el servidor aún no tiene /chat (Punto 4) o no responde, contesta con los datos reales
      de ThingSpeak (temperatura, humedades, pH, estado). Lo avisa en la propia burbuja.
   ========================================================== */

async function chatPreguntar(texto) {
  try {
    const h = { "Content-Type": "application/json" }, tk = obtenerToken();
    if (tk) h["Authorization"] = "Bearer " + tk;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(CHAT_ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ texto: texto }), signal: ctl.signal });
    clearTimeout(to);
    if (r.ok) { const d = await r.json(); return { html: soloTexto(d.respuesta || "Sin respuesta."), nota: "" }; }
  } catch (e) { /* servidor sin /chat o sin conexión: se usa la respuesta local */ }
  return await respuestaLocal(texto);
}

async function respuestaLocal(texto) {
  const q = sinAcentos(texto), NOTA = "Respuesta con datos de ThingSpeak, sin IA: el servidor aún no tiene el chat (/chat, Punto 4).";
  const quiere = re => re.test(q);

  if (quiere(/\b(led|esp32|comando|relay|bomba|riego)\b|\b(enciend|apag|prend)/))
    return { html: "Para enviar órdenes al ESP32 hace falta el chat del servidor (<b>/chat</b>) y el ESP32 consultando comandos. Eso corresponde al Punto 4 y todavía no está conectado.", nota: "" };
  if (quiere(/^\s*(hola|buenas|hey|buenos dias|buenas tardes|buenas noches)\b/))
    return { html: "Hola, soy AgroIA. ¿En qué puedo ayudarte? Puedes preguntarme por la temperatura, la humedad del aire, la humedad del suelo, el pH o el estado general del cultivo.", nota: "" };

  const c = tsCfg();
  if (!c.channelId) return { html: "Aún no hay un canal de ThingSpeak configurado. Ve a <b>Configuración</b> para conectarlo.", nota: "" };
  let res;
  try { res = await tsFeeds({ results: 30 }); } catch (e) { return { html: "No pude consultar ThingSpeak en este momento. Intenta de nuevo en unos segundos.", nota: "" }; }
  if (!res || !res.feeds.length) return { html: "El canal de ThingSpeak todavía no tiene lecturas.", nota: "" };

  const R = tsResumen(res.feeds), hace = Math.max(0, Math.round((Date.now() - res.feeds[res.feeds.length - 1].t.getTime()) / 60000));
  const frase = clave => {
    const m = tsMedida(clave), v = R[clave].ult, est = tsEvaluar(clave, v), rg = RANGOS[m.rango];
    if (v === null) return "No hay lecturas de " + m.nombre.toLowerCase() + ".";
    const art = { temp: "La temperatura actual del aire es de ", humAire: "La humedad del aire es de ", humSuelo: "La humedad del suelo es de ", ph: "El pH del suelo es de " }[clave];
    const val = "<b>" + fmtVal(m, v) + "</b>";
    const jui = est === "normal" ? " Está dentro del rango óptimo para el cultivo." :
      est === "bajo" ? " Está por debajo del rango óptimo (mínimo " + rg[0] + (m.unidad ? " " + m.unidad : "") + ")." :
                       " Está por encima del rango óptimo (máximo " + rg[1] + (m.unidad ? " " + m.unidad : "") + ").";
    return art + val + "." + jui;
  };
  const antig = hace > c.minutosEnLinea ? " (última lectura hace " + hace + " min)" : "";

  if (quiere(/\bph\b|acidez|acido/)) return { html: frase("ph") + antig, nota: NOTA };
  if (quiere(/humedad.*(suelo|tierra)|(suelo|tierra).*humedad|\bsuelo\b|\btierra\b/)) return { html: frase("humSuelo") + antig, nota: NOTA };
  if (quiere(/humedad.*aire|aire.*humedad/)) return { html: frase("humAire") + antig, nota: NOTA };
  if (quiere(/temperatura|calor|clima|grados/)) return { html: frase("temp") + antig, nota: NOTA };
  if (quiere(/humedad/)) return { html: frase("humAire") + "<br>" + frase("humSuelo") + antig, nota: NOTA };
  if (quiere(/estado|cultivo|resumen|como esta|como va|todo|datos|lecturas|sensor/)) {
    const fuera = TS_MEDIDAS.filter(m => ["bajo", "alto"].includes(tsEvaluar(m.clave, R[m.clave].ult))).map(m => m.nombre.toLowerCase());
    return { html: "Resumen de la última lectura: temperatura <b>" + fmtVal(tsMedida("temp"), R.temp.ult) + "</b>, humedad del aire <b>" + fmtVal(tsMedida("humAire"), R.humAire.ult) +
      "</b>, humedad del suelo <b>" + fmtVal(tsMedida("humSuelo"), R.humSuelo.ult) + "</b> y pH <b>" + fmtVal(tsMedida("ph"), R.ph.ult) + "</b>. " +
      (fuera.length ? "Fuera del rango óptimo: " + fuera.join(", ") + "." : "Todo está dentro del rango óptimo.") + antig, nota: NOTA };
  }
  return { html: "Puedo informarte la temperatura, la humedad del aire, la humedad del suelo, el pH o el estado general. Para preguntas abiertas hace falta el chat con IA del servidor (/chat, Punto 4).", nota: "" };
}

/* Dibuja una burbuja. tipo: "yo" | "ia" */
function chatBurbuja(log, tipo, html, nota) {
  const b = document.createElement("div"); b.className = "msg " + tipo;
  if (tipo === "ia") b.innerHTML = '<span class="msg-av">' + ico("i-brain") + '</span><div class="msg-txt">' + html + (nota ? '<small class="msg-nota">' + nota + '</small>' : '') + '</div>';
  else b.innerHTML = '<div class="msg-txt">' + html + '</div>';
  log.appendChild(b); log.scrollTop = log.scrollHeight;
  return b;
}

/* Conecta un formulario de chat (campo + botón + registro) */
function chatConectar(o) {
  const log = o.log, campo = o.campo, boton = o.boton;
  async function enviar() {
    const t = campo.value.trim(); if (!t) return;
    campo.value = ""; log.classList.add("activo");
    chatBurbuja(log, "yo", soloTexto(t));
    boton.disabled = true;
    const pensando = chatBurbuja(log, "ia", "Pensando...");
    try { const r = await chatPreguntar(t); pensando.remove(); chatBurbuja(log, "ia", r.html, r.nota); }
    catch (e) { pensando.remove(); chatBurbuja(log, "ia", "No pude procesar el mensaje. Intenta de nuevo."); }
    boton.disabled = false; campo.focus({ preventScroll: true });
  }
  boton.addEventListener("click", enviar);
  campo.addEventListener("keydown", e => { if (e.key === "Enter") enviar(); });
  return enviar;
}
