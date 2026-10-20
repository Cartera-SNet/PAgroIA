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

  function montarGraficos(neonFeeds) {
    document.querySelectorAll("[data-iframe]").forEach(function (c) {
      var m = tsMedida(c.dataset.iframe);
      // TDS (y cualquier serie vacía en TS): gráfica desde Neon
      if (m && m.clave === "tds" && neonFeeds && neonFeeds.length && typeof neonMontarGrafico === "function") {
        if (neonMontarGrafico(c, m, neonFeeds)) return;
      }
      tsMontarIframe(c, m);
    });
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
    var res = null, neon = null;
    try { res = await tsFeeds({ results: tsCfg().resultados }); } catch (e) { console.error(e); }
    try { neon = await cargarMuestras(); } catch (e) { console.error("Neon", e); }

    var Rts = tsResumen(res ? res.feeds : []);
    var R = (typeof fusionarResumen === "function" && neon)
      ? fusionarResumen(Rts, neon.resumen)
      : Rts;

    // Forzar TDS desde Neon si existe
    if (neon && neon.resumen && neon.resumen.tds && neon.resumen.tds.ult != null) {
      R.tds = neon.resumen.tds;
    }

    TS_MEDIDAS.forEach(function (m) {
      pintarKPI(m, R[m.clave] || { ult: null, primero: null, n: 0 });
    });
    pintarSuelo(R.humSuelo || { ult: null });

    // Redibujar gráfica TDS si hay datos Neon
    if (neon && neon.feeds && neon.feeds.length) {
      var cont = document.querySelector('[data-iframe="tds"]');
      var mTds = tsMedida("tds");
      if (cont && mTds) neonMontarGrafico(cont, mTds, neon.feeds);
    }

    if (res && res.feeds && res.feeds.length) tsPintarEstado(res);
    else if (neon && neon.resumen && neon.resumen._tUlt) {
      setEstadoSistema("ok", "Sistema en línea (API)", neon.resumen._tUlt);
    } else if (!tsCfg().channelId) tsPintarEstado(null);
    else setEstadoSistema("warn", "Sin datos recientes", null);
  }

  try { chatConectar({ log: "chat-log", campo: "chat-input", boton: "chat-enviar" }); }
  catch (e) { console.warn("chat mini", e); }

  // primera carga: iframes TS + luego actualizar pinta TDS Neon
  montarGraficos(null);
  actualizar();
  setInterval(actualizar, (tsCfg().refrescoSegundos || 15) * 1000);
})();
