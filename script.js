// ==========================================
// 1. RELOJ EN TIEMPO REAL
// ==========================================
function updateTime() {
    const timeDisplay = document.getElementById('current-time');
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateTime, 1000);

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

    // Enviar coordenadas al ESP32-CAM
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

    // Enviar reset al ESP32 (0, 0 para detener o centrar motores)
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
// Usamos una variable de control para no saturar al ESP32 de peticiones por segundo
let ultimoEnvio = 0;

function enviarDatosServo(x, y) {
    const ahora = Date.now();
    // Limitar los envíos a máximo uno cada 100ms (10 peticiones por segundo máximo)
    // Pero si es el reset (0,0), lo enviamos de inmediato sin importar el tiempo.
    if (ahora - ultimoEnvio > 100 || (x === 0 && y === 0)) {
        ultimoEnvio = ahora;

        const ipEsp32 = "192.168.15.91";
        // Construimos la URL apuntando directamente a tu placa local
        const url = `http://${ipEsp32}/control?var=servo&x=${x}&y=${y}`;

        fetch(url, { mode: 'no-cors' }) // 'no-cors' evita bloqueos por seguridad del navegador
            .then(() => {
                console.log(`Comando enviado -> X: ${x} | Y: ${y}`);
            })
            .catch(err => {
                console.log("ESP32 no responde en red local");
            });
    }
}