import logging
import uuid
import httpx
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db, Device, SensorData, MLAnomaly, Alert
from ..config import settings
from ..schemas import (
    SensorDataIngestionRequest,
    DataIngestionResponse,
    DataQueryResponse,
    SensorDataResponse,
    MLPredictionRequest,
    MLPredictionResponse,
)
from ..main import (
    cache,
    quality_scorer,
    alert_manager,
    ws_manager,
    get_device_id_from_auth,
    get_client_ip,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


@router.post("/data", response_model=DataIngestionResponse)
async def ingest_sensor_data(
    request: SensorDataIngestionRequest,
    db: Session = Depends(get_db),
    client_ip: str = Depends(get_client_ip),
    device_id: str = Depends(get_device_id_from_auth),
):
    """
    POST /data
    Receive sensor data from device and store in database.
    Validates schema, calculates quality score, and triggers alerts.
    """
    try:
        # Device ID must match authenticated device
        if request.device_id != device_id:
            raise HTTPException(status_code=403, detail="Device ID mismatch")
        
        # Prepare reading values (apply EMA smoothing and calibration offsets if enabled)
        reading_raw = {
            "ph": request.ph,
            "turbidity": request.turbidity,
            "tds": request.tds,
            "temperature": request.temperature,
            "flow_rate": request.flow_rate,
        }

        # Fetch device for calibration/last_smoothed values
        device = db.query(Device).filter(Device.device_id == device_id).first()
        smoothed = reading_raw.copy()
        if settings.smoothing_enabled and device is not None:
            alpha = settings.smoothing_alpha
            last_smoothed = device.last_smoothed_readings or {}
            for k, v in reading_raw.items():
                last = last_smoothed.get(k)
                if last is not None:
                    smoothed[k] = alpha * v + (1 - alpha) * last
                else:
                    smoothed[k] = v
            # persist new smoothed values
            device.last_smoothed_readings = smoothed

        # Apply calibration offsets if present
        calibrated = smoothed.copy()
        if device is not None and getattr(device, 'calibration_offsets', None):
            offsets = device.calibration_offsets or {}
            for k, off in offsets.items():
                if k in calibrated and isinstance(off, (int, float)):
                    calibrated[k] = calibrated[k] + off

        # Calculate quality score on calibrated (smoothed) readings
        quality_score = quality_scorer.calculate_score(calibrated)
        
        # Detect anomalies using calibrated values
        anomaly_flags = quality_scorer.detect_anomalies(calibrated, device_id, db)

        # Ensure device variable exists for later updates
        if device is None:
            device = db.query(Device).filter(Device.device_id == device_id).first()

        # Validate duplicate by device_reset_count + seq_no
        if request.seq_no is not None:
            existing_reading = db.query(SensorData).filter(
                SensorData.device_id == device_id,
                SensorData.device_reset_count == (request.device_reset_count or 0),
                SensorData.seq_no == request.seq_no
            ).first()
            if existing_reading:
                logger.info(f"Duplicate reading received for {device_id} (seq_no: {request.seq_no})")
                return DataIngestionResponse(ok=True, accepted=0, rejected=1)

        # Apply NTP/time-drift handling
        server_now = datetime.utcnow()
        request_ts = request.timestamp
        if request_ts and request_ts.tzinfo is not None:
            request_ts = request_ts.replace(tzinfo=None)
            
        drift_seconds = abs((request_ts - server_now).total_seconds()) if request_ts else 0
        if drift_seconds > settings.max_drift_seconds:
            sensor_timestamp = server_now
            timestamp_source = "server_adjusted"
        else:
            sensor_timestamp = request_ts
            timestamp_source = "device"

        # Create sensor data record
        trace_id = str(uuid.uuid4())
        sensor_data = SensorData(
            device_id=device_id,
            device_reset_count=(request.device_reset_count or 0),
            seq_no=request.seq_no,
            ph=request.ph,
            turbidity=request.turbidity,
            tds=request.tds,
            temperature=request.temperature,
            flow_rate=request.flow_rate,
            raw_ph=request.raw_ph,
            quality_score=quality_score,
            anomaly_flags=anomaly_flags,
            timestamp=sensor_timestamp,
            received_at=server_now,
            timestamp_source=timestamp_source,
            trace_id=trace_id,
        )
        db.add(sensor_data)
        db.flush() # Assign ID to sensor_data
        
        # Call ML Service if enabled (Phase 2+)
        if settings.ml_service_enabled:
            try:
                ml_payload = {
                    "device_id": device_id,
                    "timestamp": sensor_data.timestamp.isoformat() + "Z",
                    "data": {
                        "ph": sensor_data.ph,
                        "turbidity": sensor_data.turbidity,
                        "solids": sensor_data.tds,
                        "temperature": sensor_data.temperature,
                        "flow_rate": sensor_data.flow_rate
                    }
                }
                ml_headers = {}
                if settings.ml_service_api_key:
                    ml_headers["x-api-key"] = settings.ml_service_api_key
                
                async with httpx.AsyncClient() as client:
                    ml_resp = await client.post(
                        f"{settings.ml_service_url}/predict",
                        json=ml_payload,
                        headers=ml_headers,
                        timeout=3.0
                    )
                
                if ml_resp.status_code == 200:
                     ml_data = ml_resp.json()
                     prediction = ml_data.get("prediction", 0)
                     score = ml_data.get("score", 0.0)
                     model_version = ml_data.get("model_version", "unknown")
                     
                     is_anomaly = (prediction == 1) and (score >= settings.ml_confidence_threshold)
                     decision_reason = f"ML prediction: {'Anomaly' if prediction == 1 else 'Normal'} (confidence: {score:.2f})"
                     
                     # Update sensor data anomaly flags
                     current_flags = anomaly_flags or {}
                     current_flags["ml_score"] = score
                     current_flags["ml_predicted_anomaly"] = (prediction == 1)
                     if is_anomaly:
                         current_flags["outlier"] = True
                         if "reasons" not in current_flags:
                             current_flags["reasons"] = []
                         current_flags["reasons"].append(f"ML Anomaly (confidence: {score:.2f})")
                     
                     sensor_data.anomaly_flags = current_flags
                     
                     # Log to ml_anomalies
                     ml_anomaly_rec = MLAnomaly(
                         device_id=device_id,
                         reading_id=sensor_data.id,
                         ml_score=prediction,
                         confidence=score,
                         model_version=model_version,
                         anomaly_reason=decision_reason,
                         alert_triggered=False,
                         prediction_timestamp=datetime.utcnow()
                     )
                     db.add(ml_anomaly_rec)
                     db.flush()
            except Exception as ml_err:
                 logger.warning(f"Failed to run ML prediction during ingestion: {ml_err}")
        
        # Update device last_seen
        if device:
            device.last_seen = datetime.utcnow()
            device.status = "online"
        
        # Check for alerts (primary rule-based)
        alert_severity = alert_manager.get_alert_severity(quality_score)
        alert = None
        if alert_severity:
            alert_message = alert_manager.get_alert_message(quality_score, anomaly_flags)
            alert = Alert(
                device_id=device_id,
                severity=alert_severity,
                message=alert_message,
                triggered_at=datetime.utcnow(),
                reading_timestamp=request.timestamp,
            )
            db.add(alert)
            logger.warning(f"Alert for {device_id}: {alert_message}")
            db.flush()
            
        # Link ML anomaly to triggered alert if active
        if settings.ml_service_enabled and 'ml_anomaly_rec' in locals() and is_anomaly:
            # If a rule-based alert was triggered, link it; otherwise create a warnings alert
            if alert:
                ml_anomaly_rec.alert_triggered = True
                ml_anomaly_rec.alert_id = alert.id
            else:
                alert_message = f"ML WARNING: Anomaly predicted with {score:.2f} confidence"
                ml_warn = Alert(
                    device_id=device_id,
                    severity="warning",
                    message=alert_message,
                    triggered_at=datetime.utcnow(),
                    reading_timestamp=request.timestamp,
                )
                db.add(ml_warn)
                db.flush()
                ml_anomaly_rec.alert_triggered = True
                ml_anomaly_rec.alert_id = ml_warn.id
        
        db.commit()

        # Invalidate cache for this device
        try:
            invalidated = cache.invalidate_device(device_id)
            if invalidated:
                logger.info(f"Invalidated {invalidated} cache keys for {device_id}")
        except Exception:
            pass

        # Broadcast new reading to WebSocket clients (async, non-blocking)
        try:
            import asyncio
            payload = {
                "type": "reading",
                "device_id": device_id,
                "quality_score": quality_score,
                "timestamp": sensor_data.timestamp.isoformat(),
                "values": {
                    "ph": sensor_data.ph,
                    "turbidity": sensor_data.turbidity,
                    "tds": sensor_data.tds,
                    "temperature": sensor_data.temperature,
                    "flow_rate": sensor_data.flow_rate,
                }
            }
            asyncio.create_task(ws_manager.broadcast_json(payload))
        except Exception:
            pass

        # After commit, attempt to send notification (non-blocking)
        try:
            from ..notifications import send_alert_notification
            if alert_severity and alert:
                try:
                    send_alert_notification(db, alert)
                except Exception as e:
                    logger.warning(f"Notification sending failed: {e}")
        except Exception:
            pass
        
        logger.info(
            f"Ingested reading from {device_id} (score: {quality_score}, "
            f"trace_id: {trace_id})"
        )
        
        return DataIngestionResponse(ok=True, accepted=1, rejected=0)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting sensor data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/{device_id}", response_model=DataQueryResponse)
async def get_device_data(
    device_id: str,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    from_time: Optional[datetime] = Query(None),
    to_time: Optional[datetime] = Query(None),
):
    """GET /data/:device_id with optional Redis caching for paginated queries."""
    cache_key = f"device:{device_id}:data:{skip}:{limit}:{from_time}:{to_time}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        query = db.query(SensorData).filter(SensorData.device_id == device_id)
        
        if from_time:
            query = query.filter(SensorData.timestamp >= from_time)
        if to_time:
            query = query.filter(SensorData.timestamp <= to_time)
        
        total = query.count()
        readings = query.order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
        result = DataQueryResponse(
            device_id=device_id,
            readings=[SensorDataResponse.model_validate(r) for r in readings],
            total=total
        )
        # Cache short-lived
        try:
            cache.set(cache_key, result.model_dump(), ex=30)
        except Exception:
            pass
        return result
    except Exception as e:
        logger.error(f"Error querying device data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict", response_model=MLPredictionResponse)
async def predict_anomaly(
    request: MLPredictionRequest,
    db: Session = Depends(get_db),
):
    """
    POST /predict
    Predict if a sensor reading is anomalous using ML ensemble (Phase 2+).
    Status: Research phase, not for primary alerts yet.
    """
    if not settings.ml_service_enabled:
        raise HTTPException(
            status_code=503,
            detail="ML service not enabled. Use rule-based scoring instead."
        )
    
    try:
        payload = {
            "device_id": request.device_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "data": {
                "ph": request.ph,
                "hardness": request.hardness,
                "solids": request.solids,
                "chloramines": request.chloramines,
                "sulfate": request.solids, # Wait, is solids map to sulfate in original ML service? Keep it exact as in original code.
                # Actually original code had:
                # "ph": request.ph,
                # "hardness": request.hardness,
                # "solids": request.solids,
                # "chloramines": request.chloramines,
                # "sulfate": request.sulfate,
                # "conductivity": request.conductivity,
                # "organic_carbon": request.organic_carbon,
                # "trihalomethanes": request.trihalomethanes,
                # "turbidity": request.turbidity
            }
        }
        # Wait, let's copy the payload construction from original code exactly!
        # Original was:
        # "ph": request.ph,
        # "hardness": request.hardness,
        # "solids": request.solids,
        # "chloramines": request.chloramines,
        # "sulfate": request.sulfate,
        # "conductivity": request.conductivity,
        # "organic_carbon": request.organic_carbon,
        # "trihalomethanes": request.trihalomethanes,
        # "turbidity": request.turbidity
        payload["data"]["sulfate"] = request.sulfate
        payload["data"]["conductivity"] = request.conductivity
        payload["data"]["organic_carbon"] = request.organic_carbon
        payload["data"]["trihalomethanes"] = request.trihalomethanes
        payload["data"]["turbidity"] = request.turbidity
        
        headers = {}
        if settings.ml_service_api_key:
            headers["x-api-key"] = settings.ml_service_api_key
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ml_service_url}/predict",
                json=payload,
                headers=headers,
                timeout=5.0
            )
            
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"ML Service error: {response.text}")
            
        res_data = response.json()
        prediction = res_data.get("prediction", 0)
        score = res_data.get("score", 0.0)
        model_version = res_data.get("model_version", "unknown")
        
        is_anomaly = (prediction == 1) and (score >= settings.ml_confidence_threshold)
        decision_reason = f"ML anomaly prediction (prediction: {prediction}, score: {score:.2f}, version: {model_version})"
        
        return MLPredictionResponse(
            device_id=request.device_id,
            is_anomaly=is_anomaly,
            confidence=score,
            ml_score=prediction,
            timestamp=datetime.utcnow(),
            model_version=model_version,
            decision_reason=decision_reason
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ML prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
