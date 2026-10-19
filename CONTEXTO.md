# AgroIA — Contexto vivo del proyecto

| | |
|---|---|
| **Versión del documento** | **v1.2** |
| **Última actualización** | 19 de octubre de 2026 |
| **Proyecto** | AgroIA — Diagnóstico de fertilidad del suelo |
| **Asignatura** | Inteligencia Artificial 26-2 · CUL · Docente: Bryan Josser Fernández Ebrath |

> **Este es el documento maestro y vive en los 4 zips** (frontend, backend, bot de Telegram y asistente Sinric), siempre con **la misma copia**.
> Se actualiza **cada vez que se cambia algo** (ver «Reglas de mantenimiento» y «Registro de cambios» al final).
> **No contiene claves ni contraseñas**: solo los *nombres* de las variables. Nunca pegues aquí un token, una clave de ThingSpeak ni una `DATABASE_URL`.

---

## 1. Qué es AgroIA y cómo encajan las piezas

Un **ESP32** con sensores mide **temperatura del aire, humedad del aire, humedad del suelo y pH**. Los datos van a la **API** (base de datos Neon) y a **ThingSpeak**. Cuatro programas los consumen:

```
                    ┌────────────────────────────┐
   ESP32 (sensores) │  ThingSpeak  canal 3540815 │──► Frontend (tablero, historial, gráficos)
        │  ├───────►│  (público, 4 campos)       │──► Respaldo del bot y del puente Sinric
        │  │        └────────────────────────────┘
        │  └───────► API (FastAPI, Railway) ──► Neon (PostgreSQL)
        │                │  /muestras  /menu/*  /esp32/comando  /vision/*
        │                ├──► Frontend (pestañas YOLO, cámara, alertas)
        │                ├──► Bot de Telegram (datos + foto → YOLO)
        │                └──► Puente Sinric Pro ──► Alexa / app de Sinric
        └◄── GET /esp32/comando (el ESP32 pregunta por órdenes; falta que el firmware lo haga)
```

| # | Componente | Zip | Repositorio | Servicio |
|---|---|---|---|---|
| 1 | **Frontend** (página web) | `AgroIA_frontend_web.zip` | `PAgroIA` | Railway |
| 2 | **Backend** (API + YOLO) | `AgroIA_backend_api.zip` | `AgroIABackend` | Railway (Dockerfile) |
| 3 | **Bot de Telegram** | `AgroIA_bot_telegram.zip` | `Cartera-SNet/AgroIA` | Railway |
| 4 | **Puente Sinric Pro** | `AgroIA_asistente_sinric.zip` | `Cartera-SNet/AGROIA-ASISTENTE` | Railway |

(Los repos 3 y 4 se ven en GitHub bajo `Cartera-SNet`; confirmar la organización de los repos 1 y 2.)

## 2. Direcciones de producción

| Recurso | URL |
|---|---|
| API | https://agroiabackend.up.railway.app |
| Documentación de la API (Swagger) | https://agroiabackend.up.railway.app/docs |
| Página web | https://agroia-suelo.up.railway.app |
| Tablero | https://agroia-suelo.up.railway.app/dashboard.html |
| Canal ThingSpeak (público) | https://thingspeak.mathworks.com/channels/3540815 |
| Channel ID | `3540815` |

**Render ya no se usa.** Toda la API está en Railway. Cualquier variable `API_URL` que aún apunte a `onrender.com` debe cambiarse (el bot y el puente la corrigen solos al arrancar, pero conviene dejarla bien).

### Trabajar desde otro PC (Git)

```powershell
cd carpeta-del-proyecto
git pull origin main
# editar...
git add .
git commit -m "Descripción"
git push origin main
```

Ver también §9 (Git en el PC de Víctor): no hacer `git add .` dentro de Descargas.

## 3. Datos

**ThingSpeak** (canal 3540815): campo 1 = temperatura del aire (°C) · campo 2 = humedad del aire (%) · campo 3 = humedad del suelo (%) · campo 4 = pH. Enviar cada **≥ 20 s** (la cuenta gratis exige ≥ 15 s).

**Write API Key:** se obtiene en Canal → API Keys → **Write API Key** (no la Read). **Pasar solo a José por mensaje privado**, nunca en el grupo.

