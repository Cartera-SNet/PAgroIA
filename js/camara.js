/* Cámara en vivo: YOLO por WebSocket + telemetría desde ThingSpeak (no Influx). */
montarLayout();
const v = $("video"), c = $("canvas"), x = c.getContext("2d");
const cx = document.createElement("canvas"), cxx = cx.getContext("2d");
let ws, vuelo = false, pausa = false;

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

function pintarTelemetriaDesdeTS(feeds) {
  const tel = $("tel");
  if (!tel) return;
  const ult = feeds && feeds[0] && feeds[0].v ? feeds[0].v : null;
  const cuando = feeds && feeds[0] && feeds[0].t ? feeds[0].t : null;
  if (!ult) {
    tel.innerHTML = "<div class=\"det\">Sin datos recientes en ThingSpeak.</div>";
    return;
  }
  const lineas = TS_MEDIDAS.map(m => {
    const val = ult[m.clave];
    const txt = (val === null || val === undefined) ? "—" : fmtVal(m, val);
    return `<div class="det">${m.nombre}: <b>${txt}</b></div>`;
  });
  if (cuando) {
    lineas.push(`<div class="det" style="margin-top:8px;opacity:.75;font-size:12px">Última lectura: ${fmtFechaHora(cuando)}</div>`);
  }
  tel.innerHTML = lineas.join("");
}

async function refrescarTelemetria() {
  try {
    const res = await tsFeeds({ results: 3 });
    pintarTelemetriaDesdeTS(res.feeds || []);
  } catch (e) {
    const tel = $("tel");
    if (tel) tel.innerHTML = "<div class=\"det\">No se pudo leer ThingSpeak.</div>";
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
    });
    // Telemetría del WS solo si trae datos útiles; si no, se mantiene ThingSpeak
    const t = d.telemetria;
    if (t && !t.error && Object.keys(t).length) {
      const tiene = Object.values(t).some(v => v !== null && v !== undefined && v !== "" && v !== "--");
      if (tiene && typeof CAMPOS !== "undefined") {
        $("tel").innerHTML = CAMPOS.map(([k, n, u]) =>
          `<div class="det">${n}: <b>${esc(t[k] ?? "—")} ${u || ""}</b></div>`
        ).join("");
      }
    }
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
