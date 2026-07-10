from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import cv2
import datetime
import urllib.request
import numpy as np

app = Flask(__name__)
CORS(app)  # Esto permite que tu web de GitHub Pages lea el video de tu PC

# --- CONFIGURACIÓN DE CÁMARAS ---
# Tu cámara local (CAM 01 - Entrada) sigue igual en tu red local
ESP32_CAM_1_URL = "http://192.168.15.91/stream"

# La cámara de tu compañero (CAM 02 - Parque) apunta a su Ngrok sin el /stream final en urllib
ESP32_CAM_2_URL = "https://poster-wrongdoer-container.ngrok-free.dev/stream"

# Lista en memoria para almacenar temporalmente las alertas del sensor PIR
lista_alertas = []

# --- PROCESAMIENTO CÁMARA 1 ---
def generate_frames_cam1():
    cap = cv2.VideoCapture(ESP32_CAM_1_URL)
    while True:
        success, frame = cap.read()
        if not success:
            break
        else:
            frame = cv2.resize(frame, (640, 480))
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

# --- PROCESAMIENTO CÁMARA 2 (CON SALTO DE ADVERTENCIA DE NGROK) ---
def generate_frames_cam2():
    # Creamos una petición especial con el Header que Ngrok exige para saltarse la pantalla azul
    req = urllib.request.Request(ESP32_CAM_2_URL, headers={'ngrok-skip-browser-warning': 'true'})
    
    try:
        # Abrimos el flujo de internet
        stream = urllib.request.urlopen(req)
        bytes_data = b''
        
        while True:
            # Leemos los bytes que envía el ESP32 a través de Ngrok
            bytes_data += stream.read(1024)
            a = bytes_data.find(b'\xff\xd8') # Inicio de un frame JPEG
            b = bytes_data.find(b'\xff\xd9') # Fin de un frame JPEG
            
            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]
                
                # Decodificamos la imagen para que OpenCV la procese y redimensione
                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                if frame is not None:
                    frame = cv2.resize(frame, (640, 480))
                    ret, buffer = cv2.imencode('.jpg', frame)
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    except Exception as e:
        print(f"Error en el flujo de la CAM 02: {e}")

# Ruta de video para CAM 01 (Entrada)
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames_cam1(), mimetype='multipart/x-mixed-replace; boundary=frame')

# Ruta de video para CAM 02 (Parque)
@app.route('/video_feed2')
def video_feed2():
    return Response(generate_frames_cam2(), mimetype='multipart/x-mixed-replace; boundary=frame')

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
    alertas_actuales = list(lista_alertas)
    lista_alertas.clear() 
    return jsonify(alertas_actuales), 200

if __name__ == '__main__':
    # Ejecuta el servidor en el puerto 5000
    app.run(host='0.0.0.0', port=5000, debug=True)