/* AgroIA - Página de chat (usa chat-core.js: servidor /chat y, si no existe, datos de ThingSpeak) */
montarLayout({ nuevo: true });
(function () {
  "use strict";
  $("chat-cab").insertAdjacentHTML("afterbegin", ico("i-chat"));
  $("chat-enviar").innerHTML = ico("i-send");
  const enviar = chatConectar({ log: $("chat-log"), campo: $("chat-input"), boton: $("chat-enviar") });
  chatBurbuja($("chat-log"), "ia", "Hola, soy AgroIA. ¿En qué puedo ayudarte?<br>Puedes preguntarme sobre el estado del suelo, los datos del sensor o enviar comandos al ESP32.", "");
  ["¿Cuál es la temperatura actual?", "¿Cómo está la humedad del suelo?", "Estado del cultivo", "¿Necesito regar?", "Enciende el LED", "Apaga el LED"].forEach(t => {
    const b = document.createElement("button"); b.className = "chip"; b.textContent = t;
    b.onclick = () => { $("chat-input").value = t; enviar(); }; $("chips").appendChild(b);
  });
  $("chat-input").focus({ preventScroll: true });
})();
