/* ==========================================================
   AgroIA - Chat con AgroIA (lo usan el Inicio y la página de Chat)

   Cómo responde, en este orden:
     1) Entiende el mensaje con js/chat-nlu.js (tolera tildes, mayúsculas y faltas de ortografía) y, si es una
        consulta conocida, la contesta aquí mismo con datos REALES del canal de ThingSpeak.
     2) Si es una orden del LED ("enciende el led", "apaga el led"...), la envía al ESP32:
        POST {API}/esp32/comando  { accion: "encender_led" | "apagar_led" }  (el ESP32 la recoge con GET /esp32/comando).
     3) Si no la entiende y el servidor tiene IA (POST {CHAT_ENDPOINT} { texto } -> { respuesta }), se la pregunta.
     4) Si nada de lo anterior sirve, responde "¿quisiste decir...?" con sugerencias que se pueden tocar.
   ========================================================== */

const TZ_CO = "America/Bogota";
const fechaCO = d => d.toLocaleString("sv-SE", { timeZone: TZ_CO }).replace("T", " ");       // "2026-10-19 08:30:00" (hora de Colombia)
const inicioDiaCO = haceDias => fechaCO(new Date(Date.now() - (haceDias || 0) * 86400000)).slice(0, 10) + " 00:00:00";
const finDiaCO = haceDias => fechaCO(new Date(Date.now() - (haceDias || 0) * 86400000)).slice(0, 10) + " 23:59:59";
const inicioHaceHoras = h => fechaCO(new Date(Date.now() - h * 3600000));
const haceTxt = m => m < 1 ? "menos de 1 min" : m < 60 ? m + " min" : m < 1440 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : Math.floor(m / 1440) + " día(s)";
const prom = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const desv = a => { if (a.length < 2) return null; const p = prom(a); return Math.sqrt(a.reduce((s, x) => s + (x - p) * (x - p), 0) / (a.length - 1)); };

/* ---------- conocimiento (los mismos rangos de js/config.js) ---------- */
const CHAT_ICONO = { normal: "✅", bajo: "⚠️", alto: "⚠️", muy_bajo: "🚨", muy_alto: "🚨" };
const CHAT_TXT_ESTADO = { normal: "normal", bajo: "bajo", alto: "alto", muy_bajo: "muy bajo", muy_alto: "muy alto" };
const CHAT_EXPLICA_PH = "El pH mide qué tan ácido o alcalino es el suelo (escala 0–14, 7 es neutro). Para la mayoría de cultivos lo ideal es entre 6.0 y 7.5.";
const CHAT_AVISO_PH = "ℹ️ El <b>pH</b> ya no se mide: el cuarto sensor del sistema es el <b>TDS</b> (sólidos disueltos, en ppm).";
const CHAT_CORTO = { temp: "temperatura", humAire: "humedad del aire", humSuelo: "humedad del suelo", tds: "TDS" };
function chatEstado(clave, v) {                                            // normal / bajo / muy_bajo / alto / muy_alto
  const r = RANGOS[tsMedida(clave).rango];
  return v < r[2] ? "muy_bajo" : v < r[0] ? "bajo" : v <= r[1] ? "normal" : v <= r[3] ? "alto" : "muy_alto";
}
const chatRango = clave => { const m = tsMedida(clave), r = RANGOS[m.rango]; return r[0] + "–" + r[1] + (m.unidad ? " " + m.unidad : ""); };
const CHAT_CONSEJO = {
  humSuelo: { muy_bajo: "El suelo está muy seco: riega pronto (mejor temprano o al atardecer) y revisa que el sensor esté bien enterrado.", bajo: "El suelo está algo seco: conviene programar un riego pronto.",
    normal: "La humedad es adecuada: no hace falta regar ahora.", alto: "El suelo está bastante húmedo: no riegues por ahora y revisa el drenaje.", muy_alto: "El suelo está saturado de agua: suspende el riego y mejora el drenaje para evitar hongos." },
  tds: { muy_bajo: "El TDS es muy bajo: casi no hay nutrientes disueltos; revisa la fertilización.", bajo: "El TDS es bajo: hay pocos nutrientes disueltos; revisa la fertilización.",
    normal: "El TDS (sales disueltas) está dentro del rango del proyecto.", alto: "El TDS está alto: hay muchas sales disueltas. Considera lavar el suelo con riego abundante y revisar el fertilizante y la calidad del agua.",
    muy_alto: "El TDS es muy alto: riesgo de estrés salino en las raíces. Usa agua de mejor calidad, lava el suelo y suspende los fertilizantes hasta que baje." },
  temp: { muy_bajo: "Hace mucho frío para la mayoría de cultivos: protege las plantas si es posible.", bajo: "La temperatura está algo baja: el crecimiento puede ser más lento.",
    normal: "La temperatura es adecuada.", alto: "Hace calor: riega en las horas frescas y considera dar sombra.", muy_alto: "Calor extremo: da sombra, riega en horas frescas y vigila que el suelo no se seque." },
  humAire: { muy_bajo: "El aire está muy seco: el suelo perderá agua rápido; riega con más frecuencia.", bajo: "El aire está algo seco: vigila la humedad del suelo, se evaporará más rápido.",
    normal: "La humedad del aire es adecuada.", alto: "El aire está húmedo: ventila y vigila hongos en las hojas.", muy_alto: "El aire está muy húmedo: alto riesgo de hongos; mejora la ventilación." }
};
const CHAT_EXPLICA = {
  temp: "La temperatura del aire influye en la evaporación del agua del suelo y en el ritmo de crecimiento. Para la mayoría de cultivos lo ideal es entre 15 y 30 °C.",
  humAire: "La humedad del aire indica cuánto vapor de agua hay en el ambiente. Con aire muy seco el suelo se seca más rápido; con aire muy húmedo aumenta el riesgo de hongos. Lo normal es 40–80 %.",
  humSuelo: "La humedad del suelo dice cuánta agua tiene la tierra disponible para las raíces. Menos de 30 % es suelo seco (conviene regar) y más de 60 % es exceso de agua.",
  tds: "El TDS (sólidos disueltos totales) mide la cantidad de sales y minerales disueltos en el agua o en la solución del suelo, en ppm. Un valor alto indica exceso de sales (riesgo para las raíces); uno muy bajo, pocos nutrientes. El rango de referencia del proyecto es 0–1000 ppm."
};

