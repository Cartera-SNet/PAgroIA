/* AgroIA - Monitoreo en tiempo real */
montarLayout({ nuevo: true, estadoPropio: true });
(function () {
  "use strict";
  $("kpis").innerHTML = TS_MEDIDAS.map(m => kpiHTML(m)).join("");
  $("graficas").innerHTML = TS_MEDIDAS.map(m =>
    '<div class="mini-graf"><h4>' + m.nombre + (m.unidad ? " (" + m.unidad + ")" : "") + '</h4><div class="gcard-cuerpo" data-iframe="' + m.clave + '"></div></div>').join("");
  document.querySelectorAll("[data-iframe]").forEach(c => tsMontarIframe(c, tsMedida(c.dataset.iframe)));
  const ver = $("ver-ts");
  if (ver) {
    ver.insertAdjacentHTML("beforeend", ico("i-ext"));
    const u = tsPublicUrl();
    if (u) ver.href = u; else ver.style.display = "none";
  }

  async function actualizar() {
    let res = null, neon = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); }
    try { neon = await cargarMuestras(); } catch (eN) {}

    let R = tsResumen(res ? res.feeds : []);
    if (neon && typeof fusionarResumen === "function") R = fusionarResumen(R, neon.resumen);
    if (neon && neon.resumen && neon.resumen.tds && neon.resumen.tds.ult != null) R.tds = neon.resumen.tds;

    TS_MEDIDAS.forEach(m => pintarKPI(m, R[m.clave] || { ult: null, primero: null, n: 0 }));

    // Gráfica TDS desde Neon (ThingSpeak field4 vacío)
    if (neon && neon.feeds && neon.feeds.length) {
      const cont = document.querySelector('[data-iframe="tds"]');
      const mTds = tsMedida("tds");
      if (cont && mTds && typeof neonMontarGrafico === "function") {
        neonMontarGrafico(cont, mTds, neon.feeds);
      }
    }

    if (res && res.feeds && res.feeds.length) {
      tsPintarEstado(res);
      const ult = res.feeds[res.feeds.length - 1].t;
      if ($("nota-ts")) $("nota-ts").textContent = "Tarjetas: API + ThingSpeak. TDS desde Neon (Parametro_Id 5). Gráficos TS o Neon." + (ult ? " Última TS: " + fmtFechaHora(ult) + "." : "");
    } else if (R.tds && R.tds.ult != null) {
      setEstadoSistema("ok", "Sistema en línea (API)", neon && neon.resumen ? neon.resumen._tUlt : null);
      if ($("nota-ts")) $("nota-ts").textContent = "Datos de tarjetas desde API Neon. TDS = Parametro_Id 5.";
    } else if (!tsCfg().channelId) tsPintarEstado(null);
  }
  actualizar();
  setInterval(actualizar, tsCfg().refrescoSegundos * 1000);
})();
