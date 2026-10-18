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
    const R = tsResumen(res ? res.feeds : []);
    TS_MEDIDAS.forEach(m => pintarKPI(m, R[m.clave]));
    if (res) {
      tsPintarEstado(res);
      const ult = res.feeds.length ? res.feeds[res.feeds.length - 1].t : null;
      $("nota-ts").textContent = "Gráficos oficiales de ThingSpeak. Se actualizan solos cada 15 segundos." + (ult ? " Última lectura: " + fmtFechaHora(ult) + "." : "");
    } else if (!tsCfg().channelId) tsPintarEstado(null);
  }
  actualizar(); setInterval(actualizar, tsCfg().refrescoSegundos * 1000);
})();