/* ---------- datos ---------- */
async function chatDatos() {
  const c = tsCfg();
  if (!c.channelId) return { error: "Aún no hay un canal de ThingSpeak configurado. Ve a <b>Configuración</b> para conectarlo." };
  let res;
  try { res = await tsFeeds({ results: 30 }); } catch (e) { return { error: "No pude consultar ThingSpeak en este momento. Intenta de nuevo en unos segundos." }; }
  if (!res || !res.feeds.length) return { error: "El canal de ThingSpeak todavía no tiene lecturas." };
  const R = tsResumen(res.feeds), ult = res.feeds[res.feeds.length - 1].t, hace = Math.max(0, Math.round((Date.now() - ult.getTime()) / 60000));
  return { R: R, ult: ult, hace: hace, antig: hace > c.minutosEnLinea ? " <i>(última lectura hace " + haceTxt(hace) + ")</i>" : "" };
}
// ventana de datos: la pedida; si no hay lecturas, las últimas 60 (y lo dice)
async function chatVentana(op, etiqueta) {
  let feeds = [], nota = etiqueta;
  try { const r = await tsFeeds(Object.assign({ results: 8000 }, op)); feeds = r ? r.feeds : []; } catch (e) { return { error: "No pude consultar ThingSpeak en este momento. Intenta de nuevo en unos segundos." }; }
  if (!feeds.length && !op.average) {
    try { const r = await tsFeeds({ results: 60 }); feeds = r ? r.feeds : []; } catch (e) { feeds = []; }
    if (feeds.length) nota = "las últimas " + feeds.length + " lecturas (no hay datos en " + etiqueta + "; la última fue hace " + haceTxt(Math.round((Date.now() - feeds[feeds.length - 1].t.getTime()) / 60000)) + ")";
  }
  if (!feeds.length) return { error: "No hay lecturas en " + etiqueta + "." };
  return { feeds: feeds, R: tsResumen(feeds), nota: nota };
}
const chatVars = it => it.vars.length ? it.vars : TS_MEDIDAS.map(m => m.clave);

