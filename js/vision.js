
montarLayout();

// ======================================================
// CONFIGURACIÓN
// ======================================================

const modo = document.body.dataset.modo;

const RUTAS = {
  analizar: "/vision/analizar",
  fusion: "/vision/fusion",
  reporte: "/vision/reporte-pdf"
};

const archivo = $("archivo");
const btn = $("enviar");
const out = $("resultado");


// ======================================================
// EVENTO: SELECCIONAR IMAGEN
// ======================================================

archivo.onchange = () => {

  btn.disabled = !archivo.files[0];

  out.innerHTML = "";

  limpiarAviso();

  // Mostrar imagen antes de analizar
  if (archivo.files[0] && modo !== "reporte") {
    dibujar(archivo.files[0], []);
  }
};


// ======================================================
// DIBUJAR IMAGEN Y DETECCIONES
// ======================================================

function dibujar(file, dets = []) {

  const img = new Image();

  img.onload = () => {

    const canvas = $("lienzo");

    if (!canvas) {
      console.error("No existe el elemento #lienzo");
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }

    // Escala utilizada para el grosor y texto
    const escala = Math.max(img.width / 640, 1);

    // Ajustar canvas al tamaño real de la imagen
    canvas.width = img.width;
    canvas.height = img.height;

    // Dibujar imagen
    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      img.height
    );

    canvas.hidden = false;


    // ==================================================
    // DIBUJAR DETECCIONES
    // ==================================================

    dets.forEach((d, index) => {

      console.log(
        `Detección ${index + 1}:`,
        d
      );

      // ================================================
      // LA API DEVUELVE ESTOS CAMPOS:
      //
      // x_min
      // y_min
      // x_max
      // y_max
      // ================================================

      const x1 = Number(d.x_min);
      const y1 = Number(d.y_min);
      const x2 = Number(d.x_max);
      const y2 = Number(d.y_max);


      // Verificar coordenadas
      if (
        !Number.isFinite(x1) ||
        !Number.isFinite(y1) ||
        !Number.isFinite(x2) ||
        !Number.isFinite(y2)
      ) {

        console.warn(
          "Detección ignorada por coordenadas inválidas:",
          d
        );

        return;
      }


      // Ancho y alto del bounding box
      const ancho = x2 - x1;
      const alto = y2 - y1;


      if (ancho <= 0 || alto <= 0) {

        console.warn(
          "Bounding box inválido:",
          d
        );

        return;
      }


      // ================================================
      // RECTÁNGULO
      // ================================================

      ctx.strokeStyle = "#e0654a";
      ctx.lineWidth = Math.max(3 * escala, 2);

      ctx.strokeRect(
        x1,
        y1,
        ancho,
        alto
      );


      // ================================================
      // TEXTO
      // ================================================

      ctx.fillStyle = "#e0654a";

      ctx.font =
        `600 ${Math.max(16 * escala, 14)}px sans-serif`;

      const confianza =
        Number(d.confianza);

      const porcentaje =
        Number.isFinite(confianza)
          ? (confianza * 100).toFixed(1)
          : "0.0";

      const texto =
        `${d.clase || "detección"} ${porcentaje}%`;


      // Posición del texto
      const textoY =
        Math.max(
          y1 - 8,
          Math.max(16 * escala, 16)
        );


      ctx.fillText(
        texto,
        x1,
        textoY
      );

    });
  };


  // Error al cargar imagen
  img.onerror = () => {

    console.error(
      "No fue posible cargar la imagen:",
      file
    );

    avisar(
      "No fue posible cargar la imagen."
    );
  };


  // Cargar imagen
  img.src = URL.createObjectURL(file);
}


// ======================================================
// BOTÓN ENVIAR
// ======================================================

