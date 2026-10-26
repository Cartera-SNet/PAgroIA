/* ==========================================================
   AgroIA - Entendimiento de mensajes del chat (sin servidor, sin IA externa)

   Tolera: mayúsculas, tildes, signos, letras repetidas, letras de más o de menos, letras cambiadas,
   vocales comidas ("encdre"), palabras partidas ("encer der") y confusiones de sonido (b/v, s/z/c, h...).
   Cómo lo hace:
     1) normaliza el texto;
     2) corrige cada palabra a la más parecida del vocabulario de AgroIA (por sonido y por "esqueleto" de consonantes);
     3) con el texto ya corregido decide la intención (LED, valores, promedios, riego, alertas...).
   Es código puro (sin DOM): se usa en el navegador (window.ChatNLU) y se prueba en Node.
   ========================================================== */
(function (raiz) {
  "use strict";

  /* ---------- 1. normalización y distancias ---------- */
  function norm(t) {
    return String(t == null ? "" : t).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/(.)\1{2,}/g, "$1$1")                 // "encendeeeer" -> "encendeer"
      .replace(/\s+/g, " ").trim();
  }

  // sonido aproximado del español: la h no suena, b=v, s=z=c(e,i), k=c=qu, g(e,i)=j...
  function fon(w) {
    return w.replace(/h/g, "").replace(/ll/g, "y").replace(/qu/g, "k").replace(/c(?=[ei])/g, "s")
      .replace(/z/g, "s").replace(/c/g, "k").replace(/q/g, "k").replace(/v/g, "b").replace(/w/g, "u").replace(/([^aeiou])\1+/g, "$1");
  }
  // esqueleto de consonantes (las vocales son lo que más se come o se cambia al escribir rápido)
  const esq = f => f.replace(/[aeiou]/g, "").replace(/k/g, "s");

  // Damerau-Levenshtein (cambiar, borrar, insertar o intercambiar letras vecinas = 1)
  function dist(a, b) {
    const n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    const d = [];
    for (let i = 0; i <= n; i++) { d[i] = [i]; }
    for (let j = 1; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[n][m];
  }

  /* parecido entre dos palabras (0..1) */
  function sim1(a, b) {                                                       // parecido solo por letras / sonido
    const fa = fon(a), fb = fon(b);
    return Math.max(1 - dist(a, b) / Math.max(a.length, b.length), 1 - dist(fa, fb) / Math.max(fa.length, fb.length));
  }
  const ESTRICTAS = new Set(["gracias", "adios", "chao", "hola", "buenas", "buenos", "ayuda", "ejemplos", "comandos"]);   // palabras de conversacion: sin trucos
  function sim(a, b) {
    if (a === b) return 1;
    const fa = fon(a), fb = fon(b);
    const sr = 1 - dist(a, b) / Math.max(a.length, b.length);               // letras tal cual (sirve cuando el sonido confunde)
    const s1 = Math.max(sr, 1 - dist(fa, fb) / Math.max(fa.length, fb.length));
    if (ESTRICTAS.has(b)) return s1;
    const ea = esq(fa), eb = esq(fb);
    let s2 = 0;
    // "encdre" ~ "encender": mismas consonantes en el mismo orden, misma primera letra y largo parecido
    if (ea.length >= 4 && eb.length >= 4 && fa[0] === fb[0] && Math.min(fa.length, fb.length) / Math.max(fa.length, fb.length) >= 0.6)
      s2 = (1 - dist(ea, eb) / Math.max(ea.length, eb.length)) * 0.90;
    return Math.max(s1, s2);
  }

  /* ---------- 2. vocabulario ---------- */
  const VOCAB = [
    // variables
    "temperatura", "humedad", "suelo", "tierra", "aire", "ambiente", "ambiental", "relativa", "ph", "acidez", "acido", "acida", "alcalino",
    "calor", "caliente", "frio", "grados", "seco", "seca", "mojado", "humedo", "humeda", "encharcado",
    // cálculos
    "promedio", "media", "maximo", "maxima", "minimo", "minima", "desviacion", "variacion", "estable", "estabilidad",
    "hora", "horas", "dia", "dias", "muestras", "lecturas", "registros", "umbral", "semana",
    // momento
    "actual", "ahora", "ultimo", "ultima", "hoy", "ayer",
    // consultas
    "resumen", "estado", "cultivo", "datos", "reporte", "informe", "alerta", "alertas", "problema", "problemas", "riesgo",
    "regar", "riego", "recomendaciones", "recomendacion", "recomiendas", "aconsejas", "consejo", "consejos", "fertilidad", "fertil", "sembrar",
    "rango", "ideal", "optimo", "adecuado", "normal", "limite",
    "linea", "conectado", "funcionando", "funciona", "sensor", "sensores", "dispositivo",
    "ayuda", "ejemplos", "comandos", "hola", "buenas", "buenos", "gracias", "adios", "chao",
    "agroia", "proyecto", "equipo", "enlaces", "enlace", "link", "pagina", "grafico", "graficos", "thingspeak", "yolo", "modelo", "foto", "imagen", "camara",
    "significa", "explica", "explicame", "sirve", "importa",
    // LED: acciones, estados y objeto
    "enciende", "encender", "encienda", "enciendo", "prende", "prender", "prenda", "activa", "activar", "pon", "poner", "ponga",
    "apaga", "apagar", "apague", "desactiva", "desactivar", "quita", "quitar", "corta", "cortar", "enciendeme", "apagame", "prendeme",
    "encendido", "prendido", "apagado", "activado", "desactivado",
    "led", "luz", "foco", "bombillo", "bombilla", "lampara",
    // otros aparatos (todavía no se controlan)
    "bomba", "ventilador", "motor", "valvula", "rele", "aspersor", "esp32",
    // palabras que usan las reglas
    "esta", "como", "cual", "cuanto", "cuantos", "cuantas", "cuando", "donde", "quien", "quienes", "necesito", "necesita", "debo", "hacer", "hago", "puedo",
    "agua", "peligro", "peligroso", "grave", "analiza", "analizar", "analizo", "analisis", "detecta", "detectar", "lectura", "integrantes", "hicieron", "desarrollo",
    "para", "todo", "puedes", "muchas", "todas", "todos", "toda", "tds", "solidos", "disueltos", "sales", "salinidad", "conductividad", "ppm", "tablero", "dashboard", "estandar", "tomado", "tomadas", "estuvo", "cuantas", "general", "fuera", "mojar", "sembrar", "bueno", "buena"
  ];
  // palabras comunes que NUNCA se corrigen (evita convertir "para" o "cuando" en otra cosa)
  const COMUNES = new Set(("el la los las un una unos unas de del en y o u a al es son soy eres me mi mis tu tus te se lo le les que como cual cuales cuanto cuanta cuantos cuantas " +
    "por para con sin hay esta estan este esto ese eso estoy estas ser si no ya mas muy pero porque cuando donde quien quienes puedes puedo podrias quiero quisiera favor porfa " +
    "dime dame muestrame mostrar decir saber ver mira da hace hacer tiene tengo tienes hacia sobre entre desde hasta cada todo toda todos todas tambien solo otro otra " +
    "esta hoy ayer manana tarde noche dia dias on off turn hey ok vale bien mal bueno buena nada algo poco mucho necesito necesita debo hago puedo").split(" "));
  const ALIAS = { tsd: "tds", tdz: "tds", tdss: "tds", tdd: "tds", ola: "hola", hol: "hola", hoa: "hola", hla: "hola", hoal: "hola", hlaa: "hola", sec: "seco", sca: "seca", tem: "temperatura", hum: "humedad", lde: "led", ld: "led", ledd: "led", leed: "led", lled: "led", lede: "led", led: "led", lez: "luz", lus: "luz", ph: "ph", pj: "ph", pg: "ph", pjh: "ph", esp: "esp32", on: "on", off: "off" };
  const VOCAB_SET = new Set(VOCAB);
  const GRUPOS = [
    ["enciende", "encender", "encienda", "enciendo", "prende", "prender", "prenda", "activa", "activar", "pon", "poner", "ponga", "enciendeme", "prendeme"],
    ["apaga", "apagar", "apague", "apagame", "desactiva", "desactivar", "quita", "quitar", "corta", "cortar"],
    ["encendido", "prendido", "activado"], ["apagado", "desactivado"], ["led", "luz", "foco", "bombillo", "bombilla", "lampara"],
    ["humedo", "humeda"], ["seco", "seca"], ["maximo", "maxima"], ["minimo", "minima"], ["hora", "horas"], ["dia", "dias"], ["alerta", "alertas"], ["problema", "problemas"],
    ["recomendaciones", "recomendacion", "recomiendas", "aconsejas", "consejo", "consejos"], ["cuanto", "cuantos", "cuantas"], ["necesito", "necesita"], ["grafico", "graficos"], ["link", "enlace", "enlaces"], ["fertilidad", "fertil"],
    ["acido", "acida", "acidez"], ["ambiente", "ambiental"], ["buenas", "buenos"], ["sensor", "sensores"], ["ultimo", "ultima"], ["funciona", "funcionando"],
    ["explica", "explicame"], ["estable", "estabilidad"], ["muestras", "lecturas", "registros"], ["todo", "todas", "todos", "toda"]
  ];
  const GRUPO = {}; GRUPOS.forEach(g => g.forEach(w => { GRUPO[w] = g[0]; }));
  const grupoDe = w => GRUPO[w] || w;

  const conocida = w => VOCAB_SET.has(w) || COMUNES.has(w) || /^\d/.test(w);

  // si dos palabras de distinto grupo quedan casi empatadas, gana la mas usada en AgroIA ("aier": aire o ayer -> aire)
  const PREF = ["aire", "hora", "suelo", "dia", "temperatura", "humedad", "seco", "regar", "led", "ph", "estado", "resumen"];

  // palabra del vocabulario mas parecida a w (con margen sobre la mejor de OTRO grupo)
  function mejor(w) {
    const sc = [];
    for (const v of VOCAB) {
      if (Math.abs(v.length - w.length) > 3) continue;
      const x = sim(w, v);
      if (ESTRICTAS.has(v) && x < 0.74) continue;
      sc.push([v, x, sim1(w, v)]);
    }
    if (!sc.length) return null;
    sc.sort((p, q) => q[1] - p[1]);
    let b = sc[0], rival = sc.find(([v]) => grupoDe(v) !== grupoDe(b[0]));
    if (rival && b[1] - rival[1] < 0.05 && rival[2] > b[2] + 0.05) {            // "pronedio": prende (consonantes) vs promedio (letras) -> promedio
      const mejorLetras = rival; rival = b; b = mejorLetras;
      return { palabra: b[0], s: b[1], margen: 0.05 };
    }
    let res = { palabra: b[0], s: b[1], margen: rival ? b[1] - rival[1] : b[1] };
    if (rival && res.margen < 0.03) {
      const emp = sc.filter(([v, x]) => b[1] - x < 0.03 && PREF.includes(v)).sort((p, q) => PREF.indexOf(p[0]) - PREF.indexOf(q[0]));
      if (emp.length && (emp.length === 1 || grupoDe(emp[0][0]) !== grupoDe(emp[1][0]))) res = { palabra: emp[0][0], s: emp[0][1], margen: 0.05 };
    }
    return res;
  }
  function umbral(len) { return len <= 3 ? 2 : len === 4 ? 0.74 : len <= 6 ? 0.70 : 0.68; }

  // parecido solo por sonido (sin el truco del esqueleto): se usa para decidir si unir palabras partidas
  const simFon = (a, b) => { const fa = fon(a), fb = fon(b); return 1 - dist(fa, fb) / Math.max(fa.length, fb.length); };

  // "por haora" / "cada hroa" quieren decir "hora", no "ahora"
  const enContexto = (out, palabra) => (palabra === "ahora" || palabra === "hola") && out.length && (out[out.length - 1] === "por" || out[out.length - 1] === "cada") ? "hora" : palabra;

  /* corrige el texto ya normalizado */
  function corregir(n) {
    const tk = n ? n.split(" ") : [], out = [];
    for (let i = 0; i < tk.length; i++) {
      const w = tk[i];
      // a) "le d" -> "led", "p h" -> "ph": la union exacta forma una palabra del vocabulario y ninguna parte lo es
      let hecho = false;
      for (let k = 3; k >= 2 && !hecho; k--) {
        if (i + k > tk.length) continue;
        const partes = tk.slice(i, i + k), unida = partes.join("");
        if (unida.length >= 2 && VOCAB_SET.has(unida) && partes.every(p => !VOCAB_SET.has(p) && p.length <= 4)) { out.push(unida); i += k - 1; hecho = true; }
      }
      if (hecho) continue;
      if (conocida(w)) { out.push(w); continue; }
      if (ALIAS[w]) { out.push(enContexto(out, ALIAS[w])); continue; }
      if (w.length === 3 && !COMUNES.has(w)) {
        const c3 = VOCAB.filter(v => v.length === 4 && dist(w, v) === 1 && (v[0] === w[0] || v.includes(w)));
        if (c3.length && c3.every(v => grupoDe(v) === grupoDe(c3[0]))) { out.push(c3[0]); continue; }
      }
      const m = w.length > 3 ? mejor(w) : null;
      // b) correccion segura de una sola palabra ("actiba" -> "activa")
      if (m && m.s >= 0.85 && m.margen >= 0.03) { out.push(enContexto(out, m.palabra)); continue; }
      // c) palabra partida: "encer der" -> "encender" (solo si la union suena casi igual y ninguna parte es del vocabulario)
      for (let k = 3; k >= 2 && !hecho; k--) {
        if (i + k > tk.length) continue;
        const partes = tk.slice(i, i + k);
        if (partes.some(p => VOCAB_SET.has(p) || (COMUNES.has(p) && p.length > 2))) continue;
        const mm = mejor(partes.join(""));
        if (mm && mm.palabra.length >= 6 && simFon(partes.join(""), mm.palabra) >= 0.80) { out.push(mm.palabra); i += k - 1; hecho = true; }
      }
      if (hecho) continue;
      // d) correccion normal de una palabra
      if (w.length <= 3) { out.push(w); continue; }
      out.push(m && m.s >= umbral(w.length) && m.margen >= 0.03 ? enContexto(out, m.palabra) : w);
    }
    return out.join(" ");
  }

  /* ---------- 3. variables que nombra la pregunta ---------- */
  function variables(n) {
    const out = new Set();
    if (/\b(temperatura|calor|caliente|frio|grados)\b|\btemp\b/.test(n)) out.add("temp");
    const aire = /\b(aire|ambiente|ambiental|relativa)\b/.test(n);
    const suelo = /\b(suelo|suelos|tierra|seco|seca|secos|mojado|humedo|humeda|encharcado)\b/.test(n);
    if (/\bhumedad\b/.test(n)) { if (aire) out.add("humAire"); if (suelo || !aire) out.add("humSuelo"); }
    else {
      if (aire && !out.has("temp")) out.add("humAire");
      if (/\b(seco|seca|secos|mojado|humedo|humeda|encharcado)\b/.test(n)) out.add("humSuelo");
    }
    if (/\b(tds|solidos|disueltos|salinidad|conductividad|sales|ppm)\b/.test(n)) out.add("tds");
    if (/\bph\b|acidez|acido|acida|alcalin/.test(n)) out.add("ph");               // el pH ya no se mide: el chat lo explica
    return ["temp", "humAire", "humSuelo", "tds", "ph"].filter(c => out.has(c));
  }

  /* ---------- 4. intención ---------- */
  const OBJ_LED = /\b(led|luz|foco|bombillo|bombilla|lampara)\b/;
  const OTROS = /\b(bomba|ventilador|motor|valvula|rele|aspersor|riego|regador)\b/;
  const V_ON = /\b(enciende|encender|encienda|enciendo|enciendeme|prende|prender|prenda|prendeme|activa|activar|pon|poner|ponga)\b|\bon\b/;
  const V_OFF = /\b(apaga|apagar|apague|apagame|desactiva|desactivar|quita|quitar|corta|cortar)\b|\boff\b/;
  const PARTICIPIO = /\b(encendido|prendido|apagado|activado|desactivado)\b/;

  function interpretar(texto) {
    const n0 = norm(texto), n = corregir(n0).replace(/\bhumeda (del|de la|de)\b/g, "humedad $1");   // "humeda del aire" = "humedad del aire"
    const r = { id: "desconocido", n: n, original: n0, vars: [], accion: null };
    if (!n) { r.id = "vacio"; return r; }
    const t = re => re.test(n);
    const vars = variables(n); r.vars = vars;

    /* --- LED (lo que mueve un aparato: se pide evidencia clara) --- */
    const obj = t(OBJ_LED), on = t(V_ON), off = t(V_OFF), part = t(PARTICIPIO), otros = t(OTROS);
    const negado = /\bno\b(?: \w+){0,2} (?:enciende|encender|encienda|enciendo|prende|prender|prenda|activa|activar|pon|poner|ponga|apaga|apagar|apague|desactiva|desactivar|quita|quitar|corta|cortar)\b/.test(n);
    if (obj || ((on || off) && !vars.length && !/\b(promedio|resumen|estado|datos)\b/.test(n))) {
      if (obj && part && !on && !off) { r.id = "led_estado"; return r; }
      if (obj && /^(como|de que forma)\b/.test(n) && (on || off)) { r.id = "led_ayuda"; return r; }
      if (obj && (negado || (on && off))) { r.id = "led"; r.accion = null; r.ambiguo = true; return r; }
      if (obj && (on || off)) { r.id = "led"; r.accion = on ? "encender_led" : "apagar_led"; return r; }
      if (obj) { r.id = "led"; r.accion = null; return r; }
      if (otros && (on || off)) { r.id = "otro_aparato"; return r; }
      if (on || off) { r.id = "led_sin_objeto"; r.accion = on && !off ? "encender_led" : off && !on ? "apagar_led" : null; return r; }
    }

    /* --- conversación --- */
    if (/^(hola|buenas|buenos|hey|saludos|que tal)( \w+){0,3}$/.test(n)) { r.id = "saludo"; return r; }
    if (/^(gracias|muchas gracias|ok gracias|listo gracias|genial gracias)\b|\bmuchas gracias\b/.test(n)) { r.id = "gracias"; return r; }
    if (/^(adios|chao|hasta luego|nos vemos)\b/.test(n)) { r.id = "adios"; return r; }
    if (!vars.length && /\b(ayuda|ejemplos|comandos|que puedes|que sabes|que haces|como te uso|menu)\b/.test(n)) { r.id = "ayuda"; return r; }
    if (vars.length && /^(y )?(que es|que significa|que mide|explica|explicame|dime que es)\b|\bpara que sirve\b|\bpor que importa\b/.test(n)) { r.id = "definicion"; return r; }
    if (!vars.length && /\b(link|enlace|enlaces|pagina|dashboard|tablero|thingspeak|grafico|graficos)\b/.test(n)) { r.id = "enlaces"; return r; }
    if (!vars.length && /\b(yolo|modelo|foto|imagen|camara|vision|analiza|analizar|analizo|analisis|detecta|detectar)\b/.test(n)) { r.id = "yolo"; return r; }
    if (/\b(en linea|conectado|funcionando|funciona|esta vivo|ultima vez|hace cuanto|actualizado)\b|\bcuando (fue|se midio|llego|se actualizo)\b/.test(n) &&
        /\b(sensor|sensores|dispositivo|esp32|datos|lectura|lecturas|linea|conectado|vivo|actualizado|cuando|hace cuanto|ultima vez)\b/.test(n)) { r.id = "en_linea"; return r; }
    if (!vars.length && /\b(agroia|proyecto|equipo|integrantes|quienes|quien (hizo|creo|desarrollo)|como funciona|lcd|teclado)\b/.test(n) &&
        !/\b(resumen|estado|datos|lecturas|promedio|maximo|minimo)\b/.test(n)) { r.id = "proyecto"; return r; }

    /* --- cálculos --- */
    if (/\bpor hora\b|\bcada hora\b|\bhora por hora\b/.test(n)) { r.id = "por_hora"; return r; }
    if (/\bpor dia\b|\bcada dia\b|\bcuant(as|os) (muestras|lecturas|mediciones|registros|datos)\b|\bnumero de (muestras|lecturas)\b/.test(n)) { r.id = "por_dia"; return r; }
    if (/\bumbral\b|\bdias (secos|con suelo seco|bajo)\b|\bcuant[oa]s? dias\b|\bdias bajo\b|\bdias en que\b/.test(n)) { r.id = "dias_bajo"; return r; }
    if (/\b(desviacion|variacion|estable|estabilidad|fluctua|varia)\b/.test(n)) { r.id = "desviacion"; return r; }
    if (/\b(maximo|maxima|minimo|minima|pico|max|min)\b|\bmas (alta|alto|baja|bajo)\b/.test(n)) { r.id = "maxmin"; return r; }
    if (/\b(promedio|media)\b/.test(n)) { r.id = "promedio"; return r; }

    /* --- consejos y diagnóstico --- */
    if (/\b(regar|riego|riegue|regarlo)\b|\bnecesit[oa] agua\b|\bfalta agua\b|\becharle agua\b|\bhay que mojar\b/.test(n)) { r.id = "riego"; return r; }
    if (/\b(recomiendas|recomendaciones|recomendacion|recomienda|aconsejas|consejo|consejos|sugerencia|sugerencias)\b|\bque hago\b|\bque debo\b|\bque (hacer|puedo hacer)\b|\bcomo mejoro\b/.test(n)) { r.id = "recomendacion"; return r; }
    if (/\b(alerta|alertas|problema|problemas|peligro|peligroso|grave|riesgo|anormal)\b|\bfuera de rango\b|\bpreocup/.test(n)) { r.id = "alertas"; return r; }
    if (/\b(fertilidad|fertil|apto|apta)\b|\bsirve para sembrar\b|\bbuena tierra\b|\bbuen suelo\b/.test(n)) { r.id = "fertilidad"; return r; }
    if (vars.length && /\b(rango|ideal|optimo|adecuado|normal|limite)\b|\bdeberia\b|\bcuanto debe\b/.test(n)) { r.id = "rango"; return r; }
    if (!vars.length && (/\b(resumen|estado|reporte|informe|medidas|mediciones|lecturas|valores|sensores)\b|\bcomo (esta|va|anda)\b|\bultimo registro\b|\bultima lectura\b/.test(n) ||
        (n.split(" ").length <= 3 && /\b(datos|todo|cultivo|suelo|tierra)\b/.test(n)))) { r.id = "resumen"; return r; }
    if (vars.length) {
      if (/\d/.test(n)) { r.id = "rango"; r.hipotetico = true; return r; }   // "es bueno un tds de 600": se contesta con el rango ideal
      r.id = vars.length === 1 ? "valor" : "valores"; return r;
    }
    return r;
  }

  /* ---------- 5. "¿quisiste decir...?" para lo que no se entiende ---------- */
  const EJEMPLOS = [
    "¿Cuál es la temperatura?", "¿Cómo está la humedad del suelo?", "¿Cuál es la humedad del aire?", "¿Cuál es el TDS?", "Dame un resumen",
    "¿Necesito regar?", "¿Hay alertas?", "¿Qué recomiendas?", "Promedio de las últimas 24 horas", "Máximo y mínimo de hoy", "Desviación estándar",
    "Promedio por hora de la humedad del suelo", "¿Cuántos días estuvo seco el suelo?", "¿Cómo está la fertilidad?", "¿El sensor está en línea?",
    "Enciende el LED", "Apaga el LED", "¿Qué es el TDS?", "Dame los enlaces", "¿Qué es AgroIA?"
  ];
  function sugerir(texto, max) {
    const tk = corregir(norm(texto)).split(" ").filter(w => w.length > 2 && !COMUNES.has(w));
    if (!tk.length) return [];
    const pts = EJEMPLOS.map(e => {
      const et = norm(e).split(" ").filter(w => w.length > 2 && !COMUNES.has(w));
      let s = 0; tk.forEach(w => { s += Math.max(0, ...et.map(x => sim(w, x))); });
      return { e: e, p: s / Math.max(tk.length, 1) };
    }).filter(x => x.p >= 0.55).sort((a, b) => b.p - a.p);
    return pts.slice(0, max || 3).map(x => x.e);
  }

  const API = { norm, fon, esq, dist, sim, corregir, variables, interpretar, sugerir, VOCAB, EJEMPLOS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.ChatNLU = API;
})(typeof window !== "undefined" ? window : globalThis);
