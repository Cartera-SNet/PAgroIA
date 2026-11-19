/* Administración: respaldo de la base de datos y pausa de recepción de datos.
   La clave maestra se escribe aquí cada vez; NO se guarda en el navegador ni en la página. */
(function () {
  const $ = id => document.getElementById(id);
  const caja = $("adm-clave"), msg = $("adm-msg"), estado = $("adm-estado");
  if (!caja) return;

  const aviso = (t, tipo) => { msg.textContent = t; msg.style.color = tipo === "mal" ? "#b3261e" : tipo === "bien" ? "#1b7a43" : ""; };
  const pintar = r => {
    const pausada = r === "pausada";
    estado.textContent = pausada ? "Pausada (no se guardan datos)" : "Activada";
    estado.style.color = pausada ? "#b3261e" : "#1b7a43";
    $("adm-pausar").disabled = pausada;
    $("adm-reanudar").disabled = !pausada;
  };
  const errorDe = async r => {
    if (r.status === 401) return "Clave incorrecta.";
    if (r.status === 429) return "Demasiados intentos fallidos. Espera 15 minutos.";
    if (r.status === 503) return "La clave aún no está configurada en el servidor.";
    return "No se pudo completar (error " + r.status + ").";
  };
  const exigeClave = () => { if (!caja.value) { aviso("Escribe la clave maestra.", "mal"); caja.focus(); return false; } return true; };

  async function cargarEstado() {
    try {
      const r = await fetch(API_BASE_URL + "/admin/estado");
      if (!r.ok) throw new Error();
      pintar((await r.json()).recepcion);
    } catch (e) { estado.textContent = "No se pudo consultar (el servidor puede estar despertando)"; estado.style.color = ""; }
  }

  async function cambiar(accion) {
    if (!exigeClave()) return;
    aviso("Enviando…");
    try {
      const r = await fetch(API_BASE_URL + "/admin/recepcion", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Clave": caja.value },
        body: JSON.stringify({ accion })
      });
      if (!r.ok) return aviso(await errorDe(r), "mal");
      const d = await r.json(); pintar(d.recepcion);
      aviso(d.recepcion === "pausada" ? "Listo: la recepción quedó PAUSADA. El ESP32 ya no guarda datos en la base de datos." : "Listo: la recepción está ACTIVADA otra vez.", "bien");
    } catch (e) { aviso("No hubo conexión con el servidor. Inténtalo de nuevo.", "mal"); }
  }

  async function respaldo() {
    if (!exigeClave()) return;
    aviso("Preparando el respaldo… (puede tardar unos segundos)");
    try {
      const r = await fetch(API_BASE_URL + "/admin/respaldo", { method: "POST", headers: { "X-Admin-Clave": caja.value } });
      if (!r.ok) return aviso(await errorDe(r), "mal");
      const blob = await r.blob();
      const m = /filename="?([^";]+)"?/.exec(r.headers.get("Content-Disposition") || "");
      const nombre = m ? m[1] : "respaldo_agroia.zip";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      aviso("Respaldo descargado: " + nombre, "bien");
    } catch (e) { aviso("No hubo conexión con el servidor. Inténtalo de nuevo.", "mal"); }
  }

  $("adm-pausar").addEventListener("click", () => cambiar("pausar"));
  $("adm-reanudar").addEventListener("click", () => cambiar("activar"));
  $("adm-respaldo").addEventListener("click", respaldo);
  cargarEstado();
})();