btn.onclick = async () => {

  // Verificar archivo
  if (!archivo.files || !archivo.files[0]) {

    avisar(
      "Seleccione una imagen antes de continuar."
    );

    return;
  }


  // ====================================================
  // FORM DATA
  // ====================================================

  const fd = new FormData();

  fd.append(
    "archivo",
    archivo.files[0]
  );


  // ====================================================
  // ESTADO INICIAL
  // ====================================================

  btn.disabled = true;

  limpiarAviso();

  out.innerHTML = "";

  $("estado").textContent =
    modo === "reporte"
      ? "Generando reporte..."
      : "Analizando imagen...";


  try {

    console.log(
      "Enviando archivo:",
      archivo.files[0].name
    );

    console.log(
      "Modo:",
      modo
    );

    console.log(
      "Ruta:",
      RUTAS[modo]
    );


    // ==================================================
    // PETICIÓN AL BACKEND
    // ==================================================

    const r = await apiFetch(
      RUTAS[modo],
      {
        method: "POST",
        body: fd
      }
    );


    console.log(
      "Respuesta HTTP:",
      r.status
    );


    // ==================================================
    // REPORTE PDF
    // ==================================================

    if (modo === "reporte") {

      const blob = await r.blob();

      const url =
        URL.createObjectURL(blob);


      out.innerHTML = `
        <p class="ok-msg">
          Reporte generado correctamente.
        </p>

        <a
          class="btn"
          href="${url}"
          download="reporte_agroia.pdf"
        >
          <i class="fa-solid fa-download"></i>
          Descargar PDF
        </a>
      `;

      return;
    }


    // ==================================================
    // RESPUESTA JSON
    // ==================================================

    const d = await r.json();


    console.log(
      "RESPUESTA COMPLETA DEL BACKEND:",
      d
    );


    // ==================================================
    // DETECCIONES
    // ==================================================

    const dets =
      Array.isArray(d.detecciones)
        ? d.detecciones
        : [];


    console.log(
      "DETECCIONES RECIBIDAS:",
      dets
    );


    // ==================================================
    // TELEMETRÍA
    // ==================================================

    const t = d.telemetria;


    // ==================================================
    // DIBUJAR RESULTADO
    // ==================================================

    dibujar(
      archivo.files[0],
      dets
    );


    // ==================================================
    // MOSTRAR DETECCIONES
    // ==================================================

    let html = `
      <h3>
        Detecciones: ${dets.length}
      </h3>
    `;


    if (dets.length === 0) {

      html += `
        <div class="det">
          No se encontraron detecciones.
        </div>
      `;

    } else {

      html += dets
        .map((det, index) => {

          const x1 = Number(det.x_min);
          const y1 = Number(det.y_min);
          const x2 = Number(det.x_max);
          const y2 = Number(det.y_max);

          const confianza =
            Number(det.confianza);

          const porcentaje =
            Number.isFinite(confianza)
              ? (confianza * 100).toFixed(2)
              : "0.00";


          return `
            <div class="det">

              <b>Detección:</b>
              ${index + 1}

              <br>

              <b>Clase:</b>
              ${esc(det.clase || "--")}

              <br>

              <b>Confianza:</b>
              ${porcentaje} %

              <br>

              <b>Bounding Box:</b>
              (${x1}, ${y1}) -
              (${x2}, ${y2})

            </div>
          `;

        })
        .join("");
    }


    // ==================================================
    // TELEMETRÍA PARA FUSION
    // ==================================================

    if (
      modo === "fusion" &&
      t &&
      typeof CAMPOS !== "undefined"
    ) {

      html += `
        <h3>
          Telemetría
        </h3>

        <div class="grid">

          ${CAMPOS
            .map(([k, n, u]) => {

              const valor =
                t[k] ?? "--";

              const numero =
                Number(t[k]);

              let estado = "";

              if (
                typeof estadoValor === "function"
              ) {
                estado =
                  estadoValor(
                    k,
                    numero
                  );
              }


              return `
                <div
                  class="card kpi ${estado}"
                >

                  <span>
                    ${esc(n)}
                  </span>

                  <b>
                    ${esc(String(valor))}
                    ${esc(u || "")}
                  </b>

                </div>
              `;

            })
            .join("")}

        </div>
      `;
    }


    // ==================================================
    // MOSTRAR RESULTADO
    // ==================================================

    out.innerHTML = html;


    console.log(
      "Análisis procesado correctamente."
    );


  } catch (e) {

    // ==================================================
    // ERROR REAL
    // ==================================================

    console.error(
      "ERROR REAL EN VISION.JS:",
      e
    );

    console.error(
      "STACK:",
      e?.stack
    );


    avisar(
      modo === "reporte"
        ? "No fue posible generar el reporte."
        : (e instanceof TypeError
            ? "No fue posible conectar con el servidor de visión. Verifica que el backend esté encendido (opción 1 del iniciador) y que exista backend\\.env."
            : "Error procesando la respuesta de visión."),
      e
    );


  } finally {

    btn.disabled = false;

    $("estado").textContent = "";
  }
};