Prueba en navegador:

```
https://api.thingspeak.com/update?api_key=LA_WRITE_API_KEY&field1=25&field2=60&field3=45&field4=6.5
```

- Número ≥ 1 → OK  
- 0 → esperar ≥ 15 s entre envíos  
- 400 → key incorrecta (casi siempre Read en vez de Write, o espacio al pegar)

Antes de datos reales del ESP32: Channel Settings → **Clear Channel**.

**Neon (PostgreSQL)**, tablas clave: `muestras_suelo` (`Muestra_Id`, `Sensor_Id`, `Parametro_Id`, `Muestra_Valor`, `Muestra_FechaHora`), `parametros_medidos`, `sensores`, `lotes_tierra`, `usuarios` y otras. El ESP32 envía cada lectura con `POST /muestras/create` `{Sensor_Id, Parametro_Id, Muestra_Valor}`. Ya hay datos reales (p. ej. `/menu/promedio-24h` respondió con valores).

**Hora de las muestras:** si no viene fecha, el backend guarda `datetime.now()` **del servidor** (UTC en Railway). Colombia es UTC-5. *Supuesto a confirmar:* que todas las muestras estén en UTC (si hubo pruebas con el backend en un PC local, algunas pueden estar en hora de Colombia).

**Rangos «normales»** (página, bot y puente; salen de `frontend/js/config.js`, `RANGOS`):

| Variable | Normal | Límites de alerta |
|---|---|---|
| Temperatura del aire | 15–30 °C | 10–35 |
| Humedad del aire | 40–80 % | 30–90 |
| Humedad del suelo | 30–60 % | 20–75 |
| pH | 6.0–7.5 | 5.5–8.0 |

**Modelo YOLO** (`backend/models/best.pt`, base YOLOv8n): **2 clases** — `suelo_humedo` y `suelo_seco`.

## 4. Backend (`AgroIABackend`)

- **Tecnología:** FastAPI + SQLAlchemy + Neon. **Despliegue:** `Dockerfile` (`python:3.12-slim` + `libxcb1`, `libgl1`, `libglib2.0-0`, OpenCV headless). `railway.toml` con `builder = "DOCKERFILE"`, arranque `uvicorn main:app --host 0.0.0.0 --port $PORT`, healthcheck `/docs`. Hay `.dockerignore`; `imagenes/` y `uploads/` no van al despliegue; `models/best.pt` sí.
- **Variables de entorno en Railway** (solo nombres):

| Variable | Uso | ¿Crítica? |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL | **Sí** |
| `SECRET_KEY` | JWT | **Sí** |
| `ALGORITHM` | Normalmente `HS256` | **Sí** |
| `GOOGLE_CLIENT_ID` | Login Google | Para Google |
| `GOOGLE_CLIENT_SECRET` | Login Google | Para Google |
| `GOOGLE_REDIRECT_URI` | Callback OAuth del backend (prod: `https://agroiabackend.up.railway.app/auth/google/callback`) | Para Google |
| `FRONTEND_URL` | Redirect tras Google (prod: `https://agroia-suelo.up.railway.app`, sin barra final) | Para Google |
| `INFLUXDB_*` | No se usan en la nube | No |

- **Rutas principales:** `/auth`, `/users`, `/zonas_geograficas`, `/tipos_suelo`, `/lotes`, `/tipos_sensor`, `/sensores`, `/parametros`, `/muestras`, `/alertas`, `/consultas-llm`, `/iot`, `/vision` (`/analizar`, `/camara`, stream), `/menu`, `/esp32`.

### Menú LCD ESP32 (`/menu/*`) — desplegados y probados

| Tecla | Endpoint | Estado |
|---|---|---|
| 2 | `GET /menu/ultimo-registro` | OK |
| 3 | `GET /menu/promedio-24h` | OK (probado con datos reales) |
| 4 | `GET /menu/max-min-hoy` | OK |
| 5 | `GET /menu/promedio-por-hora` | OK |
| 6 | `GET /menu/muestras-por-dia` | OK |
| 7 | `GET /menu/dias-bajo-umbral` | OK |
| A | `GET /menu/desviacion` | OK |
| 1, 8, 9, 0, B | Lógica local en el ESP32 | No usan la API |

