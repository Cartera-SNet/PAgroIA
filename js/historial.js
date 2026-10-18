/* ==========================================================
   AgroIA — Historial de datos (datos reales de ThingSpeak)
   Rango de fechas + parámetro + intervalo (promedio), gráfico con doble eje, tabla paginada y CSV.
   ========================================================== */
montarLayout({ nuevo: true, estadoPropio: true, buscador: "Buscar por fecha, parámetro o tipo de dato..." });

(function () {
  "use strict";
  let PP = 10;                                    // registros por página (se cambia en la tabla)
  let datos = [], param = "todos", pagina = 1, texto = "", cargado = false;

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
  const ICO_COL = { temp: ["i-therm", "c-rojo"], humAire: ["i-drop", "c-azul"], humSuelo: ["i-sprout", "c-verde"], ph: [null, "c-morado"] };
  TS_MEDIDAS.forEach(m => {
    $("th-" + m.clave).innerHTML = (m.icono ? ico(m.icono, ICO_COL[m.clave][1]) : '<b class="c-morado" style="font-size:11px;margin-right:6px">pH</b>') +
      (m.clave === "ph" ? "pH del suelo" : m.nombre.replace(" del ", " ").replace("Temperatura aire", "Temperatura") + " (" + m.unidad + ")");
  });
  $("th-temp").lastChild.textContent = "Temperatura (°C)";
  $("th-humAire").lastChild.textContent = "Humedad aire (%)";
  $("th-humSuelo").lastChild.textContent = "Humedad suelo (%)";

  // ---- tarjetas de promedio (con color suave)
  const TINTE = { temp: "tint-rojo", humAire: "tint-azul", humSuelo: "tint-verde", ph: "tint-morado" };
  $("kpis").innerHTML = TS_MEDIDAS.map(m =>
    '<article class="kpi ' + TINTE[m.clave] + '" id="hk-' + m.clave + '">' + iconoMedida(m) +
    '<div class="kpi-info"><span class="kpi-lab">' + m.nombre + '</span><b class="kpi-val" data-v>—</b><span class="kpi-sub">Promedio en el período</span></div>' +
    '<svg class="kpi-spark" data-s></svg></article>').join("");

  // ---- filtros rápidos
  const RAP = [["todos", "Todos", "i-cal", "#16a34a"]].concat(TS_MEDIDAS.map(m => [m.clave, m.nombre, m.icono, m.color]));
  function pintarRapidos() {
    $("fr-lista").innerHTML = RAP.map(([k, t, i, c]) =>
      '<button class="fr-item' + (param === k ? " on" : "") + '" data-k="' + k + '"><span class="fr-ico" style="background:' + c + '">' +
      (i ? ico(i) : '<span class="ph-txt">pH</span>') + '</span>' + t + ico("i-chev-r") + '</button>').join("");
    $("fr-lista").querySelectorAll(".fr-item").forEach(b => b.onclick = () => fijarParam(b.dataset.k));
  }
  function fijarParam(k) {
    param = k; pagina = 1; $("f-param").value = k; pintarRapidos(); if (cargado) { pintarGrafico(); pintarTabla(); }
  }

  // ---- fechas por defecto: últimos 7 días
  const hoy = new Date(), hace7 = new Date(hoy.getTime() - 6 * 86400000);
  $("f-desde").value = fmtISO(hace7); $("f-hasta").value = fmtISO(hoy);
  $("f-desde").max = $("f-hasta").max = fmtISO(hoy);

  // ---- consulta a ThingSpeak
  async function aplicar() {
    const d = $("f-desde").value, h = $("f-hasta").value, it = parseInt($("f-int").value, 10);
    if (!d || !h) return avisarToast("Elige las dos fechas.");
    if (d > h) return avisarToast("La fecha «Desde» no puede ser posterior a «Hasta».");
    if (!tsCfg().channelId) { vacio("Falta configurar el canal de ThingSpeak (Configuración)."); return; }
    $("aplicar").disabled = true;
    try {
      const res = await tsFeeds({ results: 8000, start: d + " 00:00:00", end: h + " 23:59:59", average: it > 0 ? it : 0 });
      datos = res.feeds; cargado = true; pagina = 1;
      pintarKPIs(); pintarGrafico(); subtitulo(); pintarTabla();
      $("h-punto").className = "punto";
    } catch (e) { console.error(e); datos = []; cargado = true; vacio("No fue posible consultar ThingSpeak. Intenta de nuevo."); $("h-punto").className = "punto bad"; }
    $("aplicar").disabled = false;
  }
  function subtitulo() {
    const d = $("f-desde").value.split("-").reverse().join("/"), h = $("f-hasta").value.split("-").reverse().join("/");
    const it = $("f-int").selectedOptions[0].text.toLowerCase();
    $("tabla-sub").textContent = datos.length + " registros · del " + d + " al " + h + " · " + (it === "datos originales" ? "datos originales" : "promedio " + it.replace("cada ", "cada "));
  }
  function vacio(msg) {
    datos = []; pintarKPIs(); $("tabla-sub").textContent = "Sin datos para mostrar";
    $("evo").innerHTML = '<div class="graf-aviso">' + msg + '</div>';
    $("cuerpo").innerHTML = '<tr><td colspan="6" style="text-align:center;color:#5f7081;padding:22px">' + msg + '</td></tr>';
    $("pag").innerHTML = ""; $("pag-info").textContent = "";
  }

  function pintarKPIs() {
    const R = tsResumen(datos);
    TS_MEDIDAS.forEach(m => {
      const t = $("hk-" + m.clave);
      t.querySelector("[data-v]").textContent = fmtVal(m, R[m.clave].prom);
      const sp = t.querySelector("[data-s]"); sparkline(sp, R[m.clave].serie.slice(-40), m.color);
    });
  }

  function pintarGrafico() {
    const sel = param === "todos" ? TS_MEDIDAS : [tsMedida(param)];
    $("leyenda").innerHTML = sel.map(m => '<span><i style="background:' + m.color + '"></i>' + m.nombre.replace("Temperatura del aire", "Temperatura") .replace("Humedad del aire", "Humedad aire").replace("Humedad del suelo", "Humedad suelo").replace("pH del suelo", "pH") + (m.unidad ? " (" + m.unidad + ")" : "") + '</span>').join("");
    if (!datos.length) { $("evo").innerHTML = '<div class="graf-aviso">No hay datos en el período elegido.</div>'; return; }
    const series = sel.map(m => ({ nombre: m.nombre, color: m.color, eje: m.clave === "ph" ? "der" : "izq", datos: datos.map(f => ({ t: f.t, v: f.v[m.clave] })) }));
    // si se muestra solo un parámetro el eje izquierdo se ajusta a sus valores
    const op = { series: series };
    if (param === "ph") { op.izq = { min: 0, max: 14 }; series[0].eje = "izq"; }
    lineaMulti($("evo"), op);
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
    return '<td' + (fuera ? ' class="fuera" title="Fuera del rango normal (' + est + ')"' : '') + '>' + (i ? ico(i, c) : '<b class="' + c + '" style="font-size:10px;margin-right:6px">pH</b>') + fmtNum(v, m.dec) + '</td>';
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

  // ---- CSV (lo que se ve filtrado, todas las páginas)
  function descargarCSV() {
    const f = filas().slice().reverse();
    if (!f.length) return avisarToast("No hay datos para descargar.");
    const lin = ["fecha_hora,temperatura_c,humedad_aire_pct,humedad_suelo_pct,ph"].concat(f.map(x =>
      [fmtISO(x.t) + " " + dos(x.t.getHours()) + ":" + dos(x.t.getMinutes()) + ":" + dos(x.t.getSeconds())].concat(TS_MEDIDAS.map(m => x.v[m.clave] === null ? "" : x.v[m.clave])).join(",")));
    const blob = new Blob(["\ufeff" + lin.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "agroia_historial_" + $("f-desde").value + "_a_" + $("f-hasta").value + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    avisarToast("Se descargaron " + f.length + " registros.");
  }

  // ---- buscador de la barra superior
  window.alBuscar = q => {
    const s = sinAcentos(q);
    const porNombre = s.length >= 3 && [["temp", /^temp/], ["humAire", /^humedad (del )?aire|^aire/], ["humSuelo", /^humedad (del )?suelo|^suelo/], ["ph", /^ph/]].find(([, re]) => re.test(s));
    if (porNombre) { texto = ""; fijarParam(porNombre[0]); return; }
    texto = q; pagina = 1; if (cargado) pintarTabla();
  };

  $("aplicar").onclick = aplicar; $("csv").onclick = descargarCSV;
  $("f-filas").onchange = () => { PP = parseInt($("f-filas").value, 10); pagina = 1; pintarTabla(); };
  $("f-param").onchange = () => fijarParam($("f-param").value);
  $("fr-reset").onclick = () => {
    param = "todos"; texto = ""; $("buscador").value = ""; $("f-param").value = "todos"; $("f-int").value = "60";
    $("f-desde").value = fmtISO(hace7); $("f-hasta").value = fmtISO(hoy); pintarRapidos(); aplicar();
  };
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (cargado && datos.length) pintarGrafico(); }, 150); });

  // ---- estado del sistema (independiente del rango consultado)
  async function estado() { try { tsPintarEstado(await tsFeeds({ results: 1 })); } catch (e) { setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); } }

  pintarRapidos(); estado(); setInterval(estado, tsCfg().refrescoSegundos * 1000); aplicar();
})();
