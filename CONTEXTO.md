# AgroIA — Contexto vivo del proyecto

| | |
|---|---|
| **Versión del documento** | **v1.0** |
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
| Página web | https://agroia-suelo.up.railway.app (tablero: `/dashboard.html`) |
| Canal ThingSpeak (público) | https://thingspeak.mathworks.com/channels/3540815 |
| Channel ID | `3540815` |

**Render ya no se usa.** Toda la API está en Railway. Cualquier variable `API_URL` que aún apunte a `onrender.com` debe cambiarse (el bot y el puente la corrigen solos al arrancar, pero conviene dejarla bien).

## 3. Datos

**ThingSpeak** (canal 3540815): campo 1 = temperatura del aire (°C) · campo 2 = humedad del aire (%) · campo 3 = humedad del suelo (%) · campo 4 = pH. Enviar cada **≥ 20 s** (la cuenta gratis exige ≥ 15 s). La *Write API Key* se entrega **solo por privado** a José, nunca al grupo.

**Neon (PostgreSQL)**, tablas clave: `muestras_suelo` (`Muestra_Id`, `Sensor_Id`, `Parametro_Id`, `Muestra_Valor`, `Muestra_FechaHora`), `parametros_medidos`, `sensores`, `lotes_tierra`, `usuarios` y otras. El ESP32 envía cada lectura con `POST /muestras/create` `{Sensor_Id, Parametro_Id, Muestra_Valor}`.

**Hora de las muestras:** si no viene fecha, el backend guarda `datetime.now()` **del servidor** (UTC en Railway). Colombia es UTC-5. *Supuesto a confirmar:* que todas las muestras estén en UTC (si hubo pruebas con el backend en un PC local, algunas pueden estar en hora de Colombia).

**Rangos «normales»** (los usan la página, el bot y el puente; salen de `frontend/js/config.js`, `RANGOS`):

| Variable | Normal | Límites de alerta |
|---|---|---|
| Temperatura del aire | 15–30 °C | 10–35 |
| Humedad del aire | 40–80 % | 30–90 |
| Humedad del suelo | 30–60 % | 20–75 |
| pH | 6.0–7.5 | 5.5–8.0 |

**Modelo YOLO** (`backend/models/best.pt`, base YOLOv8n): **2 clases** — `suelo_humedo` y `suelo_seco`.

## 4. Backend (`AgroIABackend`)

- **Tecnología:** FastAPI + SQLAlchemy + Neon. **Despliegue:** `Dockerfile` (`python:3.12-slim` + `libxcb1`, `libgl1`, `libglib2.0-0`, OpenCV headless). `railway.toml` con `builder = "DOCKERFILE"`, arranque `uvicorn main:app --host 0.0.0.0 --port $PORT`, healthcheck `/docs`. Hay `.dockerignore`; `imagenes/` y `uploads/` no van al despliegue; `models/best.pt` sí.
- **Variables de entorno en Railway** (solo nombres): `DATABASE_URL` (crítica), `SECRET_KEY`, `ALGORITHM` (HS256), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (opcionales), `INFLUXDB_URL` / `INFLUXDB_DATABASE` / `INFLUXDB_TOKEN` (**no se usan en la nube**).
- **Rutas principales:** `/auth`, `/users`, `/zonas_geograficas`, `/tipos_suelo`, `/lotes`, `/tipos_sensor`, `/sensores`, `/parametros`, `/muestras`, `/alertas`, `/consultas-llm`, `/iot`, `/vision` (`/analizar`, `/camara`, stream), `/menu`, `/esp32`.
- **`/menu/*` (menú LCD del ESP32, teclas 2–7 y A):** `ultimo-registro`, `promedio-24h`, `max-min-hoy`, `promedio-por-hora`, `muestras-por-dia`, `dias-bajo-umbral`, `desviacion`. Respuesta: `{linea1, linea2, detalle}` (línea1 y línea2 ≤ 16 caracteres, para la LCD 16×2). Abreviaturas: **T** temperatura · **A** humedad del aire · **S** humedad del suelo · **P** pH. Las teclas 1, 8, 9, 0 y B son locales del ESP32.
- **`/esp32/comando`:** `GET` (el ESP32 consulta; devuelve `{accion: "" | "encender_led" | "apagar_led"}` y limpia) y `POST` (`{accion}` para fijar la orden). Vive en la memoria del proceso.
- **InfluxDB:** no hay instancia en la nube. `/iot/ultima-medicion`, `/iot/historial`, `/vision/fusion` y `/vision/reporte-pdf` fallan por eso; la interfaz los tiene **ocultos** (decisión del equipo: el profesor no exige Influx).