Respuesta: `{linea1, linea2, detalle}` (línea1 y línea2 ≤ 16 caracteres, LCD 16×2). Abreviaturas: **T** temperatura · **A** humedad del aire · **S** humedad del suelo · **P** pH.

Ejemplo real:

```
https://agroiabackend.up.railway.app/menu/promedio-24h
→ {"linea1":"Prom 24h","linea2":"A63 S25 T33","detalle":"Humedad del aire: 62.7; ..."}
```

### `/esp32/comando` (Punto 4)

| Método | Uso |
|---|---|
| `GET` | El ESP32 consulta; devuelve `{accion: "" \| "encender_led" \| "apagar_led"}` y limpia |
| `POST` | Body `{accion}` para fijar la orden (chat / Swagger). Vive en memoria del proceso |

### Visión / YOLO

| Método | Endpoint | Nota |
|---|---|---|
| POST | `/vision/analizar` | OK |
| GET | `/vision/camara` | Stream |
| POST | `/vision/fusion`, `/vision/reporte-pdf` | Dependen de Influx → no usar en UI |

### Auth

| Método | Endpoint | Nota |
|---|---|---|
| POST | `/auth/login` | Usuario/clave → JWT |
| GET | `/auth/google` | Inicia OAuth Google |
| GET | `/auth/google/callback` | Intercambia code, crea usuario si falta, redirige a `{FRONTEND_URL}/index.html?token=JWT` |

### InfluxDB

No hay instancia en la nube. `/iot/ultima-medicion`, `/iot/historial`, `/vision/fusion` y `/vision/reporte-pdf` fallan por eso; la interfaz los tiene **ocultos** (decisión del equipo: el profesor no exige Influx).

**Problemas conocidos del backend**

1. **«Hoy» en UTC** en las teclas 4–7 de `/menu` (usan `CURRENT_DATE`/`NOW()` de la base): «hoy» empieza a las 7 p. m. de Colombia. **Parche entregado** (`AgroIA_backend_parche_hora_colombia.zip`). *Estado: por confirmar si ya se aplicó.*
2. **`/menu/ultimo-registro`** (sin verificar en producción): su SQL filtra por la fecha exacta de la última muestra, así que probablemente devuelve una sola variable.
3. **`/chat` no existe** (Punto 4, a cargo de Thair).
4. **`/users/list`** es público y devuelve contraseñas en texto plano — hay que protegerlo.
5. El modelo `historial_consultas_llm` apunta a una tabla `"user"` que no existe (debería ser `usuarios`).
6. Cada petición a `/muestras/list` devuelve **todas** las filas (crece sin parar): por eso el bot y el puente leen solo las primeras.

## 5. Frontend (`PAgroIA`)

- **Qué es:** página estática (HTML/CSS/JS, sin librerías) servida con `serve.py` en Railway (`Procfile`). Se publica con el contenido en la raíz del repo.
- **`js/config.js`:** `API_PRODUCCION = https://agroiabackend.up.railway.app`, **`SESION_OBLIGATORIA = true`** (login obligatorio; tradicional + Google), `THINGSPEAK = {channelId: "3540815", campos: {temp:1, humAire:2, humSuelo:3, ph:4}}`, `RANGOS`, `CLASIFICADOR.url = ""` (vacío: la predicción usa reglas hasta que el modelo del Punto 3 tenga URL).
- **Login Google:** el backend redirige a `{FRONTEND_URL}/index.html?token=JWT`. En Google Cloud hay que registrar el `GOOGLE_REDIRECT_URI` del backend. El callback ya no está hardcodeado a localhost (v1.1).
- **Pantallas:** Inicio (`dashboard.html`), Monitoreo, Historial (tabla, gráfico y CSV), Predicción de fertilidad, Chat con IA, Configuración, y las pestañas del backend: Analizar imagen (YOLO), Cámara en vivo, Alertas.
- **Ocultas (no borradas):** Telemetría InfluxDB, Análisis integrado, Reportes PDF, Control IoT.
- **Móvil:** barra inferior *Inicio · Monitoreo · Análisis (→ `pages/vision.html`) · Historial · Más*. La **cámara en vivo** abre la cámara trasera y tiene un botón **«Cambiar cámara»** (frontal/trasera).
- **Chat web:** llama a `POST /chat`; si no existe, responde con datos de ThingSpeak y lo avisa.
- **Railway:** `railway.json` con `sleepApplication: true` (ver §10). `requirements.txt` está vacío a propósito (sin él Railway no instala Python).
- **Probado (con la API simulada):** 46/46 comprobaciones funcionales y las pruebas de móvil.

