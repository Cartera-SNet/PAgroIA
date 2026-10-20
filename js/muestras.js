/* ==========================================================
   AgroIA — datos desde la API Neon (/muestras/list)
   Parametro_Id: 1=humSuelo, 2=temp, 3=humAire, 4=pH(legacy), 5=TDS
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

/** Agrupa por MINUTO para que cada fila tenga temp+hum+tds juntos */
function muestrasAFeeds(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const porTiempo = new Map();
  for (const m of arr) {
    if (!m || m.Parametro_Id == null) continue;
    const clave = PARAM_CLAVE[m.Parametro_Id];
    if (!clave) continue;
    const t = new Date(m.Muestra_FechaHora);
    if (isNaN(t.getTime())) continue;
    // minuto: YYYY-MM-DDTHH:MM
    const k = t.toISOString().slice(0, 16);
    if (!porTiempo.has(k)) {
      porTiempo.set(k, {
        t: new Date(k + ":00.000Z"),
        v: { temp: null, humAire: null, humSuelo: null, tds: null }
      });
    }
    const row = porTiempo.get(k);
    const val = parseFloat(m.Muestra_Valor);
    if (isFinite(val)) row.v[clave] = val;
  }
  return Array.from(porTiempo.values()).sort((a, b) => a.t - b.t);
}

function muestrasResumen(feeds) {
  const out = {};
  for (const c of ["temp", "humAire", "humSuelo", "tds"]) {
    const serie = (feeds || []).map(f => f.v[c]).filter(v => v !== null && v !== undefined);
    out[c] = {
      ult: serie.length ? serie[serie.length - 1] : null,
      primero: serie.length ? serie[0] : null,
      n: serie.length,
      serie: serie,
      prom: serie.length ? serie.reduce((a, b) => a + b, 0) / serie.length : null
    };
  }
  out._tUlt = (feeds && feeds.length) ? feeds[feeds.length - 1].t : null;
  return out;
}

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

function fusionarResumen(tsR, neonR) {
  const out = {};
  for (const c of ["temp", "humAire", "humSuelo", "tds"]) {
    const a = (tsR && tsR[c]) || {};
    const b = (neonR && neonR[c]) || {};
    // Preferir Neon si TS no trae valor (típico en TDS)
    const ult = (a.ult != null) ? a.ult : b.ult;
    out[c] = {
      ult: ult,
      primero: (a.primero != null) ? a.primero : b.primero,
      n: Math.max(a.n || 0, b.n || 0),
      serie: (a.serie && a.serie.length) ? a.serie : (b.serie || []),
      prom: (a.prom != null) ? a.prom : b.prom
    };
  }
  // TDS: forzar Neon si existe (ThingSpeak field4 suele ir vacío)
  if (neonR && neonR.tds && neonR.tds.ult != null) {
    out.tds = Object.assign({}, out.tds, {
      ult: neonR.tds.ult,
      serie: neonR.tds.serie && neonR.tds.serie.length ? neonR.tds.serie : out.tds.serie,
      prom: neonR.tds.prom != null ? neonR.tds.prom : out.tds.prom,
      n: Math.max(out.tds.n || 0, neonR.tds.n || 0)
    });
  }
  return out;
}

/** Serie [{t,v}] para gráfica SVG */
function muestrasSerie(feeds, clave) {
  return (feeds || [])
    .filter(f => f.v && f.v[clave] != null)
    .map(f => ({ t: f.t, v: f.v[clave] }));
}

/** Dibuja gráfica de línea en un contenedor (reemplaza iframe vacío de ThingSpeak) */
function neonMontarGrafico(cont, medida, feeds) {
  if (!cont || !medida) return false;
  const serie = muestrasSerie(feeds, medida.clave);
  if (serie.length < 1) return false;
  cont.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%;height:100%;min-height:180px;padding:8px 8px 4px;";
  cont.appendChild(wrap);
  if (typeof lineaMulti === "function") {
    lineaMulti(wrap, {
      series: [{
        nombre: medida.nombre,
        color: medida.color || "#7c3aed",
        eje: "izq",
        datos: serie
      }],
      izq: {}
    });
  } else {
    // fallback texto
    const ult = serie[serie.length - 1].v;
    wrap.innerHTML = "<div style=\"padding:24px;text-align:center;color:#334155\">" +
      "<div style=\"font-size:28px;font-weight:700\">" + Number(ult).toFixed(medida.dec || 0) +
      (medida.unidad ? " " + medida.unidad : "") + "</div>" +
      "<div style=\"opacity:.7;margin-top:6px\">" + serie.length + " puntos (API Neon)</div></div>";
  }
  return true;
}
