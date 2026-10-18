/* AgroIA - Configuración: canal de ThingSpeak, notificaciones y preferencias (se guardan en este navegador) */
montarLayout({ nuevo: true, estadoPropio: true });
(function () {
  "use strict";
  const LS_N = "agroia_notif", LS_P = "agroia_pref";
  const leer = (k, d) => { try { return Object.assign({}, d, JSON.parse(localStorage.getItem(k) || "{}")); } catch (e) { return d; } };

  /* ---- ThingSpeak ---- */
  async function probar(id) {
    const c = tsCfg();
    const r = await fetch(c.apiBase + "/channels/" + encodeURIComponent(id) + "/feeds.json?results=1", { cache: "no-store" });
    if (r.status === 404 || r.status === 400) throw new Error("No existe un canal público con ese número.");
    if (r.status === 401 || r.status === 403) throw new Error("El canal no es público: activa «Share channel view with everyone».");
    if (!r.ok) throw new Error("ThingSpeak respondió " + r.status + ".");
    const j = await r.json(); return { nombre: (j.channel && j.channel.name) || "sin nombre", lecturas: (j.feeds || []).length };
  }
  async function pintarEstadoTS() {
    const c = tsCfg(), e = $("ts-estado"), d = $("ts-detalle");
    if (!c.channelId) { e.className = "mal-txt"; e.textContent = "No configurado"; d.textContent = "Pulsa «Configurar» e ingresa el Channel ID de tu canal."; setEstadoSistema("gris", "Canal sin configurar", null); return; }
    try {
      const p = await probar(c.channelId);
      e.className = "ok-txt"; e.textContent = "Conectado";
      d.innerHTML = "Canal <b>" + esc(c.channelId) + "</b> · «" + esc(p.nombre) + "» · <a href=\"" + tsPublicUrl() + "\" target=\"_blank\" rel=\"noopener\" style=\"color:#12873d;font-weight:600\">abrir en ThingSpeak</a>";
      tsPintarEstado(await tsFeeds({ results: 1 }));
    } catch (err) { e.className = "warn-txt"; e.textContent = "Sin respuesta"; d.textContent = err.message || "No fue posible consultar el canal."; setEstadoSistema("bad", "Sin conexión con ThingSpeak", null); }
  }
  function abrirConfigTS() {
    const c = tsCfg();
    const m = abrirModal("Conexión a ThingSpeak",
      '<div class="campo"><label for="m-canal">Channel ID</label><input class="inp" id="m-canal" inputmode="numeric" value="' + esc(c.channelId) + '" placeholder="Ej.: 3540815"></div>' +
      '<p class="cfg-nota" id="m-res">El canal debe estar compartido como público. Nunca escribas aquí la Write API Key.</p>',
      [{ t: "Probar", sec: true, f: async () => {
          const id = $("m-canal").value.trim(), r = $("m-res"); if (!/^\d+$/.test(id)) { r.className = "cfg-nota mal-txt"; r.textContent = "El Channel ID es un número."; return; }
          r.className = "cfg-nota"; r.textContent = "Probando...";
          try { const p = await probar(id); r.className = "cfg-nota ok-txt"; r.textContent = "Conectado: canal «" + p.nombre + "»."; }
          catch (e) { r.className = "cfg-nota mal-txt"; r.textContent = e.message; } } },
       { t: "Guardar", f: () => {
          const id = $("m-canal").value.trim();
          if (!/^\d+$/.test(id)) { const r = $("m-res"); r.className = "cfg-nota mal-txt"; r.textContent = "El Channel ID es un número."; return; }
          tsGuardarCfg({ channelId: id }); cerrarModal(); avisarToast("Canal guardado en este navegador."); pintarEstadoTS(); } }]);
    setTimeout(() => $("m-canal").focus(), 50);
  }
  $("ts-config").onclick = abrirConfigTS;

  /* ---- Notificaciones ---- */
  const N = leer(LS_N, { activas: true, correo: "" });
  $("n-act").checked = !!N.activas; $("n-mail").value = N.correo || "";
  $("n-guardar").onclick = () => {
    const mail = $("n-mail").value.trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return avisarToast("Escribe un correo válido.");
    localStorage.setItem(LS_N, JSON.stringify({ activas: $("n-act").checked, correo: mail })); avisarToast("Notificaciones guardadas.");
  };

  /* ---- Preferencias ---- */
  const P = leer(LS_P, { tema: "claro", idioma: "es" });
  $("pf-tema").value = P.tema === "oscuro" ? "claro" : P.tema; $("pf-idioma").value = P.idioma === "en" ? "es" : P.idioma;
  $("pf-guardar").onclick = () => { localStorage.setItem(LS_P, JSON.stringify({ tema: $("pf-tema").value, idioma: $("pf-idioma").value })); avisarToast("Preferencias guardadas."); };

  /* ---- Información ---- */
  $("info").innerHTML = '<dt>API del servidor</dt><dd>' + esc(API_BASE_URL) + '</dd><dt>Inicio de sesión</dt><dd>' + (SESION_OBLIGATORIA ? "Obligatorio" : "Opcional") + '</dd>' +
    '<dt>Actualización de datos</dt><dd>cada ' + tsCfg().refrescoSegundos + ' s</dd><dt>Versión de la página</dt><dd>' + esc(VERSION_PAGINA) + '</dd>';

  pintarEstadoTS();
})();
