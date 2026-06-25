from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import cv2
import datetime

app = Flask(__name__)
CORS(app)  # Esto permite que tu web de GitHub Pages lea el video de tu PC

# Tu dirección IP local de la ESP32-CAM
ESP32_CAM_URL = "http://192.168.100.82/stream"

# Lista en memoria para almacenar temporalmente las alertas del sensor PIR
lista_alertas = []

def generate_frames():
    # Nos conectamos al flujo de la cámara
    cap = cv2.VideoCapture(ESP32_CAM_URL)
    
    while True:
        success, frame = cap.read()
        if not success:
            break
        else:
            # Redimensionamos un poco la imagen para que vaya más fluido en la web
            frame = cv2.resize(frame, (640, 480))
            
            # Convertimos el frame en formato JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            # Formato estándar MJPEG para streaming web
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

# 1. RUTA PARA RECIBIR LA ALERTA DESDE EL ESP32 (Sensor PIR)
@app.route('/alerta', methods=['GET', 'POST'])
def recibir_alerta():
    ahora = datetime.datetime.now().strftime("%H:%M:%S")
    nueva_alerta = {
        "tiempo": ahora,
        "mensaje": "¡Movimiento detectado en CAM 01!"
    }
    lista_alertas.append(nueva_alerta)
    print(f"[{ahora}] Alerta recibida del sensor PIR")
    return jsonify({"status": "success", "message": "Alerta registrada con exito"}), 200

# 2. RUTA PARA QUE LA PAGINA WEB CONSULTE SI HAY ALERTAS NUEVAS
@app.route('/obtener_alertas', methods=['GET'])
def obtener_alertas():
    global lista_alertas
    # Hacemos una copia de las alertas actuales para enviarlas
    alertas_actuales = list(lista_alertas)
    # Vaciamos la lista original para que no se dupliquen en la web
    lista_alertas.clear() 
    return jsonify(alertas_actuales), 200

if __name__ == '__main__':
    # Ejecuta el servidor en el puerto 5000
    app.run(host='0.0.0.0', port=5000, debug=True)