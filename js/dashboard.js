/* AgroIA - Inicio */
montarLayout({ nuevo: true, estadoPropio: true });

(function () {
  "use strict";

  try {
    if ($("banner-logo")) $("banner-logo").innerHTML = ico("logo-hoja");
    if ($("ia-ico")) $("ia-ico").innerHTML = ico("i-brain");
    if ($("ver-analisis")) $("ver-analisis").insertAdjacentHTML("beforeend", ico("i-arrow"));
    if ($("chat-cab")) $("chat-cab").insertAdjacentHTML("afterbegin", ico("i-chat"));
    if ($("chat-enviar")) $("chat-enviar").innerHTML = ico("i-send");
    document.querySelectorAll("[data-ext]").forEach(function (a) { a.innerHTML = ico("i-ext"); });
  } catch (e) { console.warn(e); }

  if ($("kpis")) $("kpis").innerHTML = TS_MEDIDAS.map(function (m) { return kpiHTML(m, { delta: true }); }).join("");

  function montarGraficos() {
    document.querySelectorAll("[data-iframe]").forEach(function (c) { tsMontarIframe(c, tsMedida(c.dataset.iframe)); });
    document.querySelectorAll("[data-ext]").forEach(function (a) {
      var u = tsChartUrl(tsMedida(a.dataset.ext));
      if (u) a.href = u; else a.removeAttribute("href");
    });
  }

  function pintarSuelo(r) {
    if (!$("donut-suelo")) return;
    var est = tsEvaluar("humSuelo", r.ult);
    $("donut-suelo").innerHTML = donutSVG(r.ult, { color: est === "normal" ? "#0f8a4b" : "#d97706" });
    var n = $("nivel-suelo");
    if (n) {
      n.className = "nivel" + (est === "normal" ? "" : " " + est);
      n.innerHTML = ico("i-leaf") + "<span>" + nivelTexto(est) + "</span>";
    }
  }

  async function actualizar() {
    var res = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); }
    catch (e) { console.error(e); setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
    var R = tsResumen(res ? res.feeds : []);
    TS_MEDIDAS.forEach(function (m) { pintarKPI(m, R[m.clave]); });
    pintarSuelo(R.humSuelo);
    if (res) tsPintarEstado(res);
    else if (!tsCfg().channelId) tsPintarEstado(null);
  }

  // Chat mini: no debe tumbar el resto del dashboard
  try {
    chatConectar({ log: "chat-log", campo: "chat-input", boton: "chat-enviar" });
  } catch (e) { console.warn("chat mini", e); }

  montarGraficos();
  actualizar();
  setInterval(actualizar, (tsCfg().refrescoSegundos || 15) * 1000);
})();
