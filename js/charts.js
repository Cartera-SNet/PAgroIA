/* ==========================================================
   AgroIA — Gráficos SVG propios (sin librerías externas)
   ========================================================== */
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, texto) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/* Mini línea con relleno (tarjetas) */
function sparkline(svg, valores, color) {
  svg.innerHTML = "";
  if (!valores || valores.length < 2) return;
  const mn = Math.min.apply(null, valores), mx = Math.max.apply(null, valores), rg = (mx - mn) || 1;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * 100, 26 - ((v - mn) / rg) * 22]);
  const d = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  svg.setAttribute("viewBox", "0 0 100 30"); svg.setAttribute("preserveAspectRatio", "none");
  svg.appendChild(svgEl("polyline", { points: d, fill: "none", stroke: color, "stroke-width": "1.6", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" }));
}

/* Anillo con porcentaje en el centro. Devuelve el SVG como texto. */
function donutSVG(pct, o) {
  o = o || {};
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct == null ? 0 : pct));
  const color = o.color || "#0f8a4b", pista = o.pista || "#d8eedf";
  const txt = pct == null ? "—" : Math.round(p) + "%";
  return '<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="' + txt + '">' +
    '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + pista + '" stroke-width="15"/>' +
    '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="15" stroke-linecap="round" ' +
      'stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
    '<text x="70" y="78" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="700" fill="#10243e">' + txt + '</text></svg>';
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* Líneas con doble eje. op: { series:[{nombre,color,eje:"izq"|"der",datos:[{t:Date,v:Number|null}]}], izq:{min,max}, der:{min,max} } */
function lineaMulti(cont, op) {
  cont.innerHTML = "";
  const todos = [];
  op.series.forEach(s => s.datos.forEach(d => { if (d.v !== null && d.v !== undefined) todos.push(d.t.getTime()); }));
  if (!todos.length) { cont.innerHTML = '<div class="graf-aviso">No hay datos en el período elegido.</div>'; return; }

  const W = Math.max(cont.clientWidth, 300), H = Math.max(cont.clientHeight, 220);
  const mg = { l: 40, r: 42, t: 12, b: 30 }, iw = W - mg.l - mg.r, ih = H - mg.t - mg.b;
  const tmin = Math.min.apply(null, todos), tmax = Math.max.apply(null, todos), rt = (tmax - tmin) || 1;
  const izq = Object.assign({ min: 0, max: 100 }, op.izq), der = Object.assign({ min: 4, max: 8 }, op.der);
  // el eje de pH se amplía si algún valor se sale de 4–8
  op.series.filter(s => s.eje === "der").forEach(s => s.datos.forEach(d => {
    if (d.v === null) return;
    if (d.v < der.min) der.min = Math.floor(d.v); if (d.v > der.max) der.max = Math.ceil(d.v);
  }));
  const x = t => mg.l + (todos.length === 1 || tmax === tmin ? iw / 2 : ((t - tmin) / rt) * iw);
  const yIzq = v => mg.t + ih - ((v - izq.min) / (izq.max - izq.min)) * ih;
  const yDer = v => mg.t + ih - ((v - der.min) / (der.max - der.min)) * ih;

  const svg = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img" });
  const gris = "#6b7a8d";
  // rejilla y etiquetas de ambos ejes (5 divisiones)
  for (let i = 0; i <= 4; i++) {
    const y = mg.t + (ih / 4) * i;
    svg.appendChild(svgEl("line", { x1: mg.l, x2: W - mg.r, y1: y, y2: y, stroke: i === 4 ? "#c9d3cd" : "#e8eeea", "stroke-width": 1 }));
    svg.appendChild(svgEl("text", { x: mg.l - 8, y: y + 4, "text-anchor": "end", "font-size": 11, fill: gris }, Math.round(izq.max - ((izq.max - izq.min) / 4) * i)));
    svg.appendChild(svgEl("text", { x: W - mg.r + 8, y: y + 4, "text-anchor": "start", "font-size": 11, fill: gris }, (der.max - ((der.max - der.min) / 4) * i).toFixed(1)));
  }
  svg.appendChild(svgEl("rect", { x: mg.l, y: mg.t, width: iw, height: ih, fill: "none", stroke: "#d5ded8" }));

  // marcas del eje X
  const rango = tmax - tmin, dia = 86400000, nT = Math.min(7, Math.max(2, Math.floor(iw / 90)));
  for (let i = 0; i < nT; i++) {
    const t = nT === 1 || rango === 0 ? tmin : tmin + (rango / (nT - 1)) * i, d = new Date(t);
    const et = rango <= 2 * dia ? dos(d.getHours()) + ":" + dos(d.getMinutes()) : dos(d.getDate()) + " " + MESES[d.getMonth()];
    const xx = x(t);
    svg.appendChild(svgEl("line", { x1: xx, x2: xx, y1: mg.t + ih, y2: mg.t + ih + 4, stroke: "#c9d3cd" }));
    svg.appendChild(svgEl("text", { x: xx, y: H - 10, "text-anchor": "middle", "font-size": 11, fill: gris }, et));
  }

  // series
  op.series.forEach(s => {
    const f = s.eje === "der" ? yDer : yIzq;
    let seg = [];
    const cerrar = () => { if (seg.length > 1) svg.appendChild(svgEl("polyline", { points: seg.join(" "), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" })); seg = []; };
    s.datos.forEach(d => { if (d.v === null || d.v === undefined) cerrar(); else seg.push(x(d.t.getTime()).toFixed(1) + "," + f(d.v).toFixed(1)); });
    cerrar();
    s.datos.forEach(d => {
      if (d.v === null || d.v === undefined) return;
      const c = svgEl("circle", { cx: x(d.t.getTime()).toFixed(1), cy: f(d.v).toFixed(1), r: s.datos.length > 120 ? 1.6 : 3, fill: s.color });
      c.appendChild(svgEl("title", {}, s.nombre + ": " + d.v + " · " + fmtFechaHora(d.t)));
      svg.appendChild(c);
    });
  });
  cont.appendChild(svg);
}