## 6. Bot de Telegram v2 (`Cartera-SNet/AgroIA`)

**Archivos:** `bot_agroia.py`, `respuestas.py`, `conocimiento.py`, `datos_agroia.py`, `Procfile` (`web: python bot_agroia.py`), `requirements.txt`, `PREGUNTAS_QUE_SIEMPRE_CONTESTA.txt`.

**Cómo responde** (en este orden):
1. **Reglas + datos reales** (`respuestas.py`): valores actuales, promedios 24 h, máximo/mínimo de hoy, desviación, por hora, por día, días bajo el umbral, riego, alertas, recomendaciones, fertilidad estimada, estado del sensor, proyecto, YOLO, enlaces, ayuda. No dependen de la IA. Entiende varias variables en una pregunta.
2. **Groq** (`openai/gpt-oss-120b`, respaldo `openai/gpt-oss-20b`) para lo demás, con los datos y el conocimiento de AgroIA como contexto.
3. **Si Groq falla o no hay `GROQ_API_KEY`:** responde con un resumen de datos.
4. **Foto del suelo** → `POST /vision/analizar` → «suelo húmedo / seco» + confianza, comparado con el sensor.
5. `SOLO_DATOS_REALES=1` → nunca usa la IA: lo que no es una pregunta conocida se rechaza con un mensaje.

**Comandos:** `/start`, `/ayuda`, `/ejemplos`, `/resumen`, `/datos`.

**Datos** (`datos_agroia.py`): API de Railway como fuente principal (lee solo las primeras filas de `/muestras/list` + los `/menu/*`), **ThingSpeak como respaldo** y para completar variables que falten (p. ej. pH). Caché de 20 s. Si `API_URL` apunta a Render, se corrige sola a Railway.

**Variables (Railway):** `TELEGRAM_TOKEN`, `PUBLIC_URL` (obligatorias) · `GROQ_API_KEY` (recomendada) · opcionales: `API_URL`, `GROQ_MODEL`, `SOLO_DATOS_REALES`, `MUESTRAS_EN_UTC` (`0` si las muestras están en hora de Colombia), `THINGSPEAK_CANAL`, `DATOS_TTL_SEGUNDOS`.

**Qué es «real» y qué no:** los números, fechas y conteos salen de la API/ThingSpeak. Los **rangos y consejos** son los de la página y consejos agronómicos generales. La **fertilidad** es una estimación por reglas (no es el modelo de IA entrenado). Solo las respuestas de **Groq** pueden incluir texto que no salga de un dato.

**Probado (API simulada con los formatos de los `/menu`):** 60/60 preguntas de la lista, 41/41 variantes, 93/93 comprobaciones del bot, 14/14 de la capa de datos.

## 7. Puente Sinric Pro v2 (`Cartera-SNet/AGROIA-ASISTENTE`)

**Archivos:** `sinric_promedio.py`, `datos_agroia.py` (la misma capa de datos del bot), `Procfile` (`web: python sinric_promedio.py`), `requirements.txt` (`requests`, `sinricpro`), `FRASES_DE_VOZ_Y_COMPROBACIONES.txt`.

Cada **60 s** lee los datos **filtrados por variable** y los envía a dispositivos tipo *Temperature Sensor* (temperatura + humedad):

| Dispositivo | Temperatura | Humedad |
|---|---|---|
| **AgroIA Ambiente** | temperatura del aire (última) | humedad del **aire** (última) |
| **AgroIA Promedio** | promedio de 24 h | humedad del aire, promedio de 24 h |
| **AgroIA Suelo** *(opcional)* | la del aire (referencia; no se mide temperatura del suelo) | humedad del **suelo** (última) |

