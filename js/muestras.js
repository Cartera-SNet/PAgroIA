/* ==========================================================
   AgroIA — datos desde la API Neon (POST/GET /muestras)
   Parametro_Id en producción:
     1 = humedad suelo, 2 = temp aire, 3 = hum aire, 4 = pH (legacy), 5 = TDS
   ========================================================== */
const PARAM_CLAVE = {
  1: "humSuelo",
  2: "temp",
  3: "humAire",
  5: "tds"
};

async function apiMuestrasList() {
  const r = await fetch(API_BASE_URL + "/muestras/list", { cache: "no-store" });
  if (!r.ok) throw new Error("muestras HTTP " + r.status);
  return await r.json();
}

/** Normaliza lista de la API → feeds estilo ThingSpeak: [{ t:Date, v:{temp,humAire,humSuelo,tds} }] */
function muestrasAFeeds(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  // Agrupar por minuto (o segundo) de fecha
  const porTiempo = new Map();
  for (const m of arr) {
    if (!m || m.Parametro_Id == null) continue;
    const clave = PARAM_CLAVE[m.Parametro_Id];
    if (!clave) continue; // ignora pH (4) u otros
    const t = new Date(m.Muestra_FechaHora);
    if (isNaN(t.getTime())) continue;
    // clave de agrupación: ISO sin ms, redondeado a segundo
    const k = t.toISOString().slice(0, 19);
    if (!porTiempo.has(k)) {
      porTiempo.set(k, { t: t, v: { temp: null, humAire: null, humSuelo: null, tds: null } });
    }
    const row = porTiempo.get(k);
    const val = parseFloat(m.Muestra_Valor);
    if (isFinite(val)) row.v[clave] = val;
  }
  const feeds = Array.from(porTiempo.values()).sort((a, b) => a.t - b.t);
  return feeds;
}

/** Último valor no nulo por variable */
function muestrasResumen(feeds) {
  const out = {};
  const claves = ["temp", "humAire", "humSuelo", "tds"];
  for (const c of claves) {
    const serie = (feeds || []).map(f => f.v[c]).filter(v => v !== null && v !== undefined);
    out[c] = {
      ult: serie.length ? serie[serie.length - 1] : null,
      primero: serie.length ? serie[0] : null,
      n: serie.length,
      serie: serie,
      prom: serie.length ? serie.reduce((a, b) => a + b, 0) / serie.length : null
    };
  }
  // última marca de tiempo con cualquier dato
  let tUlt = null;
  if (feeds && feeds.length) tUlt = feeds[feeds.length - 1].t;
  out._tUlt = tUlt;
  return out;
}

/** Carga y cache corta (15 s) */
let _cacheMuestras = null, _cacheAt = 0;
async function cargarMuestras(forzar) {
  const ahora = Date.now();
  if (!forzar && _cacheMuestras && (ahora - _cacheAt) < 15000) return _cacheMuestras;
  const lista = await apiMuestrasList();
  const feeds = muestrasAFeeds(lista);
  const resumen = muestrasResumen(feeds);
  _cacheMuestras = { lista: lista, feeds: feeds, resumen: resumen, total: Array.isArray(lista) ? lista.length : 0 };
  _cacheAt = ahora;
  return _cacheMuestras;
}

/** Mezcla: si ThingSpeak no trae una variable, usa Neon */
function fusionarResumen(tsR, neonR) {
  const out = {};
  for (const c of ["temp", "humAire", "humSuelo", "tds"]) {
    const a = (tsR && tsR[c]) || {};
    const b = (neonR && neonR[c]) || {};
    out[c] = {
      ult: a.ult != null ? a.ult : b.ult,
      primero: a.primero != null ? a.primero : b.primero,
      n: (a.n || 0) + (b.n || 0),
      serie: (a.serie && a.serie.length) ? a.serie : (b.serie || []),
      prom: a.prom != null ? a.prom : b.prom
    };
  }
  return out;
}
