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
  { clave: "tds",      nombre: "TDS",                  unidad: "ppm", dec: 0, rango: "tds",           color: "#8b5cf6", tipo: "line",   icono: null,       clase: "t-morado", etiqueta: "TDS" }
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

/* Lee datos del canal. op: { results, start, end, average }  -> { canal, feeds:[{t:Date, v:{temp,humAire,humSuelo,tds}}] }
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
      humSuelo: tsNum(f["field" + c.campos.humSuelo]), tds: tsNum(f["field" + c.campos.tds])
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

/* Último registro de la API, unos 15 s, para no pedirlo en cada tarjeta. */
let tsCacheUltimo = { t: 0, mapa: null, pending: null };

function tsClaveDeNombre(nombre) {
  const n = String(nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!n || /\bph\b/.test(n)) return null;
  if (n.includes("tds") || n.includes("solidos")) return "tds";
  if (n.includes("humedad") && n.includes("suelo")) return "humSuelo";
  if (n.includes("humedad del aire") || n.includes("humedad ambiental")) return "humAire";
  if (n.includes("temperatura") && !n.includes("suelo")) return "temp";
  return null;
}

function tsMapaDesdeRegistro(j) {
  const mapa = {};
  const poner = (nombre, valor) => {
    const clave = tsClaveDeNombre(nombre);
    if (!clave || Object.prototype.hasOwnProperty.call(mapa, clave)) return;
    const n = typeof valor === "number" ? (isFinite(valor) ? valor : null) : tsNum(String(valor).trim().replace(",", "."));
    if (n !== null) mapa[clave] = n;
  };
  if (j && Array.isArray(j.valores) && j.valores.length) {
    j.valores.forEach(v => poner(v && v.nombre, v && v.valor));
    return mapa;
  }
  String((j && j.detalle) || "").split(";").forEach(parte => {
    const i = parte.indexOf(":");
    if (i < 0) return;
    poner(parte.slice(0, i), parte.slice(i + 1));
  });
  return mapa;
}

/* Rellena ult solo donde ThingSpeak lo dejó en null. 0 cuenta. No toca las series. */
async function tsCompletarDesdeApi(R) {
  if (!R) return R;
  let mapa = tsCacheUltimo.mapa;
  if (!mapa || Date.now() - tsCacheUltimo.t >= 15000) {
    try {
      if (!tsCacheUltimo.pending) {
        tsCacheUltimo.pending = fetch(API_BASE_URL + "/menu/ultimo-registro", { cache: "no-store" })
          .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(j => {
            const m = tsMapaDesdeRegistro(j);
            tsCacheUltimo = { t: Date.now(), mapa: m, pending: null };
            return m;
          })
          .catch(e => { tsCacheUltimo.pending = null; throw e; });
      }
      mapa = await tsCacheUltimo.pending;
    } catch (e) { return R; }
  }
  TS_MEDIDAS.forEach(m => {
    const n = mapa[m.clave];
    if (R[m.clave] && R[m.clave].ult === null && n !== undefined && isFinite(n)) {
      R[m.clave].ult = n;
      R[m.clave].fuente = "api";
    }
  });
  return R;
}

/* normal / bajo / alto / sin dato, usando RANGOS de config.js */
function tsEvaluar(clave, v) {
  const m = tsMedida(clave), r = RANGOS[m.rango];
  if (v === null || v === undefined) return "sin";
  if (v < r[0]) return "bajo";
  if (v > r[1]) return "alto";
  return "normal";
}

/* Dirección del gráfico oficial de ThingSpeak: el MISMO formato que da su código "iframe" (Compartir > Embed), p. ej.
   https://thingspeak.com/channels/3540815/charts/1?bgcolor=%23ffffff&color=%23ef4444&dynamic=true&results=60&title=Temperatura+del+aire+%28%C2%B0C%29&type=line&xaxis=Hora&yaxis=%C2%B0C
   Sin opciones: gráfico en tiempo real (dynamic=true, últimas 60 lecturas).
   Con o.start / o.end (YYYY-MM-DD HH:MM:SS, hora de Colombia) y o.average (minutos): rango de fechas (lo usa el Historial). */
function tsChartUrl(m, o) {
  o = o || {};
  const c = tsCfg();
  if (!c.channelId) return "";
  const manual = c.graficos && c.graficos[m.clave.toLowerCase()];
  if (manual && !o.start) return manual;
  const p = new URLSearchParams();
  p.set("bgcolor", "#ffffff"); p.set("color", m.color);
  if (o.start) {
    p.set("dynamic", "false"); p.set("start", o.start); p.set("end", o.end); p.set("timezone", "America/Bogota");
    if (o.average) p.set("average", String(o.average));
  } else { p.set("dynamic", "true"); p.set("results", String(o.results || c.resultados || 60)); }
  p.set("title", m.nombre + (m.unidad ? " (" + m.unidad + ")" : ""));
  p.set("type", o.tipo || m.tipo); p.set("xaxis", "Hora"); p.set("yaxis", m.unidad || m.nombre);
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
