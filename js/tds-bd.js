/* ==========================================================
   AgroIA - TDS desde la base de datos (respaldo cuando ThingSpeak no tiene el campo 4)
   Lee GET /muestras/list (sin sesión), filtra el Sensor_Id 5 (TDS) y devuelve las últimas lecturas.
   Solo lo usa el tablero de Inicio. Se pide como máximo una vez por minuto.
   ========================================================== */
const TDS_SENSOR_ID = 5;
const TDS_BD_MAX = 60;          // lecturas que se guardan para la gráfica
const TDS_BD_CADA_MS = 60000;   // /muestras/list devuelve toda la tabla: no pedirla seguido
let _tdsBd = { t: 0, datos: null };

// Las fechas de la base vienen en UTC y sin zona horaria: se les agrega «Z».
const tdsFechaUTC = s => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");

/* -> [{ t: Date, v: número }] de la más antigua a la más reciente, o null si falla la consulta */
async function tdsDesdeBD() {
  if (_tdsBd.datos && Date.now() - _tdsBd.t < TDS_BD_CADA_MS) return _tdsBd.datos;
  try {
    const r = await fetch(API_BASE_URL + "/muestras/list", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const filas = await r.json();
    const datos = (Array.isArray(filas) ? filas : [])
      .filter(m => Number(m.Sensor_Id) === TDS_SENSOR_ID && m.Muestra_Valor !== null && isFinite(Number(m.Muestra_Valor)))
      .map(m => ({ t: tdsFechaUTC(m.Muestra_FechaHora), v: Number(m.Muestra_Valor) }))
      .sort((a, b) => b.t - a.t).slice(0, TDS_BD_MAX).reverse();
    _tdsBd = { t: Date.now(), datos: datos };
    return datos;
  } catch (e) {
    console.error("TDS desde la base de datos:", e);
    return _tdsBd.datos;   // si falla, se queda con lo último que se tenía (o null)
  }
}

/* Mismo formato que tsResumen() para una sola medida */
function tdsResumenBD(datos) {
  const s = datos.map(d => d.v);
  return { ult: s.length ? s[s.length - 1] : null, primero: s.length ? s[0] : null, n: s.length, serie: s,
           prom: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null };
}
