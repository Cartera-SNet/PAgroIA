/* ==========================================================
   AgroIA - Predicción de fertilidad
   - Si CLASIFICADOR.url (config.js) está definido, envía los datos al modelo (Punto 3, Edge Impulse).
   - Mientras no esté, hace una ESTIMACIÓN POR REGLAS con los rangos de RANGOS (config.js) y lo avisa en pantalla.
   ========================================================== */
montarLayout({ nuevo: true, estadoPropio: true });

(function () {
  "use strict";
  const CAMPOS_P = ["temp", "humAire", "humSuelo", "tds"];
  const LIM = { temp: [-10, 60], humAire: [0, 100], humSuelo: [0, 100], tds: [0, 5000] };
  $("ultima").innerHTML = ico("i-refresh") + "Usar la última lectura de ThingSpeak";

  function leerForm() {
    const v = {};
    for (const k of CAMPOS_P) {
      const t = $("p-" + k).value.trim(), n = t === "" ? null : parseFloat(t);
      if (n === null || isNaN(n)) { avisarToast("Completa «" + tsMedida(k).nombre + "»."); $("p-" + k).focus(); return null; }
      if (n < LIM[k][0] || n > LIM[k][1]) { avisarToast(tsMedida(k).nombre + " debe estar entre " + LIM[k][0] + " y " + LIM[k][1] + "."); $("p-" + k).focus(); return null; }
      v[k] = n;
    }
    return v;
  }

  /* ---- estimación por reglas (no es el modelo de IA) ---- */
  function puntaje(clave, valor) {
    const r = RANGOS[tsMedida(clave).rango];
    if (valor >= r[0] && valor <= r[1]) return 1;
    if (valor >= r[2] && valor <= r[3]) return 0.6;
    return 0.2;
  }
  function estimarPorReglas(v) {
    const pct = Math.round(CAMPOS_P.reduce((a, k) => a + puntaje(k, v[k]), 0) / CAMPOS_P.length * 100);
    const nivel = pct >= 85 ? "alta" : pct >= 70 ? "media" : "baja";
    const clase = { alta: "Alta fertilidad", media: "Fertilidad media", baja: "Baja fertilidad" }[nivel];
    const texto = { alta: "El suelo presenta condiciones favorables para el cultivo.",
                    media: "El suelo presenta condiciones aceptables, con parámetros por corregir.",
                    baja: "El suelo presenta condiciones desfavorables: conviene corregir los parámetros indicados." }[nivel];
    const R = k => RANGOS[tsMedida(k).rango], rec = [];
    const hs = tsEvaluar("humSuelo", v.humSuelo), r1 = R("humSuelo");
    rec.push(hs === "normal" ? "Mantener la humedad del suelo entre " + r1[0] + "% y " + r1[1] + "%."
      : hs === "bajo" ? "Aumentar el riego: la humedad del suelo está por debajo de " + r1[0] + "%."
      : "Reducir el riego o mejorar el drenaje: la humedad del suelo supera " + r1[1] + "%.");
    const td = tsEvaluar("tds", v.tds), r2 = R("tds");
    rec.push(td === "normal" ? "Mantener el TDS en un rango de " + r2[0] + " - " + r2[1] + " ppm."
      : td === "bajo" ? "El TDS está bajo (" + r2[0] + " - " + r2[1] + " ppm recomendado)."
      : "El TDS está alto; revisar riego y fertilización (rango " + r2[0] + " - " + r2[1] + " ppm).");
    const t = tsEvaluar("temp", v.temp), r3 = R("temp");
    if (t === "alto") rec.push("Temperatura alta (más de " + r3[1] + " °C): considerar sombra o cobertura del suelo.");
    if (t === "bajo") rec.push("Temperatura baja (menos de " + r3[0] + " °C): considerar protección del cultivo.");
    const ha = tsEvaluar("humAire", v.humAire), r4 = R("humAire");
    if (ha === "alto") rec.push("Humedad del aire alta (más de " + r4[1] + "%): vigilar hongos y mejorar la ventilación.");
    if (ha === "bajo") rec.push("Humedad del aire baja (menos de " + r4[0] + "%): considerar cobertura del suelo para retener humedad.");
    rec.push("Programar la fertilización orgánica con base en un análisis de nutrientes (este sistema no mide N-P-K).");
    return { clase: clase, nivel: nivel, texto: texto, pct: pct, rec: rec, origen: "reglas" };
  }

  async function clasificarConModelo(v) {
    const r = await fetch(CLASIFICADOR.url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temperatura: v.temp, humedad_aire: v.humAire, humedad_suelo: v.humSuelo, tds: v.tds }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    let conf = Number(d.confianza); if (!isFinite(conf)) conf = null; else if (conf <= 1) conf = conf * 100;
    const txt = String(d.clase || "Sin clase"), n = sinAcentos(txt);
    const nivel = /alta/.test(n) ? "alta" : /media|moderada/.test(n) ? "media" : /baja/.test(n) ? "baja" : "media";
    return { clase: txt, nivel: nivel, texto: d.descripcion || "Resultado del modelo de inteligencia artificial.", pct: conf === null ? null : Math.round(conf),
             rec: Array.isArray(d.recomendaciones) && d.recomendaciones.length ? d.recomendaciones : estimarPorReglas(v).rec, origen: "modelo" };
  }

  function mostrar(res) {
    const color = { alta: "#0f8a4b", media: "#d97706", baja: "#dc2626" }[res.nivel];
    const aviso = res.origen === "reglas"
      ? '<div class="badge-reglas">' + ico("i-info") + '<span>Estimación por reglas con los rangos del cultivo, <b>no es el modelo de IA</b>. Se reemplaza cuando se conecte el modelo del Punto 3 (Edge Impulse).</span></div>'
      : '<div class="badge-reglas" style="background:#eef7f1;border-color:#cde8d6;color:#1d5a3a">' + ico("i-check") + '<span>Resultado del modelo de inteligencia artificial.</span></div>';
    $("resultado").innerHTML = '<h3>Resultado de la IA</h3>' +
      '<div class="res-cab"><div class="res-ico ' + (res.nivel === "alta" ? "" : res.nivel) + '">' + ico(res.nivel === "alta" ? "i-sprout" : "i-leaf") + '</div>' +
      '<div><h4 class="' + (res.nivel === "alta" ? "" : res.nivel) + '">' + esc(res.clase) + '</h4><p>' + esc(res.texto) + '</p></div></div>' +
      '<div class="res-donut">' + donutSVG(res.pct, { color: color }) + '<small>' + (res.origen === "reglas" ? "Condiciones dentro de rango" : "Confianza del modelo") + '</small></div>' +
      '<div class="recom"><h4>Recomendaciones</h4><ul>' + res.rec.map(t => '<li>' + ico("i-check") + '<span>' + esc(t) + '</span></li>').join("") + '</ul></div>' + aviso;
  }

  async function analizar() {
    const v = leerForm(); if (!v) return;
    $("analizar").disabled = true;
    let res;
    if (CLASIFICADOR.url) {
      try { res = await clasificarConModelo(v); }
      catch (e) { console.error(e); avisarToast("No se pudo consultar el modelo; se usa la estimación por reglas."); res = estimarPorReglas(v); }
    } else res = estimarPorReglas(v);
    mostrar(res); $("analizar").disabled = false;
  }

  async function usarUltima(auto) {
    if (!tsCfg().channelId) { $("origen-datos").textContent = "Falta configurar el canal de ThingSpeak (Configuración)."; return false; }
    try {
      const res = await tsFeeds({ results: 10 }); tsPintarEstado(res);
      const R = tsResumen(res ? res.feeds : []);
      if (!res || !res.feeds.length) { $("origen-datos").textContent = "El canal todavía no tiene lecturas."; return false; }
      CAMPOS_P.forEach(k => { if (R[k] && R[k].ult !== null) $("p-" + k).value = Number(R[k].ult).toFixed(tsMedida(k).dec); });
      try {
        const neon = await cargarMuestras();
        if (neon && neon.resumen) {
          CAMPOS_P.forEach(k => {
            const u = neon.resumen[k] && neon.resumen[k].ult;
            if (u != null && (!$("p-" + k).value || k === "tds")) $("p-" + k).value = Number(u).toFixed(tsMedida(k).dec);
          });
        }
      } catch (e) {}
      $("origen-datos").textContent = "Valores tomados de la última lectura de ThingSpeak (" + fmtFechaHora(res.feeds[res.feeds.length - 1].t) + "). Puedes editarlos.";
      return true;
    } catch (e) { console.error(e); $("origen-datos").textContent = "No fue posible leer ThingSpeak."; if (!auto) avisarToast("No fue posible leer ThingSpeak."); return false; }
  }

  $("analizar").onclick = analizar;
  $("ultima").onclick = async () => { if (await usarUltima(false)) analizar(); };
  CAMPOS_P.forEach(k => $("p-" + k).addEventListener("keydown", e => { if (e.key === "Enter") analizar(); }));
  $("resultado").innerHTML = '<h3>Resultado de la IA</h3><div class="res-vacio">' + ico("i-brain") + '<span>Completa los datos y pulsa <b>Analizar</b>.</span></div>';
  usarUltima(true).then(ok => { if (ok) analizar(); });
})();
