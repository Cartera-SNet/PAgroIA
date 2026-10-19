# AgroIA Web

Tablero de AgroIA (diagnóstico de fertilidad del suelo). Es una página estática que se sirve con `serve.py`.

- **Datos:** canal público de ThingSpeak **3540815**. Se cambia en `js/config.js` (`channelId`) o desde la pantalla *Configuración*.
- **Despliegue en Railway:** `Procfile` arranca `serve.py`. `requirements.txt` está vacío a propósito: sin él, Railway no instala Python.
- **Modo dormido (Serverless):** `railway.json` trae `"sleepApplication": true`. Si Railway ignora el archivo, activar en el panel: *Service → Settings → Deploy → Serverless*, y luego *Deploy latest commit*.
- **Sin claves:** este repositorio no contiene ningún archivo `.env` ni secretos.
- **Sesión:** `SESION_OBLIGATORIA = true` en `js/config.js` (login obligatorio). Login tradicional (`POST /auth/login`) y botón «Continuar con Google» (`GET /auth/google` del backend).

> **Contexto completo y siempre actualizado del programa (los 4 componentes): ver `CONTEXTO.md` (v1.2).**
