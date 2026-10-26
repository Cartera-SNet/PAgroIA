// Configuración central de la página.
const VERSION_PAGINA = "10.2";
// Dirección de la API:
//  - abriendo la página en este computador (localhost / archivo local) -> backend local
//  - publicada (Railway u otro hosting) -> API desplegada.
const API_PRODUCCION = "https://agroiabackend.up.railway.app";
const ES_LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const API_BASE_URL = ES_LOCAL ? "http://localhost:8000" : API_PRODUCCION;

// true  = hay que iniciar sesión para ver las páginas (login del backend).
// false = se puede abrir dashboard.html directo, sin backend (lo usa el Punto 2 publicado en Railway).
const SESION_OBLIGATORIA = true;
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
// Campos del login tradicional. VERIFICAR contra http://localhost:8000/docs
const LOGIN_CAMPOS = { usuario: "username", clave: "password", tokenRespuesta: "access_token" };
// Rangos por variable: [ok_min, ok_max, aceptable_min, aceptable_max]. Ajustar al cultivo.
const RANGOS = {
  humedad_suelo: [30, 60, 20, 75], temp_aire: [15, 30, 10, 35],
  humedad_aire: [40, 80, 30, 90], ph: [6, 7.5, 5.5, 8], tds: [0, 1000, 0, 1500]
};

// ============================================================
// TABLERO DE INICIO (dashboard.html): ThingSpeak
// ============================================================
const THINGSPEAK = {
  // Número del canal (no es secreto; el canal debe estar compartido como público).
  // NO escribir aquí la Write API Key.
  channelId: "3540815",

  // Qué campo del canal es cada medición
  campos: { temp: 1, humAire: 2, humSuelo: 3, tds: 4 },      // el campo 4 es TDS (ppm); el pH ya no se mide
  // URLs completas de los gráficos (botón "insertar/embed" de cada gráfico en ThingSpeak).
  // Si se dejan vacías, la página arma la dirección oficial del gráfico con los colores del diseño.
  graficos: { temp: "", humaire: "", humsuelo: "", tds: "" },
  apiBase: "https://api.thingspeak.com",
  resultados: 60,          // lecturas recientes que se usan para las tarjetas
  refrescoSegundos: 15,    // cada cuánto se vuelven a pedir los datos
  minutosEnLinea: 5        // si la última lectura es más vieja, se marca "sin datos recientes"
};

// Chat con IA (Punto 4): POST { texto } -> { respuesta }. Hasta que el backend lo tenga, avisa que no está disponible.
const CHAT_ENDPOINT = API_BASE_URL + "/chat";

// ============================================================
// CLASIFICADOR DE FERTILIDAD (Punto 3: Edge Impulse)
// ============================================================
// Mientras "url" esté vacío, la pantalla "Predicción de fertilidad" usa una estimación por rangos
// (reglas del cultivo, RANGOS de este archivo) y lo dice claramente en pantalla.
// Cuando el equipo tenga el modelo publicado como servicio, poner aquí su dirección:
//   POST { temperatura, humedad_aire, humedad_suelo, tds }
//   -> { clase: "Alta fertilidad", confianza: 0.87, recomendaciones: ["...", "..."] }
const CLASIFICADOR = { url: "" };