function chatFrase(clave, D) {
  const m = tsMedida(clave), v = D.R[clave].ult;
  if (v === null) return "No hay lecturas de " + nombreMin(m) + " todavía" + (clave === "tds" ? " (el ESP32 aún no envía el TDS al campo 4 del canal)." : ".");
  const e = chatEstado(clave, v);
  return CHAT_ICONO[e] + " " + m.nombre + ": <b>" + fmtVal(m, v) + "</b> (" + (e === "normal" ? "normal " + chatRango(clave) : CHAT_TXT_ESTADO[e] + "; normal " + chatRango(clave)) + "). " + CHAT_CONSEJO[clave][e];
}
function chatFertilidad(D) {
  const est = TS_MEDIDAS.filter(m => D.R[m.clave].ult !== null).map(m => [m.clave, chatEstado(m.clave, D.R[m.clave].ult)]);
  const fuera = est.filter(x => x[1] !== "normal"), crit = fuera.filter(x => x[1].startsWith("muy"));
  return { nivel: !est.length ? null : (crit.length || fuera.length >= 2) ? "Baja" : fuera.length === 1 ? "Media" : "Alta", fuera: fuera };
}
const R_OK = (html, nota) => ({ html: html, nota: nota === undefined ? "Datos reales del canal de ThingSpeak." : nota });
const chip = t => '<button type="button" class="chip" data-q="' + esc(t) + '">' + esc(t) + "</button>";
const CHIPS_LED = chip("Enciende el LED") + " " + chip("Apaga el LED");

/* ---------- orden del LED ---------- */
async function chatEnviarLed(accion) {
  const h = { "Content-Type": "application/json" }, tk = obtenerToken();
  if (tk) h["Authorization"] = "Bearer " + tk;
  const nombre = accion === "encender_led" ? "encender el LED" : "apagar el LED";
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(API_BASE_URL + "/esp32/comando", { method: "POST", headers: h, body: JSON.stringify({ accion: accion }), signal: ctl.signal });
    clearTimeout(to);
    let d = {}; try { d = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (r.ok && d.ok !== false) return { html: "✅ Listo: envié la orden de <b>" + nombre + "</b>. El ESP32 la ejecutará cuando consulte las órdenes (en unos segundos).",
      nota: "La orden se entrega una sola vez. Si el LED no cambia, el firmware aún no consulta /esp32/comando." };
    return { html: "No pude enviar la orden de " + nombre + ": " + soloTexto(d.detalle || "el servidor respondió " + r.status) + ".", nota: "" };
  } catch (e) { return { html: "No pude comunicarme con el servidor para enviar la orden. Revisa tu conexión e inténtalo de nuevo.", nota: "" }; }
}

