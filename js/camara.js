/* Cámara en vivo: YOLO por WebSocket + panel = detección visual + sensores (Neon/ThingSpeak). */
montarLayout();
const v = $("video"), c = $("canvas"), x = c.getContext("2d");
const cx = document.createElement("canvas"), cxx = cx.getContext("2d");
let ws, vuelo = false, pausa = false;
let ultimaDeteccion = null; // { clase, confianza, n }

v.onloadedmetadata = () => { c.width = v.videoWidth; c.height = v.videoHeight; };

let facingMode = "environment";

async function cam(force = false) {
  if (v.srcObject && !force) return;
  if (v.srcObject) {
    v.srcObject.getTracks().forEach(t => t.stop());
    v.srcObject = null;
  }
  try {
    v.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode },
      audio: false
    });
  } catch (e) {
    try {
      v.srcObject = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e2) {
      avisar("No fue posible acceder a la cámara.", e2);
    }
  }
}

function cambiarCamara() {
  facingMode = facingMode === "environment" ? "user" : "environment";
  cam(true);
}
document.getElementById("cambiar-cam")?.addEventListener("click", cambiarCamara);

/** Panel derecho: 1) lo que ve YOLO  2) sensores (último valor por variable, no un solo segundo) */
function pintarPanel() {
  const tel = $("tel");
  if (!tel) return;
  const partes = [];

  // —— Visión (lo que “ve” la cámara) ——
  partes.push('<div class="det" style="font-weight:600;margin-bottom:6px">Lo que ve la cámara</div>');
  if (ultimaDeteccion && ultimaDeteccion.n > 0) {
    const pct = ultimaDeteccion.confianza <= 1
      ? (ultimaDeteccion.confianza * 100).toFixed(1)
      : Number(ultimaDeteccion.confianza).toFixed(1);
    partes.push(
      `<div class="det">Clase: <b>${esc(ultimaDeteccion.clase || "—")}</b></div>` +
      `<div class="det">Confianza: <b>${pct}%</b></div>` +
      `<div class="det">Detecciones: <b>${ultimaDeteccion.n}</b></div>`
    );
  } else {
    partes.push('<div class="det">Sin detección YOLO aún (apunta al suelo).</div>');
  }

  partes.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">');
  partes.push('<div class="det" style="font-weight:600;margin-bottom:6px">Sensores (API / IoT)</div>');

  // —— Sensores: último valor no nulo por clave ——
  const R = window._telResumen;
  const cuando = window._telCuando;
  if (R && typeof TS_MEDIDAS !== "undefined") {
    TS_MEDIDAS.forEach(m => {
      const r = R[m.clave] || {};
      const txt = (r.ult === null || r.ult === undefined) ? "—" : fmtVal(m, r.ult);
      partes.push(`<div class="det">${m.nombre}: <b>${txt}</b></div>`);
    });
    if (cuando) {
      partes.push(`<div class="det" style="margin-top:8px;opacity:.75;font-size:12px">Última lectura sensor: ${fmtFechaHora(cuando)}</div>`);
    }
  } else {
    partes.push('<div class="det">Cargando sensores…</div>');
  }

  tel.innerHTML = partes.join("");
}

async function refrescarTelemetria() {
  try {
    let resumen = null;
    let cuando = null;
    try {
      if (typeof cargarMuestras === "function") {
        const neon = await cargarMuestras();
        if (neon && neon.resumen) {
          resumen = neon.resumen;
          cuando = neon.resumen._tUlt || null;
        }
      }
    } catch (e1) { console.warn(e1); }

    if (!resumen || (resumen.tds && resumen.tds.ult == null && resumen.temp && resumen.temp.ult == null)) {
      try {
        const res = await tsFeeds({ results: 20 });
        const feeds = (res && res.feeds) || [];
        resumen = tsResumen(feeds);
        if (feeds.length) {
          cuando = feeds.reduce((a, b) => (a.t > b.t ? a : b)).t;
        }
      } catch (e2) { console.warn(e2); }
    }

    window._telResumen = resumen;
    window._telCuando = cuando;
    pintarPanel();
  } catch (e) {
    const tel = $("tel");
    if (tel) tel.innerHTML = "<div class=\"det\">No se pudieron leer sensores.</div>";
  }
}

function conectar() {
  ws = new WebSocket(`${WS_BASE_URL}/vision/stream`);
  ws.onopen = () => { setEstado("ws", true, "Stream conectado"); cam(); };
  ws.onclose = () => { setEstado("ws", false, "Stream desconectado"); vuelo = false; setTimeout(conectar, 3000); };
  ws.onerror = e => console.error(e);
  ws.onmessage = ev => {
    vuelo = false;
    let d;
    try { d = JSON.parse(ev.data); } catch { return; }
    const dets = d.detecciones || [];
    const e = Math.max(c.width / 640, 1);
    x.clearRect(0, 0, c.width, c.height);
    $("cant").textContent = dets.length;

    let best = null;
    dets.forEach(o => {
      const b = o.bbox || {
        x1: o.x_min, y1: o.y_min, x2: o.x_max, y2: o.y_max
      };
      if (b.x1 == null) return;
      x.strokeStyle = x.fillStyle = "#e0654a";
      x.lineWidth = 3 * e;
      x.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      x.font = `600 ${16 * e}px sans-serif`;
      const conf = (o.confianza != null ? o.confianza : 0);
      const pct = conf <= 1 ? (conf * 100).toFixed(1) : Number(conf).toFixed(1);
      x.fillText(`${o.clase} ${pct}%`, b.x1, Math.max(b.y1 - 6, 16 * e));
      if (!best || conf > best.confianza) best = { clase: o.clase, confianza: conf };
    });

    ultimaDeteccion = best
      ? { clase: best.clase, confianza: best.confianza, n: dets.length }
      : { clase: null, confianza: 0, n: 0 };
    pintarPanel();
  };
}

$("pausa").onclick = () => {
  pausa = !pausa;
  $("pausa").textContent = pausa ? "Reanudar análisis" : "Pausar análisis";
  if (pausa) x.clearRect(0, 0, c.width, c.height);
};

setInterval(() => {
  if (pausa || vuelo || !ws || ws.readyState !== 1 || v.readyState < 2) return;
  cx.width = v.videoWidth;
  cx.height = v.videoHeight;
  cxx.drawImage(v, 0, 0);
  cx.toBlob(b => {
    if (b && ws.readyState === 1) {
      vuelo = true;
      ws.send(b);
      setTimeout(() => { vuelo = false; }, 2500);
    }
  }, "image/jpeg", 0.7);
}, 120);

conectar();
refrescarTelemetria();
setInterval(refrescarTelemetria, 15000);
