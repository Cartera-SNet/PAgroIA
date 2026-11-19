/* ==========================================================
   AgroIA - Historial de datos (datos reales)
   Fuente a elegir: la base de datos (por defecto; todo lo que el ESP32 envió al servidor) o ThingSpeak (la misma del Inicio).
   Al cargar una fuente se consulta también la otra y se muestran sus conteos y promedios lado a lado («Comparación de fuentes»).
   Rango de fechas + parámetro + intervalo (promedio), gráficos, tabla paginada, resumen (promedio, mínimo, máximo) y CSV.
   ========================================================== */
montarLayout({ nuevo: true, estadoPropio: true, buscador: "Buscar por fecha, parámetro o tipo de dato..." });

(function () {
  "use strict";
  let PP = 10;                                    // registros por página (se cambia en la tabla)
  let datos = [], param = "todos", pagina = 1, texto = "", cargado = false, rango = null;
  let fuente = "bd", truncado = false, ronda = 0;    // fuente: "bd" = base de datos (por defecto), "ts" = ThingSpeak; ronda = consulta vigente
  const OTRA = { ts: "bd", bd: "ts" };
  const FUENTE_TXT = { ts: "ThingSpeak", bd: "la base de datos" }, FUENTE_NOM = { ts: "ThingSpeak", bd: "Base de datos" };

  // ---- íconos de las piezas estáticas
  $("h-ico").innerHTML = ico("i-cal"); $("h-bb").innerHTML = ico("i-sprout");
  $("t-rango").innerHTML = ico("i-cal") + "Rango de fechas";
  $("t-param").innerHTML = ico("i-flask") + "Parámetro";
  $("t-int").innerHTML = ico("i-clock") + "Intervalo de tiempo";
  $("aplicar").innerHTML = ico("i-search") + "Aplicar filtros";
  $("csv").innerHTML = ico("i-download") + "Descargar CSV";
  $("fr-reset").innerHTML = ico("i-refresh");
  $("sabias").querySelector("h3").insertAdjacentHTML("afterbegin", ico("i-bulb"));
  $("sabias").insertAdjacentHTML("beforeend", ico("i-sprout", "deco"));
  const ICO_COL = { temp: ["i-therm", "c-rojo"], humAire: ["i-drop", "c-azul"], humSuelo: ["i-sprout", "c-verde"], tds: [null, "c-morado"] };
  TS_MEDIDAS.forEach(m => {
    $("th-" + m.clave).innerHTML = (m.icono ? ico(m.icono, ICO_COL[m.clave][1]) : '') +
      (m.nombre.replace(" del ", " ").replace("Temperatura aire", "Temperatura") + " (" + m.unidad + ")");
  });
  $("th-temp").lastChild.textContent = "Temperatura (°C)";
  $("th-humAire").lastChild.textContent = "Humedad aire (%)";
  $("th-humSuelo").lastChild.textContent = "Humedad suelo (%)";

  // ---- tarjetas de promedio (con color suave)
  const TINTE = { temp: "tint-rojo", humAire: "tint-azul", humSuelo: "tint-verde", tds: "tint-morado" };
  $("kpis").innerHTML = TS_MEDIDAS.map(m =>
    '<article class="kpi ' + TINTE[m.clave] + '" id="hk-' + m.clave + '">' + iconoMedida(m) +
    '<div class="kpi-info"><span class="kpi-lab">' + m.nombre + '</span><b class="kpi-val" data-v>—</b><span class="kpi-sub">Promedio en el período</span><span class="kpi-mm" data-mm>Mín — · Máx —</span></div>' +
    '</article>').join("");

  // ---- filtros rápidos
  const RAP = [["todos", "Todos", "i-cal", "#16a34a"]].concat(TS_MEDIDAS.map(m => [m.clave, m.nombre, m.icono, m.color, m.etiqueta]));
  function pintarRapidos() {
    $("fr-lista").innerHTML = RAP.map(([k, t, i, c, e]) =>
      '<button class="fr-item' + (param === k ? " on" : "") + '" data-k="' + k + '"><span class="fr-ico" style="background:' + c + '">' +
      (i ? ico(i) : '<span class="ph-txt tres">' + e + '</span>') + '</span>' + t + ico("i-chev-r") + '</button>').join("");
    $("fr-lista").querySelectorAll(".fr-item").forEach(b => b.onclick = () => fijarParam(b.dataset.k));
  }
  function fijarParam(k) {
    param = k; pagina = 1; $("f-param").value = k; pintarRapidos(); if (cargado) { pintarGrafico(); pintarTabla(); }
  }

  // ---- fechas por defecto: últimos 7 días
  const hoy = new Date(), hace7 = new Date(hoy.getTime() - 6 * 86400000);
  $("f-desde").value = fmtISO(hace7); $("f-hasta").value = fmtISO(hoy);
  $("f-desde").max = $("f-hasta").max = fmtISO(hoy);

  // ---- consulta (ThingSpeak o base de datos)
  const BD_SENSORES = { 1: "humSuelo", 2: "temp", 3: "humAire", 5: "tds" };   // Sensor_Id de la base -> medida de la página
  const BD_LIMITE = 20000, OFFSET_CO = 5 * 3600000;                           // lecturas máximas por sensor; Colombia = UTC-5 (sin horario de verano)
  const isoUTC = ms => new Date(ms).toISOString().slice(0, 19);               // "2026-11-18T05:00:00"

  /* Lee la base de datos (GET /muestras/list con filtros) y la deja con el mismo formato que ThingSpeak: [{ t, v:{temp,humAire,humSuelo,tds} }].
     Los días elegidos son de Colombia. Con intervalo se promedia por cubetas de ese tamaño; con «datos originales» se agrupa por minuto,
     porque el ESP32 manda cada medida en una petición distinta. */
  /* GET con reintentos: si el servidor estaba dormido (502/503/504 o sin respuesta) espera y vuelve a intentar (hasta 4 veces, cada 4 s). */
  async function bdPedir(url) {
    let ultimo = null;
    for (let i = 0; i < 4; i++) {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
      try {
        const r = await fetch(url, { cache: "no-store", signal: ac.signal }); clearTimeout(t);
        if (r.ok) return r.json();
        if (![502, 503, 504].includes(r.status)) throw new Error("HTTP " + r.status);   // un error real no se reintenta
        ultimo = new Error("HTTP " + r.status);
      } catch (e) { clearTimeout(t); if (/^HTTP/.test(e.message) && !/HTTP 50[234]/.test(e.message)) throw e; ultimo = e; }
      if (i < 3) await new Promise(ok => setTimeout(ok, 4000));
    }
    throw ultimo || new Error("sin respuesta");
  }
  async function bdFeeds(d, h, it) {
    const ini = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + OFFSET_CO;
    const fin = Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1, +h.slice(8, 10)) + OFFSET_CO + 86400000 - 1000;
    const resp = await Promise.all(Object.keys(BD_SENSORES).map(async id => {
      const url = API_BASE_URL + "/muestras/list?sensor_id=" + id + "&desde=" + isoUTC(ini) + "&hasta=" + isoUTC(fin) + "&limite=" + BD_LIMITE;
      const filas = await bdPedir(url);
      return { clave: BD_SENSORES[id], filas: Array.isArray(filas) ? filas : [] };
    }));
    const recorte = resp.some(x => x.filas.length >= BD_LIMITE);
    const paso = (it > 0 ? it : 1) * 60000, cub = new Map();
    resp.forEach(x => x.filas.forEach(m => {
      if (m.Muestra_Valor === null || m.Muestra_Valor === undefined) return;
      const v = Number(m.Muestra_Valor); if (!isFinite(v)) return;
      const k = Math.floor((tdsFechaUTC(m.Muestra_FechaHora).getTime() - OFFSET_CO) / paso);
      let c = cub.get(k); if (!c) { c = { s: {}, n: {} }; cub.set(k, c); }
      c.s[x.clave] = (c.s[x.clave] || 0) + v; c.n[x.clave] = (c.n[x.clave] || 0) + 1;
    }));
    const feeds = Array.from(cub.entries()).sort((a, b) => a[0] - b[0]).map(e => {
      const c = e[1], v = {};
      TS_MEDIDAS.forEach(m => { v[m.clave] = c.n[m.clave] ? c.s[m.clave] / c.n[m.clave] : null; });
      return { t: new Date(e[0] * paso + OFFSET_CO), v: v };
    });
    return { feeds: feeds, truncado: recorte };
  }
  async function tsRango(d, h, it) {
    const res = await tsFeeds({ results: 8000, start: d + " 00:00:00", end: h + " 23:59:59", average: it > 0 ? it : 0 });
    return { feeds: res ? res.feeds : [], truncado: false };
  }
  const consultar = (f, d, h, it) => f === "bd" ? bdFeeds(d, h, it) : tsRango(d, h, it);

  async function aplicar() {
    const d = $("f-desde").value, h = $("f-hasta").value, it = parseInt($("f-int").value, 10);
    if (!d || !h) return avisarToast("Elige las dos fechas.");
    if (d > h) return avisarToast("La fecha «Desde» no puede ser posterior a «Hasta».");
    fuente = $("f-fuente").value; truncado = false; pintarFuente();
    const mia = ++ronda;
    if (fuente === "ts" && !tsCfg().channelId) { vacio("Falta configurar el canal de ThingSpeak (Configuración).", true); return; }
    $("aplicar").disabled = true; cargando();
    try {
      const r = await consultar(fuente, d, h, it);
      if (mia !== ronda) return;                                   // llegó tarde: el usuario ya pidió otra cosa
      datos = r.feeds; truncado = r.truncado;
      cargado = true; pagina = 1; rango = { d: d, h: h, it: it, fuente: fuente };
      $("h-punto").className = "punto";
      if (!datos.length) vacio("No hay datos de " + FUENTE_TXT[fuente] + " del " + d.split("-").reverse().join("/") + " al " + h.split("-").reverse().join("/") +
        (fuente === "bd" ? ". Puede que el ESP32 todavía no envíe sus lecturas a la base de datos." : "."), true);
      else { pintarKPIs(); pintarGrafico(); subtitulo(); pintarTabla(); }
      comparar(mia, d, h, it);
    } catch (e) {
      if (mia !== ronda) return;
      console.error(e); datos = []; cargado = true;
      vacio(fuente === "bd" ? "No fue posible consultar la base de datos. Intenta de nuevo en unos segundos (el servidor puede estar despertando)."
        : "No fue posible consultar ThingSpeak. Revisa que el canal sea público o prueba con la fuente «Base de datos».", true);
      $("h-punto").className = "punto bad";
      $("cmp").hidden = true;
    }
    clearTimeout(tAviso);
    if (mia === ronda) $("aplicar").disabled = false;
  }

  /* Aviso mientras se consulta; si tarda, avisa que el servidor puede estar despertando (Railway lo duerme sin uso). */
  let tAviso = 0;
  function cargando() {
    clearTimeout(tAviso);
    const base = "Consultando " + FUENTE_TXT[fuente] + "…";
    const poner = t => {
      $("tabla-sub").textContent = t;
      $("cuerpo").innerHTML = '<tr><td colspan="6" class="tabla-cargando">' + t + '</td></tr>';
      $("evo").className = "evo"; $("evo").innerHTML = '<div class="graf-aviso">' + t + '</div>';
      $("pag").innerHTML = ""; $("pag-info").textContent = "";
    };
    poner(base);
    $("cmp").hidden = true;
    if (fuente === "bd") tAviso = setTimeout(() => poner(base + " El servidor estaba dormido; despertándolo, puede tardar hasta 30 segundos."), 4000);
  }

  /* Comparación de fuentes: consulta la OTRA fuente para el mismo rango e intervalo y muestra registros y promedios lado a lado. */
  const TOL = { temp: 0.3, humAire: 1, humSuelo: 1, tds: 5 }, ETQ_CMP = { temp: "Temperatura", humAire: "Humedad aire", humSuelo: "Humedad suelo", tds: "TDS" };         // diferencia de promedios que se considera «coincide»
  async function comparar(mia, d, h, it) {
    const otra = OTRA[fuente], caja = $("cmp"), cuerpo = $("cmp-cuerpo");
    caja.hidden = false; cuerpo.innerHTML = '<p class="cmp-nota">Comparando con ' + FUENTE_TXT[otra] + '…</p>';
    let r2 = null;
    try { r2 = await consultar(otra, d, h, it); } catch (e) { console.error(e); }
    if (mia !== ronda) return;
    if (!r2) { cuerpo.innerHTML = '<p class="cmp-nota">No se pudo consultar ' + FUENTE_TXT[otra] + ' para compararla.</p>'; return; }
    const por = { [fuente]: datos, [otra]: r2.feeds }, R = { bd: tsResumen(por.bd), ts: tsResumen(por.ts) };
    const nb = por.bd.length, nt = por.ts.length;
    let estado, cls;
    if (!nb && !nt) { estado = "Ninguna de las dos fuentes tiene datos en este rango."; cls = "warn"; }
    else if (!nb || !nt) { estado = (nb ? "Solo la base de datos" : "Solo ThingSpeak") + " tiene datos en este rango. La otra fuente no recibió lecturas de estas fechas."; cls = "warn"; }
    else {
      const difs = TS_MEDIDAS.filter(m => R.bd[m.clave].prom !== null && R.ts[m.clave].prom !== null && Math.abs(R.bd[m.clave].prom - R.ts[m.clave].prom) > TOL[m.clave]);
      const difN = Math.abs(nb - nt) / Math.max(nb, nt) > 0.05;
      if (!difs.length && !difN) { estado = "✔ Las dos fuentes coinciden en este rango."; cls = "ok"; }
      else { estado = "⚠ Las fuentes difieren" + (difN ? " en la cantidad de registros" : "") + (difs.length ? (difN ? " y" : " en") + " los promedios de " + difs.map(m => nombreMin(m)).join(", ") : "") +
        ". Pasa cuando el ESP32 no envía lo mismo a las dos."; cls = "warn"; }
    }
    const fila = (t, a, b, dif) => '<tr><th scope="row">' + t + '</th><td>' + a + '</td><td>' + b + '</td><td>' + dif + '</td></tr>';
    cuerpo.innerHTML = '<p class="cmp-estado ' + cls + '">' + estado + '</p>' +
      '<p class="cmp-nota cmp-sub">Cantidad de registros y promedio de cada parámetro en el período.</p><table class="cmp-tabla"><thead><tr><th></th><th>Base de datos</th><th>ThingSpeak</th><th>Diferencia</th></tr></thead><tbody>' +
      fila("Registros", nb, nt, Math.abs(nb - nt)) +
      TS_MEDIDAS.map(m => { const a = R.bd[m.clave].prom, b = R.ts[m.clave].prom;
        return fila(ETQ_CMP[m.clave] + (m.unidad ? " (" + m.unidad + ")" : ""), fmtNum(a, m.dec), fmtNum(b, m.dec), a === null || b === null ? "—" : fmtNum(Math.abs(a - b), m.dec)); }).join("") +
      '</tbody></table><p class="cmp-nota">Mismo rango, mismo intervalo, misma hora de Colombia y mismos decimales en las dos fuentes.</p>';
  }
  function pintarFuente() {
    $("h-fuente-txt").textContent = FUENTE_TXT[fuente];
    $("h-fuente-nota").textContent = fuente === "bd"
      ? "Base de datos: guarda lo que el ESP32 envía al servidor (hasta " + BD_LIMITE.toLocaleString("es-CO") + " lecturas por sensor). Mismas unidades, decimales y hora de Colombia que ThingSpeak."
      : "ThingSpeak: la misma fuente del Inicio, Alertas, el bot y Sinric. Mismas unidades, decimales y hora de Colombia que la base de datos.";
    $("evo-sub").textContent = fuente === "bd" ? "Gráficos propios con los datos de la base de datos" : "Gráficos oficiales de ThingSpeak para el rango elegido";
  }
  function subtitulo() {
    const d = $("f-desde").value.split("-").reverse().join("/"), h = $("f-hasta").value.split("-").reverse().join("/");
    const it = $("f-int").selectedOptions[0].text.toLowerCase();
    const modo = it === "datos originales" ? (fuente === "bd" ? "datos originales agrupados por minuto" : "datos originales") : "promedio " + it;
    $("tabla-sub").textContent = datos.length + " registros · del " + d + " al " + h + " · " + modo + " · fuente: " + FUENTE_TXT[fuente] +
      (truncado ? " · ⚠ se muestran solo las últimas " + BD_LIMITE.toLocaleString("es-CO") + " lecturas de cada sensor; acorta el rango" : "");
  }
  function vacio(msg, ofrecerOtra) {
    datos = []; pintarKPIs(); $("tabla-sub").textContent = "Sin datos para mostrar";
    const btn = ofrecerOtra ? '<br><button type="button" class="btn-s btn-otra" data-otra>Probar con ' + FUENTE_NOM[OTRA[fuente]] + '</button>' : "";
    $("evo").className = "evo"; $("evo").innerHTML = '<div class="graf-aviso">' + msg + btn + '</div>';
    $("cuerpo").innerHTML = '<tr><td colspan="6" style="text-align:center;color:#5f7081;padding:22px">' + msg + btn + '</td></tr>';
    $("pag").innerHTML = ""; $("pag-info").textContent = "";
    document.querySelectorAll("[data-otra]").forEach(b => b.onclick = () => { $("f-fuente").value = OTRA[fuente]; aplicar(); });
  }

  function pintarKPIs() {
    const R = tsResumen(datos);
    TS_MEDIDAS.forEach(m => {
      const t = $("hk-" + m.clave), sr = R[m.clave].serie;
      t.querySelector("[data-v]").textContent = fmtVal(m, R[m.clave].prom);
      t.querySelector("[data-mm]").textContent = sr.length ? "Mín " + fmtNum(Math.min.apply(null, sr), m.dec) + " · Máx " + fmtNum(Math.max.apply(null, sr), m.dec) : "Sin lecturas en el período";
    });
  }

  /* Gráfica propia (fuente = base de datos). Si hay muchísimos puntos se reduce para que la página no se ponga lenta. */
  function graficoBD(cont, m) {
    let pts = datos.filter(x => x.v[m.clave] !== null).map(x => ({ t: x.t, v: x.v[m.clave] }));
    if (!pts.length) { cont.innerHTML = '<div class="graf-aviso">Sin lecturas de ' + nombreMin(m) + ' en el período.</div>'; return; }
    if (pts.length > 600) { const paso = Math.ceil(pts.length / 600); pts = pts.filter((_, i) => i % paso === 0 || i === pts.length - 1); }
    const vs = pts.map(p => p.v); let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    const pad = Math.max((hi - lo) * 0.15, 1); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    if (hi - lo < 4) { const c = (hi + lo) / 2; lo = Math.floor(c - 2); hi = Math.ceil(c + 2); }
    if (lo < 0 && Math.min.apply(null, vs) >= 0) lo = 0;
    lineaMulti(cont, { series: [{ nombre: m.nombre, color: m.color, eje: "izq", datos: pts }], izq: { min: lo, max: hi }, sinDer: true });
  }

  function pintarGrafico() {
    const cont = $("evo"), sel = param === "todos" ? TS_MEDIDAS : [tsMedida(param)];
    if (!datos.length || !rango) { cont.className = "evo"; cont.innerHTML = '<div class="graf-aviso">No hay datos en el período elegido.</div>'; return; }
    cont.className = "evo evo-grid" + (sel.length === 1 ? " uno" : "");
    if (rango.fuente === "bd") {
      cont.innerHTML = sel.map(m => '<div class="mini-graf"><h4 class="gcard-tag">' + m.nombre + (m.unidad ? " (" + m.unidad + ")" : "") + ' · Base de datos</h4><div class="gcard-cuerpo" data-hb="' + m.clave + '"></div></div>').join("");
      cont.querySelectorAll("[data-hb]").forEach(c => graficoBD(c, tsMedida(c.dataset.hb)));
      return;
    }
    cont.innerHTML = sel.map(m => '<div class="mini-graf"><h4 class="gcard-tag">Campo ' + tsCfg().campos[m.clave] + ' · ThingSpeak</h4><div class="gcard-cuerpo" data-hf="' + m.clave + '"></div></div>').join("");
    cont.querySelectorAll("[data-hf]").forEach(c => tsMontarIframe(c, tsMedida(c.dataset.hf), { start: rango.d + " 00:00:00", end: rango.h + " 23:59:59", average: rango.it, tipo: "line" }));
  }

  // ---- tabla (más recientes primero), con búsqueda y paginación
  function filas() {
    const q = sinAcentos(texto);
    let f = datos.slice().sort((a, b) => b.t - a.t);
    if (param !== "todos") f = f.filter(x => x.v[param] !== null);
    if (q) f = f.filter(x => (fmtFechaHora(x.t) + " " + TS_MEDIDAS.map(m => fmtNum(x.v[m.clave], m.dec)).join(" ")).toLowerCase().includes(q));
    return f;
  }
  function celda(m, v) {
    const [i, c] = ICO_COL[m.clave], est = tsEvaluar(m.clave, v), fuera = est === "bajo" || est === "alto";
    return '<td' + (fuera ? ' class="fuera" title="Fuera del rango normal (' + est + ')"' : '') + '>' + (i ? ico(i, c) : '<b class="' + c + '" style="font-size:10px;margin-right:6px">' + m.etiqueta + '</b>') + fmtNum(v, m.dec) + '</td>';
  }
  function pintarTabla() {
    const f = filas(), total = f.length, pags = Math.max(1, Math.ceil(total / PP));
    if (pagina > pags) pagina = pags;
    const ini = (pagina - 1) * PP, vis = f.slice(ini, ini + PP);
    $("cuerpo").innerHTML = vis.length ? vis.map((x, i) =>
      '<tr><td>' + fmtFechaHora(x.t) + '</td>' + TS_MEDIDAS.map(m => celda(m, x.v[m.clave])).join("") +
      '<td><button class="btn-ojo" data-i="' + (ini + i) + '" aria-label="Ver detalle">' + ico("i-eye") + '</button></td></tr>').join("")
      : '<tr><td colspan="6" style="text-align:center;color:#5f7081;padding:22px">No hay registros para mostrar.</td></tr>';
    $("cuerpo").querySelectorAll(".btn-ojo").forEach(b => b.onclick = () => detalle(f[parseInt(b.dataset.i, 10)]));
    $("pag-info").textContent = total ? "Mostrando " + (ini + 1) + " - " + (ini + vis.length) + " de " + total + " registros" : "Mostrando 0 de 0 registros";
    pintarPaginas(pags);
  }
  function pintarPaginas(pags) {
    const nums = [];
    if (pags <= 7) for (let i = 1; i <= pags; i++) nums.push(i);
    else { nums.push(1); const a = Math.max(2, pagina - 1), b = Math.min(pags - 1, pagina + 1);
      if (a > 2) nums.push("…"); for (let i = a; i <= b; i++) nums.push(i); if (b < pags - 1) nums.push("…"); nums.push(pags); }
    $("pag").innerHTML = '<button data-p="' + (pagina - 1) + '"' + (pagina <= 1 ? " disabled" : "") + ' aria-label="Anterior">' + ico("i-chev-l") + '</button>' +
      nums.map(n => n === "…" ? '<span style="padding:0 4px;color:#93a2b0">…</span>' : '<button data-p="' + n + '"' + (n === pagina ? ' class="on"' : "") + '>' + n + '</button>').join("") +
      '<button data-p="' + (pagina + 1) + '"' + (pagina >= pags ? " disabled" : "") + ' aria-label="Siguiente">' + ico("i-chev-r") + '</button>';
    $("pag").querySelectorAll("button[data-p]").forEach(b => b.onclick = () => { pagina = parseInt(b.dataset.p, 10); pintarTabla(); });
  }
  function detalle(x) {
    const est = { normal: ["Normal", "ok-txt"], bajo: ["Bajo", "warn-txt"], alto: ["Alto", "mal-txt"], sin: ["Sin dato", ""] };
    abrirModal("Registro del " + fmtFechaHora(x.t),
      '<dl class="det-lista">' + TS_MEDIDAS.map(m => { const e = est[tsEvaluar(m.clave, x.v[m.clave])];
        return '<dt>' + m.nombre + '</dt><dd>' + fmtVal(m, x.v[m.clave]) + ' <span class="' + e[1] + '" style="font-size:12px;margin-left:6px">' + e[0] + '</span></dd>'; }).join("") + '</dl>');
  }

  // ---- CSV (lo que se ve filtrado, todas las páginas). Para Excel en español: columnas separadas con «;» y decimales con coma.
  function descargarCSV() {
    const f = filas().slice().reverse();
    if (!f.length) return avisarToast("No hay datos para descargar.");
    const num = (m, v) => v === null || v === undefined || isNaN(v) ? "" : Number(v).toFixed(m.dec).replace(".", ",");
    const lin = ["fecha_hora;temperatura_c;humedad_aire_pct;humedad_suelo_pct;tds_ppm"].concat(f.map(x =>
      [fmtISO(x.t) + " " + dos(x.t.getHours()) + ":" + dos(x.t.getMinutes()) + ":" + dos(x.t.getSeconds())].concat(TS_MEDIDAS.map(m => num(m, x.v[m.clave]))).join(";")));
    const blob = new Blob(["\ufeff" + lin.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "agroia_historial_" + (fuente === "bd" ? "bd_" : "thingspeak_") + $("f-desde").value + "_a_" + $("f-hasta").value + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    avisarToast("Se descargaron " + f.length + " registros. Se abre directo en Excel en español (columnas separadas con punto y coma).");
  }

  // ---- buscador de la barra superior
  window.alBuscar = q => {
    const s = sinAcentos(q);
    const porNombre = s.length >= 3 && [["temp", /^temp/], ["humAire", /^humedad (del )?aire|^aire/], ["humSuelo", /^humedad (del )?suelo|^suelo/], ["tds", /^(tds|solidos|sales)/]].find(([, re]) => re.test(s));
    if (porNombre) { texto = ""; fijarParam(porNombre[0]); return; }
    texto = q; pagina = 1; if (cargado) pintarTabla();
  };

  // rangos rápidos: cada uno elige también un intervalo que tenga sentido para ese tiempo
  const RAPIDOS = { 0: "10", 1: "30", 6: "60", 29: "240" };
  function marcarRapido(dias) { $("rapido-rango").querySelectorAll("button[data-dias]").forEach(b => b.classList.toggle("on", dias !== null && +b.dataset.dias === dias)); }
  $("rapido-rango").querySelectorAll("button[data-dias]").forEach(b => b.onclick = () => {
    const dias = +b.dataset.dias, ahora = new Date();
    $("f-hasta").value = fmtISO(ahora); $("f-desde").value = fmtISO(new Date(ahora.getTime() - dias * 86400000));
    $("f-int").value = RAPIDOS[dias]; marcarRapido(dias); aplicar();
  });
  $("f-desde").addEventListener("change", () => marcarRapido(null)); $("f-hasta").addEventListener("change", () => marcarRapido(null));
  $("f-fuente").onchange = () => aplicar();
  $("aplicar").onclick = aplicar; $("csv").onclick = descargarCSV;
  $("f-filas").onchange = () => { PP = parseInt($("f-filas").value, 10); pagina = 1; pintarTabla(); };
  $("f-param").onchange = () => fijarParam($("f-param").value);
  $("fr-reset").onclick = () => {
    param = "todos"; texto = ""; $("buscador").value = ""; $("f-param").value = "todos"; $("f-int").value = "60";
    $("f-desde").value = fmtISO(hace7); $("f-hasta").value = fmtISO(hoy); marcarRapido(6); pintarRapidos(); aplicar();
  };
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (cargado && datos.length) pintarGrafico(); }, 150); });

  // ---- estado del sistema (independiente del rango consultado)
  async function estado() { try { tsPintarEstado(await tsFeeds({ results: 1 })); } catch (e) { setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); } }

  pintarRapidos(); marcarRapido(6); pintarFuente(); estado(); setInterval(estado, tsCfg().refrescoSegundos * 1000); aplicar();
})();
