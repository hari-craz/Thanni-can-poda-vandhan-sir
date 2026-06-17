"""
Data ingestion handler for Hydronix v2.0.0 (HTTPS-only, no MQTT).

All device data arrives via HTTPS POST to /data or /ingest endpoints.
MQTT has been removed in favor of Cloudflare Tunnel HTTPS transport.
"""
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from .database import SensorData, Device
from .quality_score import QualityScorer

logger = logging.getLogger(__name__)


def ingest_sensor_data(
    db: Session,
    device_id: str,
    timestamp: datetime,
    ph: float,
    turbidity: float,
    tds: float,
    temperature: float,
    flow_rate: float,
    trace_id: Optional[str] = None,
    **kwargs
) -> Optional[SensorData]:
    """
    Ingest a sensor reading from a device via HTTPS.
    Applies quality scoring and anomaly detection.
    
    Args:
        db: Database session
        device_id: Device identifier (HYDRO_###)
        timestamp: Timestamp of reading (ISO 8601, UTC)
        ph: pH reading
        turbidity: Turbidity in NTU
        tds: Total dissolved solids in ppm
        temperature: Temperature in Celsius
        flow_rate: Flow rate in L/min
        trace_id: Optional trace ID for debugging
        **kwargs: Additional fields (device_reset_count, seq_no, etc.)
    
    Returns:
        SensorData object if ingestion successful, None otherwise
    """
    try:
        # Verify device exists and is active
        device = db.query(Device).filter_by(device_id=device_id).first()
        if not device:
            logger.warning(f"Ingest: Device {device_id} not found")
            return None
        
        if not device.is_active:
            logger.warning(f"Ingest: Device {device_id} is inactive")
            return None
        
        # Update device status
        device.status = "online"
        device.last_seen = datetime.utcnow()
        device.last_heartbeat = datetime.utcnow()
        
        # Calculate quality score
        scorer = QualityScorer()
        quality_score = scorer.calculate_score({
            "ph": ph,
            "turbidity": turbidity,
            "tds": tds,
            "temperature": temperature,
            "flow_rate": flow_rate
        })
        
        # Create sensor data record
        sensor_data = SensorData(
            device_id=device_id,
            timestamp=timestamp,
            received_at=datetime.utcnow(),
            timestamp_source=kwargs.get("timestamp_source", "device"),
            ph=ph,
            turbidity=turbidity,
            tds=tds,
            temperature=temperature,
            flow_rate=flow_rate,
            quality_score=quality_score,
            trace_id=trace_id,
            device_reset_count=kwargs.get("device_reset_count", 0),
            seq_no=kwargs.get("seq_no"),
            valve_state=kwargs.get("valve_state"),
        )
        
        db.add(device)
        db.add(sensor_data)
        db.commit()
        db.refresh(sensor_data)
        
        logger.info(
            f"Ingest: {device_id} quality={quality_score} "
            f"ph={ph:.1f} turbidity={turbidity:.1f} tds={tds:.0f} "
            f"temp={temperature:.1f} (trace_id={trace_id})"
        )
        
        return sensor_data
        
    except Exception as e:
        logger.exception(f"Ingest error for {device_id}: {e}")
        db.rollback()
        return None