**Problemas conocidos del backend**
1. **«Hoy» en UTC** en las teclas 4–7 de `/menu` (usan `CURRENT_DATE`/`NOW()` de la base): «hoy» empieza a las 7 p. m. de Colombia. **Parche entregado** (`AgroIA_backend_parche_hora_colombia.zip`, 7 líneas de SQL en `app/routes/menu_routes.py`, probado contra PostgreSQL real). *Estado: por confirmar si ya se aplicó.*
2. **`/menu/ultimo-registro`** (sin verificar en producción): su SQL filtra por la fecha exacta de la última muestra, así que probablemente devuelve una sola variable.
3. **`/chat` no existe** (Punto 4, a cargo de Thair).
4. **`/users/list`** es público y devuelve contraseñas en texto plano — hay que protegerlo.
5. El modelo `historial_consultas_llm` apunta a una tabla `"user"` que no existe (debería ser `usuarios`).
6. Cada petición a `/muestras/list` devuelve **todas** las filas (crece sin parar): por eso el bot y el puente leen solo las primeras.

## 5. Frontend (`PAgroIA`)

- **Qué es:** página estática (HTML/CSS/JS, sin librerías) servida con `serve.py` en Railway (`Procfile`). Se publica con el contenido en la raíz del repo.
- **`js/config.js`:** `API_PRODUCCION = https://agroiabackend.up.railway.app`, `SESION_OBLIGATORIA = false` (abre sin iniciar sesión), `THINGSPEAK = {channelId: "3540815", campos: {temp:1, humAire:2, humSuelo:3, ph:4}}`, `RANGOS`, `CLASIFICADOR.url = ""` (vacío: la predicción usa reglas hasta que el modelo del Punto 3 tenga URL).
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
| 1. Menú LCD con teclado + SQL | 20 | Thair (API) + José (ESP32) | API `/menu/*` en producción; José debe apuntar el firmware a Railway y probar teclas 2–7 y A |
| 2. ThingSpeak + web | 25 | **Víctor** | Canal público y página en Railway; falta el envío real del ESP32 |
| 3. Edge Impulse | 25 | Julián + Kenny | Pendiente (poner su URL en `CLASIFICADOR.url`) |
| 4. Chat con IA | 30 | Todos | `/esp32/comando` listo; faltan `/chat` y que el firmware consulte cada X segundos |

**Pendientes abiertos**
- [ ] Aplicar el parche de la hora de Colombia al backend y comprobar que las muestras están en UTC (hora de `/muestras/list` vs hora UTC).
- [ ] José: ThingSpeak responde **400** (petición mal armada: clave mal copiada, `nan`, coma decimal, espacios). Probar la clave en el navegador. Entregarle la Write API Key **solo por privado**.
- [ ] José: firmware con la URL de Railway y consulta periódica a `/esp32/comando`.
- [ ] Thair: `/chat`, proteger `/users/list`, confirmar `DATABASE_URL` en Railway.
- [ ] Víctor: variable `API_URL` en los servicios del bot y de Sinric; activar *Serverless* en el panel de Railway si se quiere; `SOLO_DATOS_REALES` si se exige cero invención; opcional crear «AgroIA Suelo» en Sinric.
- [ ] Idioma en inglés de la temperatura en Google.
- [ ] Edge Impulse; chat de IA completo; video de demostración.

## 9. Git en el PC de Víctor (lección aprendida)

- En `C:\Users\vyepez` hay un **repositorio de Git escondido** cuyo remoto es `Cartera-SNet/ExtractorTELEGRAM`. Cualquier carpeta dentro de Descargas pertenece a él. **Nunca ejecutes `git add .` ahí.**
- Trabaja siempre en **`C:\proyectos`**: `git clone <repo>`, copia los archivos (`Get-ChildItem -Force -File <origen> | Copy-Item -Destination <clon> -Force`) y sube desde el clon.
- Antes de subir: `git rev-parse --show-toplevel` y `git remote -v` deben mostrar el repositorio correcto, y `git status` debe mostrar rutas cortas (sin `Downloads/...`).
- Si el push dice *rejected*: `git pull --rebase` y luego `git push` (**nunca** `--force`). Después del push, confirmar en Railway que el despliegue diga **Active**.

