"""
Minimal MQTT client and processing queue for Hydronix backend.
- Connects to configured broker(s)
- Subscribes to topic (settings.mqtt_topic)
- Enqueues messages into an in-memory queue with max size (backpressure)
- Background worker processes queue and POSTs to internal ingest handler function

This file keeps implementation lightweight and test-friendly.
"""
import json
import threading
import queue
import time
import logging
from typing import Callable, Optional

import paho.mqtt.client as mqtt
from .config import settings

logger = logging.getLogger(__name__)

# Default queue size (backpressure control)
MQTT_QUEUE_MAX = getattr(settings, 'mqtt_queue_max', 1000)

class MQTTProcessor:
    def __init__(self, on_message_callback: Callable[[dict], None]):
        self.on_message = on_message_callback
        self._queue = queue.Queue(maxsize=MQTT_QUEUE_MAX)
        self._client = None
        self._worker_thread: Optional[threading.Thread] = None
        self._running = False

    def _on_connect(self, client, userdata, flags, rc):
        logger.info(f"MQTT connected with rc={rc}")
        try:
            client.subscribe(settings.mqtt_topic)
            logger.info(f"Subscribed to {settings.mqtt_topic}")
        except Exception as e:
            logger.error(f"Failed to subscribe: {e}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = msg.payload.decode('utf-8')
            data = json.loads(payload)
        except Exception as e:
            logger.warning(f"Invalid MQTT payload: {e}")
            return

        try:
            self._queue.put_nowait(data)
        except queue.Full:
            logger.warning("MQTT processing queue full — dropping message")

    def start(self):
        if self._running:
            return
        self._running = True
        # Start worker thread
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()

        # Setup MQTT client
        client = mqtt.Client(client_id=settings.mqtt_client_id)
        if settings.mqtt_username:
            client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        self._client = client

        # Try connecting to broker list — support comma-separated brokers for cluster
        brokers = [b.strip() for b in str(settings.mqtt_broker).split(',') if b.strip()]
        for broker in brokers:
            try:
                client.connect(broker, settings.mqtt_port, keepalive=settings.mqtt_keepalive)
                client.loop_start()
                logger.info(f"MQTT client started and connecting to {broker}:{settings.mqtt_port}")
                return
            except Exception as e:
                logger.warning(f"Failed to connect to MQTT broker {broker}: {e}")
        logger.error("Unable to connect to any MQTT broker — MQTT disabled")

    def stop(self):
        self._running = False
        if self._client:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception:
                pass
        if self._worker_thread:
            self._worker_thread.join(timeout=2)

    def _worker_loop(self):
        logger.info("MQTT worker started")
        while self._running:
            try:
                item = self._queue.get(timeout=1)
            except queue.Empty:
                continue

            try:
                # Call ingest handler — user-supplied callable
                self.on_message(item)
            except Exception as e:
                logger.exception(f"Error processing MQTT message: {e}")
            finally:
                self._queue.task_done()

        logger.info("MQTT worker stopped")
