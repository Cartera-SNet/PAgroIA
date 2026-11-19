/* AgroIA - Página de chat con Agro.
   Responde con datos reales (ThingSpeak) y, si el servidor tiene la IA activada, con Claude.
   Si le HABLAS con el micrófono, responde también con voz. Si le ESCRIBES, responde solo por texto. */
montarLayout({ nuevo: true });
(function () {
  "use strict";
  $("chat-cab").insertAdjacentHTML("afterbegin", ico("i-chat"));
  $("chat-enviar").innerHTML = ico("i-send");
  const mic = $("chat-mic"), vozBtn = $("chat-voz"), estado = $("agro-estado"), campo = $("chat-input");
  mic.innerHTML = ico("i-mic");
  let porVoz = false;                                   // true solo si el mensaje que se va a enviar se dictó con el micrófono
  let responderConVoz = false;                          // el mensaje que se está contestando se dictó (se fija al enviarlo)

  const ponerEstado = t => { estado.textContent = t || ""; estado.classList.toggle("on", !!t); };
  function pintarVozBtn() {
    const off = AgroVoz.esSilenciado();
    vozBtn.innerHTML = ico(off ? "i-volume-off" : "i-volume");
    vozBtn.classList.toggle("off", off);
    vozBtn.setAttribute("aria-pressed", off ? "true" : "false");
    vozBtn.title = off ? "La voz de Agro está silenciada (púlsame para activarla)" : "Silenciar la voz de Agro";
  }
  pintarVozBtn();
  vozBtn.onclick = () => { AgroVoz.fijarSilencio(!AgroVoz.esSilenciado()); pintarVozBtn(); if (AgroVoz.esSilenciado()) ponerEstado(""); };

  const enviar = chatConectar({
    log: $("chat-log"), campo: campo, boton: $("chat-enviar"),
    alEnviar: function () { quitarInvita(); AgroVoz.detener(); ponerEstado("Pensando…"); responderConVoz = porVoz; porVoz = false; },
    alResponder: function (resp) {
      ponerEstado("");
      if (!responderConVoz) return;                     // lo escribieron: solo texto
      responderConVoz = false;
      AgroVoz.hablar(htmlATexto(resp.html), { alEstado: ponerEstado });
    }
  });
  campo.addEventListener("input", () => { porVoz = false; });   // si la persona escribe o edita, es texto

  if (AgroVoz.micDisponible()) {
    mic.onclick = function () {
      if (mic.classList.contains("escuchando")) { AgroVoz.dejarDeEscuchar(); return; }
      ponerEstado("Escuchando… habla ahora");
      mic.classList.add("escuchando"); mic.setAttribute("aria-pressed", "true");
      AgroVoz.escuchar({
        alTexto: t => { campo.value = t; porVoz = true; enviar(); },
        alTerminar: recibido => { mic.classList.remove("escuchando"); mic.setAttribute("aria-pressed", "false"); if (!recibido && /^Escuchando/.test(estado.textContent)) ponerEstado(""); },
        alError: msg => { ponerEstado(msg); setTimeout(() => { if (estado.textContent === msg) ponerEstado(""); }, 6000); }
      });
    };
  } else {
    mic.disabled = true; mic.classList.add("sin-soporte");
    mic.title = "Tu navegador no permite dictado por voz. Usa Chrome o Edge.";
  }

  // Pantalla de inicio: NO saluda sola. Invita a saludar; Agro responde "Hola, soy Agro…" cuando le dicen hola (por texto o por voz).
  const invita = document.createElement("div");
  invita.className = "agro-invita"; invita.id = "agro-invita";
  invita.innerHTML = '<span class="agro-invita-ico">' + ico("i-brain") + '</span><h2>Saluda a Agro</h2>' +
    '<p>Escríbele «hola» o pulsa el micrófono y dile «hola, Agro».</p>' +
    '<button type="button" class="chip" id="agro-invita-btn">👋 Hola, Agro</button>';
  $("chat-log").appendChild(invita);
  function quitarInvita() { const x = $("agro-invita"); if (x) x.remove(); }
  $("agro-invita-btn").onclick = () => { porVoz = false; campo.value = "Hola Agro"; enviar(); };
  ["¿Cuál es la temperatura actual?", "¿Cómo está la humedad del suelo?", "Estado del cultivo", "¿Necesito regar?", "Enciende el LED", "Apaga el LED"].forEach(t => {
    const b = document.createElement("button"); b.className = "chip"; b.textContent = t;
    b.onclick = () => { porVoz = false; campo.value = t; enviar(); }; $("chips").appendChild(b);
  });
  campo.focus({ preventScroll: true });
  window.addEventListener("pagehide", () => AgroVoz.detener());
})();
