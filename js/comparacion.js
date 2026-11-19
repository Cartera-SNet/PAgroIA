/* ==========================================================
   AgroIA - Comparación de fuentes (página oculta: comparacion.html, no está en el menú)
   Pide a la base de datos y a ThingSpeak el MISMO rango e intervalo y muestra, lado a lado, la cantidad de registros,
   el promedio de cada parámetro y la primera/última lectura. Dice si coinciden.
   Mismas reglas que el Historial: días y horas de Colombia, mismos decimales, promedios por cubetas del intervalo.
   ========================================================== */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const BD_SENSORES = { 1: "humSuelo", 2: "temp", 3: "humAire", 5: "tds" };   // Sensor_Id de la base -> medida
  const BD_LIMITE = 20000, OFFSET_CO = 5 * 3600000;                            // lecturas máximas por sensor; Colombia = UTC-5
  const TOL = { temp: 0.3, humAire: 1, humSuelo: 1, tds: 5 };                  // diferencia de promedios que se considera «coincide»
  const ETQ = { temp: "Temperatura", humAire: "Humedad aire", humSuelo: "Humedad suelo", tds: "TDS" };
  const isoUTC = ms => new Date(ms).toISOString().slice(0, 19);
  const nombreMin = m => m.clave === "tds" ? m.nombre : m.nombre.toLowerCase();
  const fecha = d => d ? d.toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

  const hoy = new Date(), hace7 = new Date(hoy.getTime() - 6 * 86400000);
  $("desde").value = fmtISO(hace7); $("hasta").value = fmtISO(hoy); $("desde").max = $("hasta").max = fmtISO(hoy);

  /* GET con reintentos: si el servidor estaba dormido (502/503/504 o sin respuesta) espera y vuelve a intentar */
  async function pedir(url) {
    let ultimo = null;
    for (let i = 0; i < 4; i++) {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
      try {
        const r = await fetch(url, { cache: "no-store", signal: ac.signal }); clearTimeout(t);
        if (r.ok) return r.json();
        if (![502, 503, 504].includes(r.status)) throw new Error("HTTP " + r.status);
        ultimo = new Error("HTTP " + r.status);
      } catch (e) { clearTimeout(t); if (/^HTTP/.test(e.message) && !/HTTP 50[234]/.test(e.message)) throw e; ultimo = e; }
      if (i < 3) await new Promise(ok => setTimeout(ok, 4000));
    }
    throw ultimo || new Error("sin respuesta");
  }
  async function bd(d, h, it) {
    const ini = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + OFFSET_CO;
    const fin = Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1, +h.slice(8, 10)) + OFFSET_CO + 86400000 - 1000;
    const resp = await Promise.all(Object.keys(BD_SENSORES).map(async id => {
      const f = await pedir(API_BASE_URL + "/muestras/list?sensor_id=" + id + "&desde=" + isoUTC(ini) + "&hasta=" + isoUTC(fin) + "&limite=" + BD_LIMITE);
      return { clave: BD_SENSORES[id], filas: Array.isArray(f) ? f : [] };
    }));
    const paso = (it > 0 ? it : 1) * 60000, cub = new Map();
    resp.forEach(x => x.filas.forEach(m => {
      if (m.Muestra_Valor === null || m.Muestra_Valor === undefined) return;
      const v = Number(m.Muestra_Valor); if (!isFinite(v)) return;
      const k = Math.floor((tdsFechaUTC(m.Muestra_FechaHora).getTime() - OFFSET_CO) / paso);
      let c = cub.get(k); if (!c) { c = { s: {}, n: {} }; cub.set(k, c); }
      c.s[x.clave] = (c.s[x.clave] || 0) + v; c.n[x.clave] = (c.n[x.clave] || 0) + 1;
    }));
    return Array.from(cub.entries()).sort((a, b) => a[0] - b[0]).map(e => {
      const c = e[1], v = {};
      TS_MEDIDAS.forEach(m => { v[m.clave] = c.n[m.clave] ? c.s[m.clave] / c.n[m.clave] : null; });
      return { t: new Date(e[0] * paso + OFFSET_CO), v: v };
    });
  }
  async function ts(d, h, it) {
    const r = await tsFeeds({ results: 8000, start: d + " 00:00:00", end: h + " 23:59:59", average: it > 0 ? it : 0 });
    return r ? r.feeds : [];
  }

  async function comparar() {
    const d = $("desde").value, h = $("hasta").value, it = parseInt($("int").value, 10);
    if (!d || !h || d > h) { alert("Revisa las fechas: «Desde» no puede ser posterior a «Hasta»."); return; }
    $("ir").disabled = true; $("ir").textContent = "Comparando…";
    $("res").hidden = false; $("veredicto").className = "veredicto info"; $("veredicto").textContent = "Consultando las dos fuentes… (si el servidor estaba dormido puede tardar hasta 30 segundos)";
    $("filas").innerHTML = ""; $("nota").textContent = "";
    const [a, b] = await Promise.all([bd(d, h, it).catch(e => { console.error(e); return null; }), ts(d, h, it).catch(e => { console.error(e); return null; })]);
    $("ir").disabled = false; $("ir").textContent = "Comparar ahora";
    if (!a || !b) {
      $("veredicto").className = "veredicto warn";
      $("veredicto").textContent = "No se pudo consultar " + (!a && !b ? "ninguna de las dos fuentes" : !a ? "la base de datos" : "ThingSpeak") + ". Intenta de nuevo en unos segundos.";
      return;
    }
    const R = { bd: tsResumen(a), ts: tsResumen(b) }, nb = a.length, nt = b.length;
    let msg, cls;
    if (!nb && !nt) { msg = "Ninguna de las dos fuentes tiene datos en este rango."; cls = "warn"; }
    else if (!nb || !nt) { msg = (nb ? "Solo la base de datos" : "Solo ThingSpeak") + " tiene datos en este rango. La otra fuente no recibió lecturas de estas fechas."; cls = "warn"; }
    else {
      const difs = TS_MEDIDAS.filter(m => R.bd[m.clave].prom !== null && R.ts[m.clave].prom !== null && Math.abs(R.bd[m.clave].prom - R.ts[m.clave].prom) > TOL[m.clave]);
      const difN = Math.abs(nb - nt) / Math.max(nb, nt) > 0.05;
      if (!difs.length && !difN) { msg = "✔ Las dos fuentes coinciden en este rango."; cls = "ok"; }
      else { msg = "⚠ Las fuentes difieren" + (difN ? " en la cantidad de registros" : "") + (difs.length ? (difN ? " y" : " en") + " los promedios de " + difs.map(nombreMin).join(", ") : "") +
        ". Pasa cuando el ESP32 no envía lo mismo a las dos."; cls = "warn"; }
    }
    $("veredicto").className = "veredicto " + cls; $("veredicto").textContent = msg;
    const fila = (t, x, y, z) => "<tr><th scope=\"row\">" + t + "</th><td>" + x + "</td><td>" + y + "</td><td>" + z + "</td></tr>";
    $("filas").innerHTML = fila("Registros", nb, nt, Math.abs(nb - nt)) +
      TS_MEDIDAS.map(m => { const x = R.bd[m.clave].prom, y = R.ts[m.clave].prom;
        return fila("Promedio " + ETQ[m.clave] + (m.unidad ? " (" + m.unidad + ")" : ""), fmtNum(x, m.dec), fmtNum(y, m.dec), x === null || y === null ? "—" : fmtNum(Math.abs(x - y), m.dec)); }).join("") +
      fila("Primera lectura", fecha(a[0] && a[0].t), fecha(b[0] && b[0].t), "") +
      fila("Última lectura", fecha(a[a.length - 1] && a[a.length - 1].t), fecha(b[b.length - 1] && b[b.length - 1].t), "");
    $("nota").textContent = "Mismo rango, mismo intervalo, hora de Colombia y mismos decimales en las dos fuentes. Se considera que coinciden si los registros difieren menos de 5 % y los promedios menos de 0,3 °C (temperatura), 1 % (humedades) y 5 ppm (TDS).";
  }
  $("ir").onclick = comparar;
})();
