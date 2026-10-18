montarLayout();

let datos = [];
let chart = null;

const selV = $("variable");
const selT = $("ventana");

selV.innerHTML = CAMPOS
  .map(([k, n]) => `<option value="${k}">${n}</option>`)
  .join("");


/* ============================================================
   CARGAR HISTORIAL COMPLETO DESDE INFLUXDB
   ============================================================ */

async function cargarHistorial() {

  try {

    const respuesta = await fetch(
      `${API_BASE_URL}/iot/historial`
    );

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }

    const resultado = await respuesta.json();

    datos = resultado.mediciones || [];

    // Ordenar del más antiguo al más reciente
    datos.sort(
      (a, b) =>
        new Date(a.time) - new Date(b.time)
    );

    limpiarAviso();

    pintar();

  } catch (e) {

    avisar(
      "No fue posible cargar el historial de telemetría.",
      e
    );

  }
}


/* ============================================================
   OBTENER ÚLTIMA MEDICIÓN
   ============================================================ */

async function tomar() {

  try {

    const respuesta = await fetch(
      `${API_BASE_URL}/iot/ultima-medicion`
    );

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }

    const resultado = await respuesta.json();

    const mediciones = resultado.medicion || [];

    if (mediciones.length > 0) {

      const nueva = mediciones[0];

      /*
       * Solamente agregar si realmente es una medición nueva.
       */
      const existe = datos.some(
        d => d.time === nueva.time
      );

      if (!existe) {

        datos.push(nueva);

        /*
         * Mantener máximo 500 mediciones
         */
        if (datos.length > 500) {
          datos = datos.slice(-500);
        }

        datos.sort(
          (a, b) =>
            new Date(a.time) - new Date(b.time)
        );

        pintar();
      }

    }

    limpiarAviso();

  } catch (e) {

    avisar(
      "No fue posible obtener la telemetría. Verifique que el backend esté funcionando.",
      e
    );

  }

  $("carga").hidden = true;
}


/* ============================================================
   PINTAR GRÁFICA Y TABLA
   ============================================================ */

function pintar() {

  const minutos =
    Number(selT.value);

  const desde =
    Date.now() -
    minutos * 60 * 1000;

  const variable =
    selV.value;

  const filtradas =
    datos.filter(
      d =>
        d.time &&
        new Date(d.time) >= desde
    );


  const campo =
    CAMPOS.find(
      c => c[0] === variable
    );

  if (!campo) {
    return;
  }

  const [, nombre, unidad] = campo;


  /* ==========================================================
     DATOS DE LA GRÁFICA
     ========================================================== */

  const labels =
    filtradas.map(
      d =>
        new Date(d.time)
          .toLocaleTimeString()
    );

  const valores =
    filtradas.map(
      d =>
        Number(d[variable])
    );


  /* ==========================================================
     CREAR / ACTUALIZAR GRÁFICA
     ========================================================== */

  if (!chart) {

    chart = new Chart(
      $("grafica"),
      {
        type: "line",

        data: {
          labels,

          datasets: [
            {
              data: valores,

              label:
                `${nombre} ${unidad}`.trim(),

              borderColor: "#2f8f4e",

              backgroundColor:
                "rgba(47,143,78,.12)",

              fill: true,

              tension: 0.3
            }
          ]
        },

        options: {
          animation: false,

          maintainAspectRatio: false
        }
      }
    );

  } else {

    chart.data.labels =
      labels;

    chart.data.datasets[0].data =
      valores;

    chart.data.datasets[0].label =
      `${nombre} ${unidad}`.trim();

    chart.update();
  }


  /* ==========================================================
     TABLA
     ========================================================== */

  $("filas").innerHTML =
    [...filtradas]
      .reverse()
      .slice(0, 60)
      .map(d => {

        const fecha =
          new Date(d.time);

        return `
          <tr>
            <td>
              ${fecha.toLocaleDateString()}
            </td>

            <td>
              ${fecha.toLocaleTimeString()}
            </td>

            ${CAMPOS
              .map(
                ([campo]) =>
                  `<td>${esc(
                    d[campo] ?? "--"
                  )}</td>`
              )
              .join("")
            }

          </tr>
        `;

      })
      .join("");
}


/* ============================================================
   CAMBIO DE VARIABLE
   ============================================================ */

selV.onchange = pintar;


/* ============================================================
   CAMBIO DE VENTANA
   ============================================================ */

selT.onchange = pintar;


/* ============================================================
   INICIAR
   ============================================================ */

(async function iniciar() {

  $("carga").hidden = false;

  // Primero cargar historial existente
  await cargarHistorial();

  // Luego consultar la última medición
  await tomar();

  // Continuar revisando nuevas mediciones
  setInterval(tomar, 5000);

})();
