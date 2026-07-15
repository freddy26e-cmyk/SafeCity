// ==========================================
// 1. RELOJ EN TIEMPO REAL
// ==========================================
function updateTime() {
    const timeDisplay = document.getElementById('current-time');
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateTime, 1000);

// IP de la ESP32-CAM para control directo de los motores (Servidor principal Puerto 80)
const ipEsp32 = "192.168.15.153";

// ==========================================
// 2. CONTROL DEL JOYSTICK (PAN & TILT)
// ==========================================
const stick = document.getElementById('joystick-stick');
const boundary = document.getElementById('joystick-boundary');
const valX = document.getElementById('val-x');
const valY = document.getElementById('val-y');

let isDragging = false;
let boundaryRadius = boundary.offsetWidth / 2;
let stickRadius = stick.offsetWidth / 2;
let maxDistance = boundaryRadius - stickRadius; // Límite de movimiento físico

// Posición inicial del stick en el centro exacto
let centerX = boundaryRadius - stickRadius;
let centerY = boundaryRadius - stickRadius;

// Colocar el joystick en el centro al cargar la página
stick.style.left = `${centerX}px`;
stick.style.top = `${centerY}px`;

// Función para mover el joystick y calcular porcentajes
function moveJoystick(clientX, clientY) {
    const rect = boundary.getBoundingClientRect();
    
    // Coordenadas del toque/click relativas al centro del contenedor
    const touchX = clientX - rect.left - boundaryRadius;
    const touchY = clientY - rect.top - boundaryRadius;
    
    // Distancia desde el centro usando Pitágoras: d = sqrt(x² + y²)
    const distance = Math.sqrt(touchX * touchX + touchY * touchY);
    
    let finalX = touchX;
    let finalY = touchY;
    
    // Si se sale del límite circular, restringir el movimiento al borde
    if (distance > maxDistance) {
        const angle = Math.atan2(touchY, touchX);
        finalX = Math.cos(angle) * maxDistance;
        finalY = Math.sin(angle) * maxDistance;
    }
    
    // Mover visualmente el stick
    stick.style.left = `${centerX + finalX}px`;
    stick.style.top = `${centerY + finalY}px`;
    
    // Convertir la posición a un rango de -100 a 100
    // Invertimos la "Y" para que "Arriba" sea positivo y "Abajo" sea negativo
    const percentX = Math.round((finalX / maxDistance) * 100);
    const percentY = Math.round(-(finalY / maxDistance) * 100);
    
    // Mostrar valores en la interfaz HTML
    valX.textContent = percentX;
    valY.textContent = percentY;

    // Enviar coordenadas mapeadas al ESP32-CAM
    enviarDatosServo(percentX, percentY);
}

// Retornar el joystick al centro al soltarlo
function resetJoystick() {
    isDragging = false;
    stick.style.transition = "all 0.2s ease-out"; // Animación fluida de retorno
    stick.style.left = `${centerX}px`;
    stick.style.top = `${centerY}px`;
    
    valX.textContent = 0;
    valY.textContent = 0;

    // Retornar servos a su centro (90°, 90°) al soltar el joystick
    enviarDatosServo(0, 0);
}

// Quitar la transición para que no tenga lag al arrastrar
function startDrag() {
    isDragging = true;
    stick.style.transition = "none";
}

// --- EVENTOS DE MOUSE (PC) ---
stick.addEventListener('mousedown', (e) => {
    startDrag();
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    moveJoystick(e.clientX, e.clientY);
});

document.addEventListener('mouseup', () => {
    if (isDragging) resetJoystick();
});

// --- EVENTOS TÁCTILES (Móvil) ---
stick.addEventListener('touchstart', (e) => {
    startDrag();
    e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    moveJoystick(touch.clientX, touch.clientY);
});

document.addEventListener('touchend', () => {
    if (isDragging) resetJoystick();
});

// ==========================================
// 3. ENVÍO DE DATOS AL ESP32-CAM (PAN & TILT)
// ==========================================
let ultimoEnvio = 0;

function enviarDatosServo(x, y) {
    const ahora = Date.now();
    // Limitar los envíos a máximo uno cada 100ms para no congelar el chip
    if (ahora - ultimoEnvio > 100 || (x === 0 && y === 0)) {
        ultimoEnvio = ahora;

        // Convertimos el rango de tu joystick (-100 a 100) a los grados que espera tu Arduino
        // X mapea a Pan (30 a 150) | Y mapea invertido a Tilt (50 a 130)
        const panGrados = Math.round(90 + (x * 0.6));  
        const tiltGrados = Math.round(90 - (y * 0.4)); 

        // Construimos la URL apuntando a la ruta /servo y los parámetros que tu placa lee
        const url = `http://${ipEsp32}/servo?pan=${panGrados}&tilt=${tiltGrados}`;

        fetch(url, { mode: 'no-cors' }) 
            .then(() => {
                console.log(`Comando Servo -> Pan: ${panGrados}° | Tilt: ${tiltGrados}°`);
            })
            .catch(err => {
                console.log("ESP32 no responde a comandos de servo");
            });
    }
}

// ==========================================
// 4. CAPTURA DE ALERTAS DESDE EL SERVIDOR PYTHON
// ==========================================
function addAlert(message, time) {
    const feed = document.getElementById('alerts-feed');
    const alertTime = time || new Date().toLocaleTimeString();
    
    const alertHtml = `
        <div class="alert-item p-3 bg-red-900/20 border-l-4 border-red-600 rounded animate-pulse">
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-bold text-red-500 uppercase italic">Movimiento Detectado</span>
                <span class="text-[10px] text-slate-500">${alertTime}</span>
            </div>
            <p class="text-xs mt-1 text-slate-300">${message}</p>
        </div>
    `;
    
    feed.insertAdjacentHTML('afterbegin', alertHtml);
}

// Consultar alertas al servidor Flask cada 1 segundo
async function chequearAlertasServidor() {
    try {
        const respuesta = await fetch(`http://localhost:5000/obtener_alertas`);
        const alertas = await respuesta.json();

        // Si el servidor devolvió alertas, las procesamos una por una
        alertas.forEach(alerta => {
            addAlert(alerta.mensaje, alerta.tiempo);
        });
    } catch (error) {
        // Silenciar errores de conexión cuando el script de Python esté apagado
    }
}

// Iniciar monitoreo de alertas desde Python
setInterval(chequearAlertasServidor, 1000);