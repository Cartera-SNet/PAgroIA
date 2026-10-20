/* AgroIA - Página de chat */
montarLayout({ nuevo: true });
(function () {
  "use strict";
  try {
    var cab = $("chat-cab");
    if (cab && typeof ico === "function") cab.insertAdjacentHTML("afterbegin", ico("i-chat"));
    var btn = $("chat-enviar");
    if (btn && typeof ico === "function") btn.innerHTML = ico("i-send");
  } catch (e) {}

  var enviar = chatConectar({ log: "chat-log", campo: "chat-input", boton: "chat-enviar" });
  chatBurbuja($("chat-log"), "ia",
    "Hola, soy AgroIA. ¿En qué puedo ayudarte?<br>Puedes preguntar por sensores o decir <b>enciende el LED</b> / <b>apaga el LED</b>.", "");

  ["¿Cuál es la temperatura actual?", "¿Cómo está la humedad del suelo?", "Estado del cultivo", "¿Cuál es el TDS?", "Enciende el LED", "Apaga el LED"].forEach(function (t) {
    var b = document.createElement("button");
    b.className = "chip";
    b.textContent = t;
    b.onclick = function () { $("chat-input").value = t; enviar(); };
    var chips = $("chips");
    if (chips) chips.appendChild(b);
  });
  try { $("chat-input").focus({ preventScroll: true }); } catch (e) {}
})();
