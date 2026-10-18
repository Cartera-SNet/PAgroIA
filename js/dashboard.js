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
  function pintarSuelo(r) {
    const m = tsMedida("humSuelo"), est = tsEvaluar("humSuelo", r.ult);
    $("donut-suelo").innerHTML = donutSVG(r.ult, { color: est === "normal" ? "#0f8a4b" : "#d97706" });
    const n = $("nivel-suelo");
    n.className = "nivel" + (est === "normal" ? "" : " " + est);
    n.innerHTML = ico("i-leaf") + "<span>" + nivelTexto(est) + "</span>";
  }
  async function actualizar() {
    let res = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
    const R = tsResumen(res ? res.feeds : []);
    TS_MEDIDAS.forEach(m => pintarKPI(m, R[m.clave]));
    pintarSuelo(R.humSuelo);
    if (res) tsPintarEstado(res); else if (!tsCfg().channelId) tsPintarEstado(null);
  }

  // ---- chat
  const enviar = chatConectar({ log: $("chat-log"), campo: $("chat-input"), boton: $("chat-enviar") });

  montarGraficos();
  actualizar();
  setInterval(actualizar, tsCfg().refrescoSegundos * 1000);
})();
