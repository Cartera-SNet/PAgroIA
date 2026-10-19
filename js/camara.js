montarLayout();
const v = $("video"), c = $("canvas"), x = c.getContext("2d");
const cx = document.createElement("canvas"), cxx = cx.getContext("2d");
let ws, vuelo = false, pausa = false;
v.onloadedmetadata = () => { c.width = v.videoWidth; c.height = v.videoHeight; };
let facingMode = "environment"; // rear by default on mobile
async function cam(force = false) {
  if (v.srcObject && !force) return;
  if (v.srcObject) {
    v.srcObject.getTracks().forEach(t => t.stop());
    v.srcObject = null;
  }
  try {
    const constraints = {
      video: { facingMode: facingMode },
      audio: false
    };
    v.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // fallback if facingMode not supported
    try { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
    catch (e2) { avisar("No fue posible acceder a la cámara.", e2); }
  }
}
function cambiarCamara() {
  facingMode = facingMode === "environment" ? "user" : "environment";
  cam(true);
}
document.getElementById("cambiar-cam")?.addEventListener("click", cambiarCamara);
function conectar() {
  ws = new WebSocket(`${WS_BASE_URL}/vision/stream`);
  ws.onopen = () => { setEstado("ws", true, "Stream conectado"); cam(); };
  ws.onclose = () => { setEstado("ws", false, "Stream desconectado"); vuelo = false; setTimeout(conectar, 3000); };
  ws.onerror = e => console.error(e);
  ws.onmessage = ev => {
    vuelo = false; let d; try { d = JSON.parse(ev.data); } catch { return; }
    const dets = d.detecciones || [], e = Math.max(c.width / 640, 1);
    x.clearRect(0, 0, c.width, c.height); $("cant").textContent = dets.length;
    dets.forEach(o => { const b = o.bbox; x.strokeStyle = x.fillStyle = "#e0654a"; x.lineWidth = 3 * e; x.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      x.font = `600 ${16 * e}px sans-serif`; x.fillText(`${o.clase} ${(o.confianza * 100).toFixed(1)}%`, b.x1, Math.max(b.y1 - 6, 16 * e)); });
    const t = d.telemetria;
    if (t && !t.error) $("tel").innerHTML = CAMPOS.map(([k,n,u]) => `<div class="det">${n}: <b>${esc(t[k] ?? "--")} ${u}</b></div>`).join("");
  };
}
$("pausa").onclick = () => { pausa = !pausa; $("pausa").textContent = pausa ? "Reanudar análisis" : "Pausar análisis"; if (pausa) x.clearRect(0, 0, c.width, c.height); };
setInterval(() => {
  if (pausa || vuelo || !ws || ws.readyState !== 1 || v.readyState < 2) return;
  cx.width = v.videoWidth; cx.height = v.videoHeight; cxx.drawImage(v, 0, 0);
  cx.toBlob(b => { if (b && ws.readyState === 1) { vuelo = true; ws.send(b); setTimeout(() => vuelo = false, 2500); } }, "image/jpeg", .7);
}, 120);
conectar();
