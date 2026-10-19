# AgroIA Web

Tablero de AgroIA (diagnóstico de fertilidad del suelo). Es una página estática que se sirve con `serve.py`.

- **Datos:** canal público de ThingSpeak **3540815**. Se cambia en `js/config.js` (`channelId`) o desde la pantalla *Configuración*.
- **Despliegue en Railway:** `Procfile` arranca `serve.py`. `requirements.txt` está vacío a propósito: sin él, Railway no instala Python.
- **Modo dormido (Serverless):** `railway.json` trae `"sleepApplication": true`. Railway lo duerme tras unos minutos sin tráfico y lo despierta con la primera visita (esa primera carga puede tardar o dar un 502 pasajero; recargar). Si Railway ignora el archivo, se activa en el panel: *Service → Settings → Deploy → Serverless*, y luego *Deploy latest commit*.
- **Sin claves:** este repositorio no contiene ningún archivo `.env` ni secretos.
- **Sesión:** `SESION_OBLIGATORIA` viene en `false` en `js/config.js`. Las pestañas que usan el backend (imagen, cámara, alertas) dependen de la API indicada en `API_PRODUCCION`.

> **Contexto completo y siempre actualizado del programa (los 4 componentes): ver `CONTEXTO.md`.**
