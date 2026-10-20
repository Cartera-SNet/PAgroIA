/* ==========================================================
   AgroIA - Piezas de interfaz compartidas por las pantallas nuevas
   ========================================================== */
function iconoMedida(m) {
  return '<div class="kpi-ico ' + m.clase + '">' + (m.icono ? ico(m.icono) : '<span class="ph-txt">TDS</span>') + '</div>';
}

/* Tarjeta de una medición. opts.delta = true agrega la variación (↑ 0.8 °C) */
function kpiHTML(m, opts) {
  opts = opts || {};
  return '<article class="kpi" id="kpi-' + m.clave + '">' + iconoMedida(m) +
    '<div class="kpi-info"><span class="kpi-lab">' + m.nombre + '</span><div class="kpi-fila"><b class="kpi-val" data-v>—</b>' +
    (opts.delta ? '<span class="kpi-delta" data-d></span>' : '') + '</div></div></article>';
}
function pintarKPI(m, r) {
  const t = document.getElementById("kpi-" + m.clave); if (!t) return;
  t.querySelector("[data-v]").textContent = fmtVal(m, r.ult);
  const d = t.querySelector("[data-d]"); if (!d) return;
  if (r.n >= 2 && r.ult !== null && r.primero !== null) {
    const dif = r.ult - r.primero, a = Math.abs(dif), igual = a < Math.pow(10, -m.dec) / 2;
    d.className = "kpi-delta" + (igual ? " igual" : dif < 0 ? " baja" : "");
    d.textContent = (igual ? "→ " : dif < 0 ? "↓ " : "↑ ") + fmtNum(a, m.dec) + (m.unidad ? " " + m.unidad : "");
  } else { d.className = "kpi-delta"; d.textContent = ""; }
}

/* Texto del nivel (bajo el anillo de humedad del suelo) */
function nivelTexto(est) {
  return { normal: "Nivel óptimo", bajo: "Nivel bajo", alto: "Nivel alto", sin: "Sin dato" }[est];
}

/* Escapa texto y respeta saltos de línea simples */
const soloTexto = s => esc(String(s)).replace(/\n/g, "<br>");

/* minúsculas y sin tildes, para comparar textos */
const sinAcentos = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
