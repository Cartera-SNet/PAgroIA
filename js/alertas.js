montarLayout();
// Endpoint real del backend (GET /alertas/list).
const ALERTAS_ENDPOINT = "/alertas/list";
async function cargar() {
  try {
    const m = await leerMedicion(), out = [];
    CAMPOS.forEach(([k,n,u]) => { const v = m[k];
      if (v == null) out.push(`Sensor sin datos: ${n}`);
      else if (estadoValor(k, Number(v)) !== "ok") out.push(`${n} fuera del rango (${v} ${u})`.trim()); });
    if (!m.time || (Date.now() - new Date(m.time)) > 120000) out.push("ESP32 sin datos recientes");
    $("locales").innerHTML = out.length ? out.map(t => `<div class="det">⚠ ${esc(t)}</div>`).join("") : '<span class="ok-msg">Sin alertas: todas las variables están en rango.</span>';
    limpiarAviso();
  } catch (e) { avisar("No fue posible obtener la telemetría. Verifique que el backend esté funcionando.", e); }
  if (!ALERTAS_ENDPOINT) { $("remotas").innerHTML = '<div class="aviso info">ENDPOINT PENDIENTE: defina ALERTAS_ENDPOINT en js/alertas.js según /docs.</div>'; return; }
  try {
    const d = await apiJson(ALERTAS_ENDPOINT), lista = Array.isArray(d) ? d : (d.alertas || [d]);
    lista.sort((x, y) => new Date(y.Alerta_FechaHora || 0) - new Date(x.Alerta_FechaHora || 0));
    $("remotas").innerHTML = lista.slice(0, 100).map(al => `<div class="alerta-item">
      <span class="alerta-nivel ${esc(String(al.Alerta_Nivel || "").toLowerCase())}">${esc(al.Alerta_Nivel || "—")}</span>
      <div class="alerta-cuerpo"><b>${esc(al.Alerta_Tipo || "Alerta")}</b> — ${esc(al.Alerta_Mensaje || "")}
      <small>${esc(fmtHora(al.Alerta_FechaHora))} · ${esc(al.Alerta_Estado || "")} · muestra #${esc(al.Muestra_Id ?? "—")}</small></div></div>`).join("")
      || '<span class="vacio">Sin alertas registradas.</span>';
  } catch (e) { avisar("No fue posible consultar las alertas.", e); }
}
cargar(); setInterval(cargar, 10000);