- **Alerta push** (app de Sinric): suelo < 30 % («seco») o > 75 % («encharcado»); una vez por cambio de estado y cada 3 h si sigue igual.
- Si no hay datos, **no envía nada**; si la API cae, usa ThingSpeak para Ambiente/Suelo y **no inventa** un promedio. Si falta `/menu/promedio-24h`, el promedio se calcula con las últimas lecturas.
- **Variables:** `SINRIC_APP_KEY`, `SINRIC_APP_SECRET`, `SINRIC_DEVICE_AMBIENTE`, `SINRIC_DEVICE_PROMEDIO` (obligatorias) · `SINRIC_DEVICE_SUELO`, `API_URL`, `INTERVALO_SEGUNDOS` (opcionales).
- **Voz:** la documentación de Sinric documenta las frases de temperatura y humedad **para Alexa**; marca **Google Home como «Not Supported»** para sensores de temperatura. En el Parcial 1 se usó «Ok Google…».
- **Google:** el Asistente se está reemplazando por **Gemini**. Para que funcione hay que: poner Gemini como asistente del teléfono, activar «Hey Google», ejecutar «Configurar Gemini for Home» en la app Google Home y mantener vinculado Sinric Pro. **Estado:** ya responde por voz, pero la **temperatura se dice en inglés**; el idioma se ajusta en Google (Home → Ajustes del hogar → Gemini for Home → Idioma; Gemini → Idiomas; voz de Android), no en el puente. *Pendiente de resolver.*
- **El pH no se puede consultar por voz** (Sinric no tiene dispositivo de pH): se pregunta en el bot.
- **Probado (Sinric simulado):** 23/23.

## 8. Reparto del equipo y pendientes

| Punto | Pts | Responsable | Estado |
|---|---|---|---|
| 1. Menú LCD con teclado + SQL | 20 | Thair (API) + José (ESP32) | API `/menu/*` en producción y probada con datos reales; José debe apuntar el firmware a Railway y probar teclas 2–7 y A |
| 2. ThingSpeak + web | 25 | **Víctor** | Canal público y página en Railway; falta el envío real del ESP32 |
| 3. Edge Impulse | 25 | Julián + Kenny | Pendiente (poner su URL en `CLASIFICADOR.url`) |
| 4. Chat con IA | 30 | Todos | `/esp32/comando` listo; faltan `/chat` y que el firmware consulte cada X segundos |

### Qué pasarle a cada uno

**José (privado si incluye keys):**

```
URL API: https://agroiabackend.up.railway.app
Menú: /menu/ultimo-registro, /menu/promedio-24h, ...
ESP32: GET /esp32/comando
ThingSpeak Channel ID: 3540815
Write API Key: (solo privado)
Campos: 1=temp, 2=hum aire, 3=hum suelo, 4=pH
Enviar cada ≥ 20 s
```

**Julián / Kenny:**

```
API: https://agroiabackend.up.railway.app
Docs: https://agroiabackend.up.railway.app/docs
Frontend: https://agroia-suelo.up.railway.app
```

**Thair:**

```
Confirmar DATABASE_URL en Railway si algo de menú/SQL falla.
Endpoints /menu y /esp32 ya están en el repo y en producción.
Pendiente: /chat, proteger /users/list.
```

### Pendientes abiertos

- [ ] Aplicar el parche de la hora de Colombia al backend y comprobar que las muestras están en UTC (hora de `/muestras/list` vs hora UTC).
- [ ] José: ThingSpeak responde **400** (petición mal armada: clave mal copiada, `nan`, coma decimal, espacios). Probar la clave en el navegador. Entregarle la Write API Key **solo por privado**.
- [ ] José: firmware con la URL de Railway y consulta periódica a `/esp32/comando`.
- [ ] Thair: `/chat`, proteger `/users/list`, confirmar `DATABASE_URL` en Railway.
- [ ] Víctor: variables Google + `FRONTEND_URL` en Railway del backend; desplegar frontend con `SESION_OBLIGATORIA = true`; opcional *Serverless*; `SOLO_DATOS_REALES` en bot/Sinric si se exige cero invención; opcional crear «AgroIA Suelo» en Sinric.
- [ ] Configurar OAuth en Google Cloud (CLIENT_ID/SECRET + redirect URI del backend) para «Continuar con Google».
- [ ] Idioma en inglés de la temperatura en Google.
- [ ] Edge Impulse; chat de IA completo; video de demostración.

