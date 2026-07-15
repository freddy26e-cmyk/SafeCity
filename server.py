from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import cv2
import datetime
import urllib.request
import numpy as np

app = Flask(__name__)
CORS(app)  # Permite que tu web local se conecte sin bloqueos

# --- CONFIGURACIÓN DE CÁMARA ÚNICA ---
# Tu cámara local (CAM 01) apuntando a la nueva IP
ESP32_CAM_1_URL = "http://192.168.15.150/stream"

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

# Ruta de video para CAM 01 (Entrada) - Tu HTML consumirá esta ruta
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames_cam1(), mimetype='multipart/x-mixed-replace; boundary=frame')

# 1. RUTA PARA RECIBIR LA ALERTA DESDE EL ESP32 (Sensor PIR)
@app.route('/alerta', methods=['GET', 'POST'])
def recibir_alerta():
    ahora = datetime.datetime.now().strftime("%H:%M:%S")
    nueva_alerta = {
        "tiempo": ahora,
        "mensaje": "¡Movimiento detectado en CAM 01!"
    }
    lista_alertas.append(nueva_alerta)
    print(f"[{ahora}] Alerta recibida en Python del sensor PIR")
    return jsonify({"status": "success", "message": "Alerta registrada con exito"}), 200

# 2. RUTA PARA QUE LA PAGINA WEB CONSULTE SI HAY ALERTAS NUEVAS
@app.route('/obtener_alertas', methods=['GET'])
def obtener_alertas():
    global lista_alertas
    alertas_actuales = list(lista_alertas)
    lista_alertas.clear() 
    return jsonify(alertas_actuales), 200

if __name__ == '__main__':
    # Ejecuta el servidor en tu red local en el puerto 5000
    app.run(host='0.0.0.0', port=5000, debug=True)