/* ---------- respuestas por intención ---------- */
async function responderIntencion(it) {
  if (it.vars.includes("ph")) {                                              // el usuario nombra el pH, que ya no se mide
    const resto = it.vars.filter(v => v !== "ph"), CON_VARS = ["valor", "valores", "promedio", "maxmin", "desviacion", "rango", "definicion"];
    if (CON_VARS.includes(it.id)) {
      if (!resto.length) return { html: (it.id === "definicion" ? "<b>pH:</b> " + CHAT_EXPLICA_PH + "<br><br>" : "") + CHAT_AVISO_PH + "<br>" + chip("¿Cuál es el TDS?") + " " + chip("Dame un resumen"), nota: "" };
      const r = await responderBase(Object.assign({}, it, { vars: resto }));
      return r ? { html: CHAT_AVISO_PH + "<br>" + r.html, nota: r.nota } : r;
    }
  }
  return responderBase(it);
}
async function responderBase(it) {
  const c = tsCfg();
  switch (it.id) {
    case "vacio": return { html: "Escribe tu pregunta o una orden, por ejemplo «¿cuál es la temperatura?» o «enciende el LED».", nota: "" };
    case "saludo": return { html: "¡Hola! Soy AgroIA 🌱. Puedes preguntarme por la temperatura, la humedad, el TDS, pedir un resumen o <b>encender y apagar el LED</b>.", nota: "" };
    case "gracias": return { html: "¡Con gusto! Si necesitas algo más de tu cultivo, aquí estoy.", nota: "" };
    case "adios": return { html: "¡Hasta luego! 🌱", nota: "" };
    case "ayuda": return { html: "Puedes escribirme con tus palabras (aunque se te pase una letra):<br>" + ["¿Cuál es la temperatura?", "¿Cómo está la humedad del suelo?", "Dame un resumen", "¿Necesito regar?", "Promedio de las últimas 24 horas", "Máximo y mínimo de hoy", "¿Hay alertas?", "Enciende el LED", "Apaga el LED"].map(chip).join(" "), nota: "" };
    case "led_ayuda": return { html: "Escríbeme «<b>enciende el LED</b>» o «<b>apaga el LED</b>» y envío la orden al ESP32.<br>" + CHIPS_LED, nota: "" };
    case "led_estado": return { html: "No puedo saber si el LED está encendido o apagado: solo envío órdenes al ESP32.<br>" + CHIPS_LED, nota: "" };
    case "led_sin_objeto": return { html: "¿Qué quieres que " + (it.accion === "apagar_led" ? "apague" : "encienda") + "? Por ahora solo controlo el <b>LED</b>: escribe «" + (it.accion === "apagar_led" ? "apaga el LED" : "enciende el LED") + "».", nota: "" };
    case "otro_aparato": return { html: "Por ahora solo puedo controlar el <b>LED</b>. La bomba, el ventilador y otros aparatos todavía no están conectados a las órdenes del ESP32.<br>" + CHIPS_LED, nota: "" };
    case "led":
      if (!it.accion) return { html: (it.ambiguo ? "No estoy seguro de qué quieres hacer con el LED. ¿Quieres encenderlo o apagarlo?" : "¿Quieres <b>encender</b> o <b>apagar</b> el LED?") + "<br>" + CHIPS_LED, nota: "" };
      return await chatEnviarLed(it.accion);
    case "enlaces": return { html: "🌐 <a href=\"" + location.origin + "/dashboard.html\" target=\"_blank\" rel=\"noopener\">Tablero web</a><br>📈 <a href=\"" + tsPublicUrl() + "\" target=\"_blank\" rel=\"noopener\">Gráficos en ThingSpeak</a><br>🔧 <a href=\"" + API_BASE_URL + "/docs\" target=\"_blank\" rel=\"noopener\">API (documentación)</a>", nota: "" };
    case "yolo": return { html: "El modelo de imágenes (YOLO) distingue <b>suelo húmedo</b> y <b>suelo seco</b>. Usa <b>Analizar imagen</b> o <b>Cámara en vivo</b> en el menú <i>Predicción</i>.", nota: "" };
    case "proyecto": return { html: "AgroIA es un sistema de diagnóstico de fertilidad del suelo (Inteligencia Artificial 26-2, CUL). Un ESP32 mide temperatura, humedad del aire, humedad del suelo y TDS (sólidos disueltos); envía los datos a una base de datos y a ThingSpeak; esta página los muestra, analiza fotos del suelo con YOLO y acepta órdenes para el ESP32.", nota: "" };
    case "definicion": return R_OK(it.vars.map(v => "<b>" + tsMedida(v).nombre + ":</b> " + CHAT_EXPLICA[v] + " (Rango normal: " + chatRango(v) + ".)").join("<br><br>"), "");
    case "rango": return R_OK((it.hipotetico ? "Para saber si un valor es bueno hay que compararlo con su rango:<br>" : "") + it.vars.map(v => tsMedida(v).nombre + ": rango normal <b>" + chatRango(v) + "</b>.").join("<br>"), "");
  }

  /* --- a partir de aquí hacen falta datos del canal --- */
  if (!c.channelId) return { html: "Aún no hay un canal de ThingSpeak configurado. Ve a <b>Configuración</b> para conectarlo.", nota: "" };
  const D = await chatDatos(); if (D.error) return { html: D.error, nota: "" };

  switch (it.id) {
    case "valor": case "valores": return R_OK(chatVars(it).map(v => chatFrase(v, D)).join("<br>") + D.antig);
    case "resumen": {
      const f = chatFertilidad(D);
      return R_OK("<b>Resumen de la última lectura:</b><br>" + TS_MEDIDAS.map(m => chatFrase(m.clave, D)).join("<br>") + (f.nivel ? "<br><br>🌱 Fertilidad estimada: <b>" + f.nivel + "</b> (por reglas)." : "") + D.antig);
    }
    case "alertas": {
      const fuera = TS_MEDIDAS.filter(m => D.R[m.clave].ult !== null && chatEstado(m.clave, D.R[m.clave].ult) !== "normal");
      return R_OK(fuera.length ? "🚨 Variables fuera del rango normal:<br>" + fuera.map(m => chatFrase(m.clave, D)).join("<br>") + D.antig : "✅ Sin alertas: todas las variables medidas están dentro del rango normal." + D.antig);
    }
    case "riego": {
      const v = D.R.humSuelo.ult; if (v === null) return R_OK("No tengo la humedad del suelo ahora mismo, así que no puedo decirte si hay que regar.");
      const e = chatEstado("humSuelo", v), si = e === "bajo" || e === "muy_bajo";
      return R_OK("💧 <b>" + (si ? "SÍ, conviene regar" : "NO hace falta regar ahora") + ".</b><br>Humedad del suelo: <b>" + fmtVal(tsMedida("humSuelo"), v) + "</b> (normal " + chatRango("humSuelo") + "). " + CHAT_CONSEJO.humSuelo[e] + D.antig);
    }
    case "recomendacion": {
      const fuera = TS_MEDIDAS.filter(m => D.R[m.clave].ult !== null && chatEstado(m.clave, D.R[m.clave].ult) !== "normal");
      return R_OK(fuera.length ? "🌾 Recomendaciones según los datos actuales:<br>" + fuera.map(m => "• <b>" + m.nombre + "</b> (" + fmtVal(m, D.R[m.clave].ult) + "): " + CHAT_CONSEJO[m.clave][chatEstado(m.clave, D.R[m.clave].ult)]).join("<br>") + D.antig
        : "✅ Todo está dentro de lo normal. Sigue monitoreando y riega solo si la humedad del suelo baja de 30 %." + D.antig);
    }
    case "fertilidad": {
      const f = chatFertilidad(D); if (!f.nivel) return R_OK("No tengo lecturas suficientes para estimar la fertilidad.");
      return R_OK("🌱 Fertilidad estimada: <b>" + f.nivel + "</b>.<br>" + (f.fuera.length ? "Fuera de rango: " + f.fuera.map(x => CHAT_CORTO[x[0]] + " (" + CHAT_TXT_ESTADO[x[1]] + ")").join(", ") + "." : "Todas las variables están en rango.") +
        "<br><small>Es una estimación orientativa por reglas; todavía no es el modelo de IA entrenado.</small>" + D.antig);
    }
    case "en_linea": {
      const ok = D.hace <= c.minutosEnLinea;
      return R_OK((ok ? "🟢 Sensor en línea: la última lectura fue hace " : "🔴 Sin datos recientes: la última lectura fue hace ") + "<b>" + haceTxt(D.hace) + "</b> (" + fmtFechaHora(D.ult) + ")." + (ok ? "" : " Revisa que el ESP32 esté encendido y con WiFi."), "");
    }
  }

  /* --- cálculos sobre una ventana de tiempo --- */
  const vars = chatVars(it);
  if (it.id === "promedio" || it.id === "desviacion") {
    const W = await chatVentana({ start: inicioHaceHoras(24), end: fechaCO(new Date()) }, "las últimas 24 horas"); if (W.error) return { html: W.error, nota: "" };
    if (it.id === "promedio") return R_OK("📊 Promedio de " + W.nota + ":<br>" + vars.map(v => { const m = tsMedida(v); return m.nombre + ": <b>" + fmtVal(m, W.R[v].prom) + "</b>"; }).join("<br>"));
    return R_OK("📉 Desviación estándar de " + W.nota + ":<br>" + vars.map(v => { const m = tsMedida(v), d = desv(W.R[v].serie); return m.nombre + ": <b>" + (d === null ? "—" : fmtNum(d, 2) + (m.unidad ? " " + m.unidad : "")) + "</b>"; }).join("<br>"));
  }
  if (it.id === "maxmin") {
    const W = await chatVentana({ start: inicioDiaCO(0), end: fechaCO(new Date()) }, "hoy"); if (W.error) return { html: W.error, nota: "" };
    return R_OK("📈 Máximo y mínimo de " + W.nota + ":<br>" + vars.map(v => { const m = tsMedida(v), s = W.R[v].serie; return m.nombre + ": máximo <b>" + fmtVal(m, s.length ? Math.max.apply(null, s) : null) + "</b> · mínimo <b>" + fmtVal(m, s.length ? Math.min.apply(null, s) : null) + "</b>"; }).join("<br>"));
  }
  if (it.id === "por_hora") {
    const W = await chatVentana({ start: inicioDiaCO(0), end: fechaCO(new Date()), average: 60 }, "hoy"); if (W.error) return { html: W.error, nota: "" };
    const m = tsMedida("humSuelo"), filas = W.feeds.filter(f => f.v.humSuelo !== null).slice(-8);
    return R_OK(filas.length ? "💧 Promedio por hora de la humedad del suelo (hoy):<br>" + filas.map(f => "• " + dos(f.t.getHours()) + ":00 → <b>" + fmtVal(m, f.v.humSuelo) + "</b>").join("<br>") : "Hoy todavía no hay lecturas de humedad del suelo para el promedio por hora.");
  }
  if (it.id === "por_dia") {
    const dias = await Promise.all([0, 1, 2].map(async d => {
      try { const r = await tsFeeds({ results: 8000, start: inicioDiaCO(d), end: finDiaCO(d) }); return [inicioDiaCO(d).slice(0, 10), r ? r.feeds.length : 0]; } catch (e) { return [inicioDiaCO(d).slice(0, 10), null]; }
    }));
    return R_OK("🗓️ Muestras por día (últimos 3 días):<br>" + dias.map(x => "• " + x[0] + ": <b>" + (x[1] === null ? "sin respuesta" : x[1]) + "</b>").join("<br>"), "Cuenta como máximo 8 000 por día. Datos reales de ThingSpeak.");
  }
  if (it.id === "dias_bajo") {
    let feeds = [];
    try { const r = await tsFeeds({ results: 8000, start: inicioDiaCO(6), end: fechaCO(new Date()), average: 1440 }); feeds = r ? r.feeds : []; } catch (e) { return { html: "No pude consultar ThingSpeak en este momento. Intenta de nuevo en unos segundos.", nota: "" }; }
    const dias = feeds.filter(f => f.v.humSuelo !== null), lim = RANGOS.humedad_suelo[0], bajos = dias.filter(f => f.v.humSuelo < lim);
    if (!dias.length) return R_OK("No hay lecturas de humedad del suelo en los últimos 7 días.");
    return R_OK(bajos.length ? "⚠️ " + bajos.length + " de " + dias.length + " día(s) con humedad promedio del suelo menor a " + lim + " %:<br>" + bajos.map(f => "• " + fmtISO(f.t) + ": <b>" + fmtNum(f.v.humSuelo, 1) + " %</b>").join("<br>")
      : "✅ En los últimos 7 días ningún día tuvo la humedad promedio del suelo por debajo de " + lim + " % (" + dias.length + " día(s) con datos).");
  }
  return null;
}

