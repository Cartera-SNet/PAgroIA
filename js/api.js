const TOKEN_KEY = "agroia_token";
const obtenerToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CAMPOS = [["humedad_suelo","Humedad del suelo","%"],["temp_aire","Temperatura del aire","°C"],
  ["humedad_aire","Humedad del aire","%"],["ph","pH",""],["tds","TDS","ppm"]];

async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = obtenerToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (r.status === 401) { cerrarSesion(); throw new Error("401"); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}
const apiJson = async (e, o) => (await apiFetch(e, o)).json();
// /iot/ultima-medicion responde { fuente, medicion: [ {humedad_suelo, temp_aire, ..., time} ] }.
// Devolvemos directamente la fila más reciente (o {} si no hay datos).
async function leerMedicion() {
  const d = await apiJson("/iot/ultima-medicion");
  if (d.telemetria) return d.telemetria;
  if (Array.isArray(d.medicion)) return d.medicion[0] || {};
  return d.medicion || d;
}

const fmtHora = t => t ? new Date(t).toLocaleString() : "--";
function estadoValor(k, v) {
  const r = RANGOS[k]; if (v == null || isNaN(v)) return "";
  if (v >= r[0] && v <= r[1]) return "ok";
  return v >= r[2] && v <= r[3] ? "warn" : "bad";
}
function setEstado(id, ok, txt) { const e = $(id); e.className = "st " + (ok === null ? "na" : ok ? "ok" : "bad"); e.textContent = txt; }
function avisar(msg, err) { if (err) console.error(err); const a = $("aviso"); if (!a) return; a.textContent = "⚠ " + msg; a.hidden = false; }
const limpiarAviso = () => { const a = $("aviso"); if (a) a.hidden = true; };
