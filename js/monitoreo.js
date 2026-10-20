/* AgroIA - Monitoreo en tiempo real: tarjetas + los 4 gráficos oficiales de ThingSpeak */
montarLayout({ nuevo: true, estadoPropio: true });
(function () {
  "use strict";
  $("kpis").innerHTML = TS_MEDIDAS.map(m => kpiHTML(m)).join("");
  $("graficas").innerHTML = TS_MEDIDAS.map(m =>
    '<div class="mini-graf"><h4>' + m.nombre + (m.unidad ? " (" + m.unidad + ")" : "") + '</h4><div class="gcard-cuerpo" data-iframe="' + m.clave + '"></div></div>').join("");
  document.querySelectorAll("[data-iframe]").forEach(c => tsMontarIframe(c, tsMedida(c.dataset.iframe)));
  const ver = $("ver-ts"); ver.insertAdjacentHTML("beforeend", ico("i-ext"));
  const u = tsPublicUrl(); if (u) ver.href = u; else ver.style.display = "none";

  async function actualizar() {
    let res = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
    let R = tsResumen(res ? res.feeds : []);
    try {
      const neon = await cargarMuestras();
      if (neon && typeof fusionarResumen === "function") R = fusionarResumen(R, neon.resumen);
    } catch (eN) {}
    TS_MEDIDAS.forEach(m => pintarKPI(m, R[m.clave]));
    if (res && res.feeds && res.feeds.length) {
      tsPintarEstado(res);
      const ult = res.feeds[res.feeds.length - 1].t;
      $("nota-ts").textContent = "Tarjetas: API Neon + ThingSpeak (TDS = Parametro_Id 5). Gráficos: ThingSpeak." + (ult ? " Última TS: " + fmtFechaHora(ult) + "." : "");
    } else if (R.tds && R.tds.ult != null) {
      setEstadoSistema("ok", "Sistema en línea (API)", null);
      $("nota-ts").textContent = "Tarjetas alimentadas desde API Neon (/muestras). TDS = Parametro_Id 5.";
    } else if (!tsCfg().channelId) tsPintarEstado(null);
  }
  actualizar(); setInterval(actualizar, tsCfg().refrescoSegundos * 1000);
})();
