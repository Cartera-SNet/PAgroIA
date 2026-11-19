montarLayout();
// Endpoint real del backend (GET /alertas/list).
const ALERTAS_ENDPOINT = "/alertas/list";
async function cargar() {
  try {
    // Los datos en vivo vienen de ThingSpeak (igual que el tablero); /iot/ultima-medicion necesita InfluxDB, que no existe.
    const res = await tsFeeds({ results: tsCfg().resultados }), out = [];
    if (!res) throw new Error("Sin canal de ThingSpeak configurado");
    const R = tsResumen(res.feeds);
    const m = { humedad_suelo: R.humSuelo.ult, temp_aire: R.temp.ult, humedad_aire: R.humAire.ult, tds: R.tds.ult };
    const CLAVES = { humedad_suelo: "humSuelo", temp_aire: "temp", humedad_aire: "humAire", tds: "tds" };
    CAMPOS.filter(([k]) => CLAVES[k]).forEach(([k,n,u]) => { const v = m[k];
      if (v == null) out.push(`Sensor sin datos: ${n}`);
      else if (estadoValor(k, Number(v)) !== "ok") out.push(`${n} fuera del rango (${v} ${u})`.trim()); });
    const ultima = res.feeds.length ? res.feeds[res.feeds.length - 1].t : null;
    if (!ultima || (Date.now() - ultima) > 120000) out.push("ESP32 sin datos recientes");
    $("locales").innerHTML = out.length ? out.map(t => `<div class="det">⚠ ${esc(t)}</div>`).join("") : '<span class="ok-msg">Sin alertas: todas las variables están en rango.</span>';
    limpiarAviso();
  } catch (e) { avisar("No fue posible obtener los datos de ThingSpeak. Verifique su conexión y el canal.", e); }
  if (!ALERTAS_ENDPOINT) { $("remotas").innerHTML = '<div class="aviso info">ENDPOINT PENDIENTE: defina ALERTAS_ENDPOINT en js/alertas.js según /docs.</div>'; return; }
  try {
    const d = await apiJson(ALERTAS_ENDPOINT), lista = Array.isArray(d) ? d : (d.alertas || [d]);
    lista.sort((x, y) => new Date(y.Alerta_FechaHora || 0) - new Date(x.Alerta_FechaHora || 0));
    $("remotas").innerHTML = lista.slice(0, 100).map(al => `<div class="alerta-item">
      <span class="alerta-nivel ${esc(String(al.Alerta_Nivel || "").toLowerCase())}">${esc(al.Alerta_Nivel || "—")}</span>
      <div class="alerta-cuerpo"><b>${esc(al.Alerta_Tipo || "Alerta")}</b> - ${esc(al.Alerta_Mensaje || "")}
      <small>${esc(fmtHora(al.Alerta_FechaHora))} · ${esc(al.Alerta_Estado || "")} · muestra #${esc(al.Muestra_Id ?? "—")}</small></div></div>`).join("")
      || '<span class="vacio">Sin alertas registradas.</span>';
  } catch (e) { avisar("No fue posible consultar las alertas.", e); }
}
cargar(); setInterval(cargar, 10000);