/* ---------- servidor de IA (opcional) y sugerencias ---------- */
async function chatServidor(texto) {
  try {
    const h = { "Content-Type": "application/json" }, tk = obtenerToken();
    if (tk) h["Authorization"] = "Bearer " + tk;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(CHAT_ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ texto: texto }), signal: ctl.signal });
    clearTimeout(to);
    if (r.ok) { const d = await r.json(); if (d && d.respuesta) return { html: soloTexto(d.respuesta), nota: "" }; }
  } catch (e) { /* el servidor aún no tiene /chat o no responde */ }
  return null;
}
function chatSugerencias(texto) {
  const s = ChatNLU.sugerir(texto, 3);
  return { html: "No estoy seguro de haber entendido «" + soloTexto(texto) + "»." + (s.length ? " ¿Quisiste decir?<br>" + s.map(chip).join(" ") : "<br>Prueba con:<br>" + ["¿Cuál es la temperatura?", "Dame un resumen", "Enciende el LED"].map(chip).join(" ")) +
    "<br><small>Escribe «ayuda» para ver todo lo que puedo hacer.</small>", nota: "" };
}

async function chatPreguntar(texto) {
  const it = ChatNLU.interpretar(texto);
  if (it.id !== "desconocido") { try { const r = await responderIntencion(it); if (r) return r; } catch (e) { console.error(e); return { html: "No pude procesar el mensaje. Intenta de nuevo.", nota: "" }; } }
  const s = await chatServidor(texto); if (s) return s;
  return chatSugerencias(texto);
}

/* Dibuja una burbuja. tipo: "yo" | "ia" */
function chatBurbuja(log, tipo, html, nota) {
  const b = document.createElement("div"); b.className = "msg " + tipo;
  if (tipo === "ia") b.innerHTML = '<span class="msg-av">' + ico("i-brain") + '</span><div class="msg-txt">' + html + (nota ? '<small class="msg-nota">' + nota + '</small>' : "") + "</div>";
  else b.innerHTML = '<div class="msg-txt">' + html + "</div>";
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
  // los botones de sugerencia dentro de las respuestas ("¿Quisiste decir...?", ejemplos) envían su texto
  log.addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) { campo.value = b.dataset.q; enviar(); } });
  return enviar;
}
