/* ==========================================================
   AgroIA - Inicio
   - Tarjetas, anillo de humedad del suelo y estado del sistema: datos reales del canal de ThingSpeak.
   - Temperatura, humedad del aire y pH: gráficos oficiales de ThingSpeak (iframes).
   Configuración: js/config.js (THINGSPEAK) o la pantalla Configuración.
   ========================================================== */
montarLayout({ nuevo: true, estadoPropio: true });

(function () {
  "use strict";
  const q = s => document.querySelector(s);

  // ---- piezas estáticas con íconos
  $("banner-logo").innerHTML = ico("logo-hoja");
  $("ia-ico").innerHTML = ico("i-brain");
  $("ver-analisis").insertAdjacentHTML("beforeend", ico("i-arrow"));
  $("chat-cab").insertAdjacentHTML("afterbegin", ico("i-chat"));
  $("chat-enviar").innerHTML = ico("i-send");
  document.querySelectorAll("[data-ext]").forEach(a => { a.innerHTML = ico("i-ext"); });
  $("kpis").innerHTML = TS_MEDIDAS.map(m => kpiHTML(m, { delta: true })).join("");

  // ---- gráficos de ThingSpeak (iframes)
  function montarGraficos() {
    document.querySelectorAll("[data-iframe]").forEach(c => tsMontarIframe(c, tsMedida(c.dataset.iframe)));
    document.querySelectorAll("[data-ext]").forEach(a => {
      const u = tsChartUrl(tsMedida(a.dataset.ext)); if (u) a.href = u; else a.removeAttribute("href");
    });
  }

  // ---- datos
  function pintarNiveles(R) {
    TS_MEDIDAS.forEach(m => {
      const r = R[m.clave], n = $("nivel-" + m.clave); if (!n) return;
      const est = r.ult === null ? "sin" : tsEvaluar(m.clave, r.ult);
      n.className = "nivel" + (est === "normal" ? "" : " " + est);
      n.innerHTML = ico("i-leaf") + "<span>" + (est === "sin" ? "Sin lecturas de " + nombreMin(m) + " en el canal" : nivelTexto(est) + (m.clave === "tds" && tdsEnBD ? " (base de datos · " + tdsHoraBD + ")" : "")) + "</span>";
    });
  }
  // ---- TDS: si ThingSpeak no tiene el campo 4, se toma de la base de datos (Sensor_Id 5)
  let tdsEnBD = false, tdsHoraBD = "";
  async function respaldoTDS(R, res) {
    const cont = q('[data-iframe="tds"]'), tag = q("#g-tds .gcard-tag"), ext = q("#g-tds .gcard-ext");
    if (R.tds.n > 0) {   // ThingSpeak ya trae el TDS: se vuelve a la gráfica oficial
      if (tdsEnBD) { tdsEnBD = false; tag.textContent = "Campo 4 · ThingSpeak"; ext.style.display = ""; tsMontarIframe(cont, tsMedida("tds")); }
      return;
    }
    const datos = await tdsDesdeBD();
    if (!datos || !datos.length) return;   // sin datos en la base: se queda como estaba
    R.tds = tdsResumenBD(datos);
    tdsEnBD = true;
    tag.textContent = "Campo 4 · Base de datos"; ext.style.display = "none";
    const max = Math.max.apply(null, datos.map(d => d.v)), tope = Math.max(100, Math.ceil(max * 1.2 / 100) * 100);
    lineaMulti(cont, { series: [{ nombre: "TDS (ppm)", color: tsMedida("tds").color, eje: "izq", datos: datos }], izq: { min: 0, max: tope }, sinDer: true });
    tdsHoraBD = fmtFechaHora(datos[datos.length - 1].t);
  }
  async function actualizar() {
    let res = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
    const R = tsResumen(res ? res.feeds : []);
    await respaldoTDS(R, res);
    TS_MEDIDAS.forEach(m => pintarKPI(m, R[m.clave]));
    pintarNiveles(R);
    if (res) tsPintarEstado(res); else if (!tsCfg().channelId) tsPintarEstado(null);
  }

  // ---- chat
  const enviar = chatConectar({ log: $("chat-log"), campo: $("chat-input"), boton: $("chat-enviar") });

  montarGraficos();
  actualizar();
  setInterval(actualizar, tsCfg().refrescoSegundos * 1000);
})();
