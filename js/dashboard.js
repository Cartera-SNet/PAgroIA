/* ==========================================================
   AgroIA - Inicio
   - Tarjetas, anillo de humedad del suelo y estado del sistema: datos reales del canal de ThingSpeak.
   - Temperatura del aire, humedad del aire, humedad del suelo y TDS: gráficos oficiales de ThingSpeak (iframes).
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
      const texto = est === "sin" ? "Sin lecturas de " + nombreMin(m) + " en el canal"
        : (r.fuente === "api" ? "Última lectura de la base de datos (ThingSpeak aún no tiene este campo)" : nivelTexto(est));
      n.className = "nivel" + (est === "normal" ? "" : " " + est);
      n.innerHTML = ico("i-leaf") + "<span>" + texto + "</span>";
    });
  }
  async function actualizar() {
    let res = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
    const R = await tsCompletarDesdeApi(tsResumen(res ? res.feeds : []));
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