## 10. Railway: notas

- **Serverless / «sleep application»:** `railway.json` trae `sleepApplication: true`, pero la documentación actual de Railway marca esos archivos de configuración como obsoletos; el método seguro es el panel: servicio → Settings → Deploy → Serverless → Enable, y **redesplegar**. Un servicio dormido tarda en la primera visita (o da un 502 pasajero): abrirlo un minuto antes de presentar.
- Los servicios del bot y de Sinric usan `Procfile` con `web:`; no escuchan HTTP salvo el bot (webhook de Telegram).

## 11. Qué está verificado y qué no

**Verificado por mí con datos simulados:** frontend (46/46 + móvil), bot (93/93, 41/41), capa de datos (14/14), puente Sinric (23/23), parche de hora de Colombia (4 horas simuladas contra PostgreSQL real, 0 fallas con el parche).

**No verificado contra servicios reales:** la API y la base Neon de producción, Groq, Telegram, Sinric Pro, Google/Gemini, Alexa y el despliegue en Railway. El primer arranque en producción lo confirma (logs de Railway). Los zips del frontend y del backend son la **copia que Víctor subió** en su momento; si el repositorio cambió después, copiar **solo** `CONTEXTO.md`.

## 12. Seguridad

- **Nunca** subir a GitHub ni compartir en el grupo: `.env`, `TELEGRAM_TOKEN`, `GROQ_API_KEY`, `SINRIC_APP_SECRET`, la Write API Key de ThingSpeak, la `DATABASE_URL` de Neon.
- Algunas claves aparecieron en documentos y chats anteriores (por ejemplo la contraseña de Neon y el token de InfluxDB): se recomienda **rotarlas**.
- `.gitignore` de cada repo debe incluir `.env`.

## 13. Reglas de mantenimiento de este documento

1. **Cada cambio** (código, variables, URLs, pendientes, decisiones) actualiza las secciones afectadas **y** agrega una entrada arriba del «Registro de cambios», con fecha y qué zips se tocaron.
2. Se **sube la versión** del documento (v1.0 → v1.1 → …) y se actualiza la fecha de la cabecera.
3. **La misma copia** va en los 4 zips y como `AgroIA_CONTEXTO.md` suelto. Si un zip no cambió, se le agrega de todos modos el documento nuevo.
4. Sin claves ni contraseñas: solo nombres de variables.
5. Lo no verificado se marca como «por confirmar»; se quita la marca solo cuando alguien lo comprueba.
6. **Chat nuevo:** subir este archivo al principio. No hay memoria entre conversaciones; este documento es la memoria.

## 14. Registro de cambios (lo más reciente arriba)

### v1.0 — 19 oct 2026 — Creación del documento maestro
- Se crea `CONTEXTO.md` con todo el contexto de los 4 componentes. Zips tocados: **frontend, backend, bot, Sinric** (solo se les agrega este documento y una línea en los README).

### Historial previo (resumen, 18–19 oct 2026)
- **Bot de Telegram v2** y **puente Sinric v2** (filtrado por variable, 3 dispositivos, alertas push, capa de datos liviana con respaldo en ThingSpeak, `API_URL` corregida a Railway, interruptor `SOLO_DATOS_REALES`).
- **Parche de la hora de Colombia** para `/menu` teclas 4–7 (entregado; por confirmar si se aplicó).
- **Frontend:** botón «Análisis» (YOLO) en la barra móvil, cámara trasera por defecto y botón de cambio de cámara, pestañas de InfluxDB ocultas, `railway.json` con `sleepApplication`.
- **Backend:** desplegado en Railway con Dockerfile; `/menu/*` y `/esp32/comando` en producción.
- **ThingSpeak:** canal 3540815 público; corrección del diagnóstico del error 400.
- **Git:** lección del repositorio escondido en `C:\Users\vyepez` y flujo seguro en `C:\proyectos`.
