// Función para el reloj en tiempo real
function updateTime() {
    const timeDisplay = document.getElementById('current-time');
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateTime, 1000);

// Lista de nodos ESP32 actualizada con tus dos cámaras activas
const nodes = [
    { id: 1, name: 'CAM 01 - Entrada', status: 'online' },
    { id: 2, name: 'CAM 02 - Parque', status: 'online' },
    { id: 3, name: 'Cámara Cochera', status: 'offline' }
];

function renderNodes() {
    const list = document.getElementById('nodes-list');
    list.innerHTML = nodes.map(node => `
        <div class="flex items-center justify-between p-2 bg-slate-800/40 rounded border border-slate-700/50">
            <span class="text-xs">${node.name}</span>
            <span class="h-2 w-2 rounded-full ${node.status === 'online' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500'}"></span>
        </div>
    `).join('');
}

// Función para agregar alertas a la pantalla (Mantiene tu diseño original)
function addAlert(message, location, time) {
    const feed = document.getElementById('alerts-feed');
    // Si el servidor nos da una hora exacta la usamos, de lo contrario calculamos la hora local
    const alertTime = time || new Date().toLocaleTimeString();
    
    const alertHtml = `
        <div class="alert-item p-3 bg-red-900/20 border-l-4 border-red-600 rounded animate-pulse">
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-bold text-red-500 uppercase italic">Movimiento Detectado</span>
                <span class="text-[10px] text-slate-500">${alertTime}</span>
            </div>
            <p class="text-xs mt-1 text-slate-300">Sector: ${location}</p>
        </div>
    `;
    
    feed.insertAdjacentHTML('afterbegin', alertHtml);
}

// Función para consultar las alertas reales del servidor de Python
async function chequearAlertasServidor() {
    try {
        // Hacemos la petición a tu servidor local en el puerto 5000
        const respuesta = await fetch('http://localhost:5000/obtener_alertas');
        const alertas = await respuesta.json();

        // Si el servidor devolvió alertas, las procesamos una por una
        alertas.forEach(alerta => {
            addAlert(alerta.mensaje, 'Zona Entrada', alerta.tiempo);
        });
    } catch (error) {
        // Evitamos llenar la consola de errores si el servidor de Python se apaga momentáneamente
        console.log("Esperando respuesta del servidor de alertas...");
    }
}

// Inicializar componentes estáticos
renderNodes();

// Consultar alertas reales del servidor cada 1000 milisegundos (1 segundo)
setInterval(chequearAlertasServidor, 1000);