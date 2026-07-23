/*
  SafeCity - joystick para controlar dos servos.

  Este archivo aprovecha la dirección HTTPS que ya usa el elemento:
      <img id="video-stream">

  El comando viaja así:
      GitHub Pages
          -> Cloudflare Tunnel
          -> servidor_safecity.py
          -> ESP32
          -> servos
*/

document.addEventListener("DOMContentLoaded", () => {
    const reloj = document.getElementById("current-time");

    function actualizarReloj() {
        if (!reloj) {
            return;
        }

        reloj.textContent = new Date().toLocaleTimeString(
            "es-PE",
            {
                hour12: false,
            }
        );
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    const boundary = document.getElementById("joystick-boundary");
    const stick = document.getElementById("joystick-stick");
    const valorX = document.getElementById("val-x");
    const valorY = document.getElementById("val-y");
    const video = document.getElementById("video-stream");

    if (!boundary || !stick || !valorX || !valorY || !video) {
        console.error("No se encontraron los elementos del joystick.");
        return;
    }

    const PAN_MIN = 30;
    const PAN_MAX = 150;
    const TILT_MIN = 50;
    const TILT_MAX = 130;

    let arrastrando = false;
    let ultimoEnvio = 0;
    let temporizadorPendiente = null;
    let envioEnCurso = false;
    let ultimoObjetivoPendiente = null;

    let panActual = 90;
    let tiltActual = 90;

    function limitar(valor, minimo, maximo) {
        return Math.max(minimo, Math.min(maximo, valor));
    }

    function mapear(valor, minEntrada, maxEntrada, minSalida, maxSalida) {
        return Math.round(
            minSalida +
            ((valor - minEntrada) * (maxSalida - minSalida)) /
            (maxEntrada - minEntrada)
        );
    }

    function obtenerServidorSafeCity() {
        const src = video.src;

        if (!src || !src.includes("/video_feed")) {
            throw new Error(
                "El video todavía no tiene una dirección pública."
            );
        }

        return new URL(src).origin;
    }

    async function enviarServos(pan, tilt) {
        if (envioEnCurso) {
            ultimoObjetivoPendiente = { pan, tilt };
            return;
        }

        envioEnCurso = true;

        try {
            const servidor = obtenerServidorSafeCity();

            const url =
                servidor +
                "/servo?pan=" +
                encodeURIComponent(pan) +
                "&tilt=" +
                encodeURIComponent(tilt) +
                "&t=" +
                Date.now();

            const respuesta = await fetch(url, {
                cache: "no-store",
            });

            if (!respuesta.ok) {
                throw new Error("HTTP " + respuesta.status);
            }

            const datos = await respuesta.json();

            if (!datos.conectado) {
                throw new Error(
                    datos.mensaje || "ESP32 desconectado"
                );
            }
        } catch (error) {
            console.error("Error moviendo servos:", error);
        } finally {
            envioEnCurso = false;

            if (ultimoObjetivoPendiente) {
                const siguiente = ultimoObjetivoPendiente;
                ultimoObjetivoPendiente = null;

                enviarServos(
                    siguiente.pan,
                    siguiente.tilt
                );
            }
        }
    }

    function programarEnvio(pan, tilt, forzar = false) {
        const ahora = Date.now();
        const espera = 40;

        if (forzar || ahora - ultimoEnvio >= espera) {
            ultimoEnvio = ahora;
            enviarServos(pan, tilt);
            return;
        }

        clearTimeout(temporizadorPendiente);

        temporizadorPendiente = setTimeout(() => {
            ultimoEnvio = Date.now();
            enviarServos(pan, tilt);
        }, espera - (ahora - ultimoEnvio));
    }

    function actualizarJoystick(evento, forzarEnvio = false) {
        const rect = boundary.getBoundingClientRect();

        const centroX = rect.left + rect.width / 2;
        const centroY = rect.top + rect.height / 2;

        const radioDisponible =
            rect.width / 2 - stick.offsetWidth / 2;

        let dx = evento.clientX - centroX;
        let dy = evento.clientY - centroY;

        const distancia = Math.hypot(dx, dy);

        if (distancia > radioDisponible) {
            const escala = radioDisponible / distancia;
            dx *= escala;
            dy *= escala;
        }

        stick.style.transform =
            `translate(${dx}px, ${dy}px)`;

        const xPorcentaje = limitar(
            Math.round((dx / radioDisponible) * 100),
            -100,
            100
        );

        const yPorcentaje = limitar(
            Math.round((dy / radioDisponible) * 100),
            -100,
            100
        );

        valorX.textContent = xPorcentaje;
        valorY.textContent = yPorcentaje;

        panActual = mapear(
            xPorcentaje,
            -100,
            100,
            PAN_MIN,
            PAN_MAX
        );

        // Hacia arriba aumenta el ángulo vertical.
        tiltActual = mapear(
            -yPorcentaje,
            -100,
            100,
            TILT_MIN,
            TILT_MAX
        );

        programarEnvio(
            panActual,
            tiltActual,
            forzarEnvio
        );
    }

    boundary.addEventListener("pointerdown", (evento) => {
        arrastrando = true;
        boundary.setPointerCapture(evento.pointerId);
        actualizarJoystick(evento, true);
    });

    boundary.addEventListener("pointermove", (evento) => {
        if (!arrastrando) {
            return;
        }

        actualizarJoystick(evento);
    });

    boundary.addEventListener("pointerup", (evento) => {
        if (!arrastrando) {
            return;
        }

        arrastrando = false;
        actualizarJoystick(evento, true);
    });

    boundary.addEventListener("pointercancel", () => {
        arrastrando = false;
    });

    // Doble clic o doble toque: centra ambos servos.
    boundary.addEventListener("dblclick", () => {
        panActual = 90;
        tiltActual = 90;

        stick.style.transform = "translate(0px, 0px)";
        valorX.textContent = "0";
        valorY.textContent = "0";

        programarEnvio(
            panActual,
            tiltActual,
            true
        );
    });

    // Estado visual inicial.
    stick.style.transform = "translate(0px, 0px)";
    valorX.textContent = "0";
    valorY.textContent = "0";
});