### Checklist «¿seguimos bien?»

- [x] API en Railway responde `/docs`
- [x] `/menu/promedio-24h` devuelve JSON con datos
- [x] Frontend apunta a `agroiabackend.up.railway.app`
- [x] InfluxDB oculto en la UI
- [x] YOLO usable en móvil (botón Análisis)
- [x] Código de login obligatorio + Google con `FRONTEND_URL` (zips v1.1/v1.2; falta desplegar y credenciales Google)
- [ ] José con firmware apuntando a Railway y teclas 2–7 / A OK
- [ ] Write API Key de ThingSpeak entregada a José (privado)
- [ ] Variables Google + `FRONTEND_URL` en Railway y prueba de login
- [ ] Edge Impulse (Julián/Kenny)
- [ ] Chat IA completo + video demo

## 9. Git en el PC de Víctor (lección aprendida)

- En `C:\Users\vyepez` hay un **repositorio de Git escondido** cuyo remoto es `Cartera-SNet/ExtractorTELEGRAM`. Cualquier carpeta dentro de Descargas pertenece a él. **Nunca ejecutes `git add .` ahí.**
- Trabaja siempre en **`C:\proyectos`**: `git clone <repo>`, copia los archivos (`Get-ChildItem -Force -File <origen> | Copy-Item -Destination <clon> -Force`) y sube desde el clon.
- Antes de subir: `git rev-parse --show-toplevel` y `git remote -v` deben mostrar el repositorio correcto, y `git status` debe mostrar rutas cortas (sin `Downloads/...`).
- Si el push dice *rejected*: `git pull --rebase` y luego `git push` (**nunca** `--force`). Después del push, confirmar en Railway que el despliegue diga **Active**.

## 10. Railway: notas

- **Serverless / «sleep application»:** `railway.json` trae `sleepApplication: true`, pero la documentación actual de Railway marca esos archivos de configuración como obsoletos; el método seguro es el panel: servicio → Settings → Deploy → Serverless → Enable, y **redesplegar**. Un servicio dormido tarda en la primera visita (o da un 502 pasajero): abrirlo un minuto antes de presentar.
- Los servicios del bot y de Sinric usan `Procfile` con `web:`; no escuchan HTTP salvo el bot (webhook de Telegram).

### Problemas ya resueltos (recordatorio)

| Problema | Solución |
|---|---|
| Build Nixpacks / `pip not found` | Dockerfile + `railway.toml` con `builder = "DOCKERFILE"` |
| OpenCV `libxcb.so.1` missing | `apt-get` de libxcb1, libgl1, libglib2.0-0 en Dockerfile |
| InfluxDB `localhost:8181` connection refused | Ocultar UI de Influx/fusión/reportes |
| YOLO no accesible en celular | Botón **Análisis** en barra inferior → `pages/vision.html` |
| Endpoints `/menu/*` → 404 | Implementados y desplegados |
| ThingSpeak 400 | Revisar Write API Key (no Read); pasar a José en privado |
| Redirect Google a localhost | `FRONTEND_URL` en env + callback corregido (v1.1) |

## 11. Qué está verificado y qué no

**Verificado por mí con datos simulados:** frontend (46/46 + móvil), bot (93/93, 41/41), capa de datos (14/14), puente Sinric (23/23), parche de hora de Colombia (4 horas simuladas contra PostgreSQL real, 0 fallas con el parche).

**Verificado en producción (parcial):** API `/docs`, `/menu/promedio-24h` con datos reales, frontend apuntando a Railway.

**No verificado contra servicios reales:** login obligatorio en el frontend desplegado, OAuth Google de extremo a extremo, Groq, Telegram, Sinric Pro, Google/Gemini, Alexa y el resto del despliegue en Railway tras los cambios de auth. El primer arranque en producción lo confirma (logs de Railway).

## 12. Seguridad

