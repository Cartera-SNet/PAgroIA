/* ==========================================================
   AgroIA - ThingSpeak: configuración efectiva, lectura de datos y direcciones de gráficos.
   La configuración base está en js/config.js (objeto THINGSPEAK). Desde "Configuración"
   se puede cambiar el canal en este navegador sin tocar archivos (se guarda en localStorage).
   ========================================================== */
const TS_LS = "agroia_ts";

function tsCfg() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(TS_LS) || "{}"); } catch (e) { o = {}; }
  const c = Object.assign({}, THINGSPEAK, { campos: Object.assign({}, THINGSPEAK.campos) });
  if (o.channelId) c.channelId = String(o.channelId).trim();
  return c;
}
const tsGuardarCfg = obj => localStorage.setItem(TS_LS, JSON.stringify(obj));
const tsBorrarCfg = () => localStorage.removeItem(TS_LS);

// Las 4 mediciones del proyecto (el número de Field sale de THINGSPEAK.campos en config.js)
const TS_MEDIDAS = [
  { clave: "temp",     nombre: "Temperatura del aire", unidad: "°C", dec: 1, rango: "temp_aire",     color: "#ef4444", tipo: "line",   icono: "i-therm",  clase: "t-rojo" },
  { clave: "humAire",  nombre: "Humedad del aire",     unidad: "%",  dec: 0, rango: "humedad_aire",  color: "#3b82f6", tipo: "column", icono: "i-drop",   clase: "t-azul" },
  { clave: "humSuelo", nombre: "Humedad del suelo",    unidad: "%",  dec: 0, rango: "humedad_suelo", color: "#16a34a", tipo: "line",   icono: "i-sprout", clase: "t-verde" },
  { clave: "ph",       nombre: "pH del suelo",         unidad: "",   dec: 1, rango: "ph",            color: "#8b5cf6", tipo: "line",   icono: null,       clase: "t-morado" }
];
const tsMedida = clave => TS_MEDIDAS.find(m => m.clave === clave);

const tsNum = x => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const fmtNum = (v, dec) => (v === null || v === undefined || isNaN(v)) ? "—" : Number(v).toFixed(dec);
const fmtVal = (m, v) => v === null || v === undefined ? "—" : fmtNum(v, m.dec) + (m.unidad ? " " + m.unidad : "");

function horaAMPM(d) {
  const h = d.getHours(), mi = d.getMinutes();
  return (h % 12 || 12) + ":" + (mi < 10 ? "0" : "") + mi + " " + (h >= 12 ? "PM" : "AM");
}
const dos = n => (n < 10 ? "0" : "") + n;
const fmtFecha = d => dos(d.getDate()) + "/" + dos(d.getMonth() + 1) + "/" + d.getFullYear();
const fmtFechaHora = d => fmtFecha(d) + " " + dos(d.getHours()) + ":" + dos(d.getMinutes());
const fmtISO = d => d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());

/* Lee datos del canal. op: { results, start, end, average }  -> { canal, feeds:[{t:Date, v:{temp,humAire,humSuelo,ph}}] }
   Devuelve null si no hay canal configurado. */
async function tsFeeds(op) {
  op = op || {};
  const c = tsCfg();
  if (!c.channelId) return null;
  const q = [["results", op.results || c.resultados || 60]];
  if (op.start) q.push(["start", op.start]);
  if (op.end) q.push(["end", op.end]);
  if (op.average) q.push(["average", op.average]);
  q.push(["timezone", "America/Bogota"]);
  const qs = q.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const r = await fetch(c.apiBase + "/channels/" + c.channelId + "/feeds.json?" + qs, { cache: "no-store" });
  if (!r.ok) throw new Error("ThingSpeak respondió " + r.status);
  const j = await r.json();
  const feeds = (j.feeds || []).map(f => ({
    t: new Date(f.created_at),
    v: {
      temp: tsNum(f["field" + c.campos.temp]), humAire: tsNum(f["field" + c.campos.humAire]),
      humSuelo: tsNum(f["field" + c.campos.humSuelo]), ph: tsNum(f["field" + c.campos.ph])
    }
  }));
  return { canal: j.channel || {}, feeds: feeds };
}

/* Última lectura de cada variable + primera de la ventana (para la variación) */
function tsResumen(feeds) {
  const out = {};
  TS_MEDIDAS.forEach(m => {
    const s = (feeds || []).map(f => f.v[m.clave]).filter(v => v !== null);
    out[m.clave] = { ult: s.length ? s[s.length - 1] : null, primero: s.length ? s[0] : null, n: s.length, serie: s,
                     prom: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null };
  });
  return out;
}

/* normal / bajo / alto / sin dato, usando RANGOS de config.js */
function tsEvaluar(clave, v) {
  const m = tsMedida(clave), r = RANGOS[m.rango];
  if (v === null || v === undefined) return "sin";
  if (v < r[0]) return "bajo";
  if (v > r[1]) return "alto";
  return "normal";
}

/* Dirección del gráfico oficial de ThingSpeak (el mismo formato que da su código "iframe") */
function tsChartUrl(m, o) {
  o = o || {};
  const c = tsCfg();
  if (!c.channelId) return "";
  const manual = c.graficos && c.graficos[m.clave.toLowerCase()];
  if (manual) return manual;
  const p = new URLSearchParams({
    bgcolor: "#ffffff", color: m.color, dynamic: "true", results: String(o.results || c.resultados || 60),
    type: o.tipo || m.tipo, update: String(c.refrescoSegundos), xaxis: "Hora", yaxis: m.unidad || "pH", title: " "
  });
  return "https://thingspeak.com/channels/" + c.channelId + "/charts/" + c.campos[m.clave] + "?" + p.toString();
}
const tsPublicUrl = () => { const c = tsCfg(); return c.channelId ? "https://thingspeak.mathworks.com/channels/" + c.channelId : ""; };

/* Estado del sistema (barra superior y menú lateral) según la última lectura */
function tsPintarEstado(res) {
  const c = tsCfg();
  if (!c.channelId) return setEstadoSistema("gris", "Canal sin configurar", null);
  if (!res || !res.feeds.length) return setEstadoSistema("bad", "Sin datos", null);
  const ult = res.feeds[res.feeds.length - 1].t;
  const ok = (Date.now() - ult.getTime()) / 60000 <= c.minutosEnLinea;
  setEstadoSistema(ok ? "ok" : "warn", ok ? "Sistema en línea" : "Sin datos recientes", ult);
}

/* Pone un iframe de ThingSpeak en un contenedor (o un aviso si falta el canal) */
function tsMontarIframe(cont, m, o) {
  const url = tsChartUrl(m, o);
  cont.innerHTML = "";
  if (!url) {
    cont.innerHTML = '<div class="graf-aviso">Falta configurar el canal de ThingSpeak.<br><a href="' + RAIZ + 'pages/configuracion.html">Ir a Configuración</a></div>';
    return "";
  }
  const f = document.createElement("iframe");
  f.title = m.nombre + " (ThingSpeak)"; f.loading = "lazy"; f.setAttribute("scrolling", "no"); f.src = url;
  cont.appendChild(f);
  return url;
}
