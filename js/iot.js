montarLayout();

const CAMPO_INTERVALO = "Intervalo_EnvioSegundos";

const sel = $("intervalo");

async function cargarConfig() {
  try {
    const c = await apiJson("/iot/configuracion");

    $("raw").textContent = JSON.stringify(c, null, 2);

    if (c[CAMPO_INTERVALO] != null) {
      sel.value = c[CAMPO_INTERVALO];
    }

  } catch (e) {
    avisar(
      "No fue posible cargar la configuración.",
      e
    );
  }
}

$("guardar").onclick = async () => {

  const b = $("guardar");

  b.disabled = true;
  b.textContent = "Guardando...";

  try {

    await apiFetch(
      "/iot/configuracion",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          [CAMPO_INTERVALO]: +sel.value
        })
      }
    );

    limpiarAviso();

    await cargarConfig();

  } catch (e) {

    avisar(
      "No fue posible guardar la configuración.",
      e
    );

  } finally {

    b.disabled = false;
    b.textContent = "Guardar configuración";

  }
};

async function estado() {

  try {

    const m = await leerMedicion();

    const vivo =
      m.time &&
      (Date.now() - new Date(m.time)) < 120000;

    setEstado(
      "esp",
      !!vivo,
      vivo
        ? "ESP32 enviando datos"
        : "ESP32 sin datos recientes"
    );

    $("sensores").innerHTML =
      CAMPOS.map(
        ([k, n]) =>
          `<span class="st ${m[k] != null ? "ok" : "bad"}">${n}</span>`
      ).join("");

  } catch (e) {

    setEstado(
      "esp",
      false,
      "Desconectado"
    );

  }
}

$("teclas").innerHTML =
  "123A456B789C*0#D"
    .split("")
    .map(
      t => `<button>${t}</button>`
    )
    .join("");

$("teclas").onclick = e => {

  if (e.target.tagName === "BUTTON") {

    $("codigo").value +=
      e.target.textContent;

  }

};

$("borrar").onclick = () =>
  $("codigo").value = "";

cargarConfig();

estado();

setInterval(
  estado,
  5000
);