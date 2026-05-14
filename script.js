// Función para el reloj en tiempo real
function updateTime() {
    const timeDisplay = document.getElementById('current-time');
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateTime, 1000);

// Lista de nodos ESP32 simulada
const nodes = [
    { id: 1, name: 'Entrada Principal', status: 'online' },
    { id: 2, name: 'Sensor Parque', status: 'online' },
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

// Función para agregar alertas a la pantalla
function addAlert(message, location) {
    const feed = document.getElementById('alerts-feed');
    const alertTime = new Date().toLocaleTimeString();
    
    const alertHtml = `
        <div class="alert-item p-3 bg-red-900/20 border-l-4 border-red-600 rounded">
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-bold text-red-500 uppercase italic">Movimiento Detectado</span>
                <span class="text-[10px] text-slate-500">${alertTime}</span>
            </div>
            <p class="text-xs mt-1 text-slate-300">Sector: ${location}</p>
        </div>
    `;
    
    feed.insertAdjacentHTML('afterbegin', alertHtml);
}

// Inicializar
renderNodes();

// Simulación: Generar una alerta a los 3 segundos
setTimeout(() => {
    addAlert('Intrusión detectada por Sensor PIR', 'Zona Entrada');
}, 3000);