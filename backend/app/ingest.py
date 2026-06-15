import json
import threading
import time
from paho.mqtt import client as mqtt
from .config import settings
from .database import SessionLocal, SensorData


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except Exception:
        payload = {'raw': msg.payload.decode()}
    # store to DB
    db = SessionLocal()
    sd = SensorData(device_id=payload.get('device_id', 'unknown'), raw=payload)
    db.add(sd)
    db.commit()
    db.close()


def start_mqtt_loop():
    client = mqtt.Client()
    client.on_message = on_message
    client.connect(settings.mqtt_broker, settings.mqtt_port, 60)
    client.subscribe(settings.mqtt_topic)
    client.loop_forever()


def start_in_background():
    t = threading.Thread(target=start_mqtt_loop, daemon=True)
    t.start()
    return t