- **Nunca** subir a GitHub ni compartir en el grupo: `.env`, `TELEGRAM_TOKEN`, `GROQ_API_KEY`, `SINRIC_APP_SECRET`, la Write API Key de ThingSpeak, la `DATABASE_URL` de Neon, `GOOGLE_CLIENT_SECRET`, `SECRET_KEY`.
- Algunas claves aparecieron en documentos y chats anteriores (por ejemplo la contraseña de Neon y el token de InfluxDB): se recomienda **rotarlas**.
- `.gitignore` de cada repo debe incluir `.env`.

## 13. Mensajes listos para copiar

### Para José (API menú)

```
Listo. Endpoints del menú en Railway (ya no Render):

https://agroiabackend.up.railway.app

Prueba: https://agroiabackend.up.railway.app/menu/promedio-24h

Devuelve linea1, linea2 y detalle.
Pon esa URL base en el firmware y prueba teclas 2–7 y A.
```

### Para el grupo (sin secrets)

```
API producción: https://agroiabackend.up.railway.app
Docs: https://agroiabackend.up.railway.app/docs
Web: https://agroia-suelo.up.railway.app
ThingSpeak canal: 3540815 (público)
```

## 14. Reglas de mantenimiento de este documento

1. **Cada cambio** (código, variables, URLs, pendientes, decisiones) actualiza las secciones afectadas **y** agrega una entrada arriba del «Registro de cambios», con fecha y qué zips se tocaron.
2. Se **sube la versión** del documento (v1.0 → v1.1 → v1.2 → …) y se actualiza la fecha de la cabecera.
3. **La misma copia** va en los 4 zips y como `AgroIA_CONTEXTO.md` suelto. Si un zip no cambió, se le agrega de todos modos el documento nuevo.
4. Sin claves ni contraseñas: solo nombres de variables.
5. Lo no verificado se marca como «por confirmar»; se quita la marca solo cuando alguien lo comprueba.
6. **Chat nuevo:** subir este archivo al principio. No hay memoria entre conversaciones; este documento es la memoria.

## 15. Registro de cambios (lo más reciente arriba)

### v1.2 — 19 oct 2026 — Integración del contexto operativo del equipo
- Se fusiona el documento operativo (URLs, menú probado, mensajes para José/grupo, checklist, variables en tabla, qué pasarle a cada uno) con el maestro.
- Se mantiene el estado de login: `SESION_OBLIGATORIA = true`, `FRONTEND_URL`, Google documentado.
- Zips tocados: **frontend, backend** (misma copia de `CONTEXTO.md` + README alineados).

### v1.1 — 19 oct 2026 — Login obligatorio y Google listo para producción
- **Frontend:** `SESION_OBLIGATORIA = true`; se quitó el auto-redirect de `index.html` al dashboard cuando la sesión no era obligatoria.
- **Backend:** `FRONTEND_URL` (env) para el redirect del callback de Google; ya no apunta fijo a `http://localhost:5500`.
- **Documentación:** `.env.example`, README de frontend y backend actualizados (variables Google + FRONTEND_URL).
- Zips tocados: **frontend, backend**.

### v1.0 — 19 oct 2026 — Creación del documento maestro
- Se crea `CONTEXTO.md` con todo el contexto de los 4 componentes. Zips tocados: **frontend, backend, bot, Sinric** (solo se les agrega este documento y una línea en los README).

### Historial previo (resumen, 18–19 oct 2026)
- **Bot de Telegram v2** y **puente Sinric v2** (filtrado por variable, 3 dispositivos, alertas push, capa de datos liviana con respaldo en ThingSpeak, `API_URL` corregida a Railway, interruptor `SOLO_DATOS_REALES`).
- **Parche de la hora de Colombia** para `/menu` teclas 4–7 (entregado; por confirmar si se aplicó).
- **Frontend:** botón «Análisis» (YOLO) en la barra móvil, cámara trasera por defecto y botón de cambio de cámara, pestañas de InfluxDB ocultas, `railway.json` con `sleepApplication`.
- **Backend:** desplegado en Railway con Dockerfile; `/menu/*` y `/esp32/comando` en producción.
- **ThingSpeak:** canal 3540815 público; corrección del diagnóstico del error 400.
- **Git:** lección del repositorio escondido en `C:\Users\vyepez` y flujo seguro en `C:\proyectos`.
