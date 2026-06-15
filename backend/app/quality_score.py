"""
Rule-based quality scoring and anomaly detection logic.
Based on Backend-Spec.md quality score thresholds.
"""
from typing import Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .database import SensorData
from .config import settings


class QualityScorer:
    """Calculate water quality score based on sensor readings."""
    
    # Penalty for out-of-range readings
    PH_PENALTY_PER_STEP = 20  # Points per 0.5 deviation
    TURBIDITY_PENALTY = 30  # More critical
    TDS_PENALTY = 15
    TEMPERATURE_PENALTY_PER_STEP = 10
    
    # Anomaly penalties
    OUT_OF_RANGE_PENALTY = 10
    STUCK_SENSOR_PENALTY = 25
    OUTLIER_PENALTY = 20
    
    START_SCORE = 100
    MIN_SCORE = 0
    MAX_SCORE = 100
    
    def __init__(self, config=None):
        """Initialize with config (defaults to settings)."""
        self.config = config or settings
    
    def calculate_score(self, reading: Dict[str, Any]) -> int:
        """
        Calculate quality score for a single reading.
        Returns score 0-100.
        """
        score = self.START_SCORE
        
        # pH penalty
        ph = reading.get('ph')
        if ph is not None:
            if ph < self.config.quality_score_safe_ph_min:
                deviation = self.config.quality_score_safe_ph_min - ph
                penalty = int((deviation / 0.5) * self.PH_PENALTY_PER_STEP)
                score -= min(penalty, 40)  # Cap at -40
            elif ph > self.config.quality_score_safe_ph_max:
                deviation = ph - self.config.quality_score_safe_ph_max
                penalty = int((deviation / 0.5) * self.PH_PENALTY_PER_STEP)
                score -= min(penalty, 40)  # Cap at -40
        
        # Turbidity penalty (more critical)
        turbidity = reading.get('turbidity')
        if turbidity is not None and turbidity > self.config.quality_score_safe_turbidity_max:
            score -= self.TURBIDITY_PENALTY
        
        # TDS penalty
        tds = reading.get('tds')
        if tds is not None and tds > self.config.quality_score_safe_tds_max:
            score -= self.TDS_PENALTY
        
        # Temperature penalty
        temperature = reading.get('temperature')
        if temperature is not None:
            if temperature < self.config.quality_score_safe_temperature_min:
                deviation = self.config.quality_score_safe_temperature_min - temperature
                penalty = int(deviation * self.TEMPERATURE_PENALTY_PER_STEP / 5)
                score -= min(penalty, 20)
            elif temperature > self.config.quality_score_safe_temperature_max:
                deviation = temperature - self.config.quality_score_safe_temperature_max
                penalty = int(deviation * self.TEMPERATURE_PENALTY_PER_STEP / 5)
                score -= min(penalty, 20)
        
        # Clamp to valid range
        return max(self.MIN_SCORE, min(self.MAX_SCORE, score))
    
    def detect_anomalies(
        self,
        reading: Dict[str, Any],
        device_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Detect anomalies in a reading (stuck sensor, outlier, out-of-range).
        Returns anomaly_flags dict.
        """
        flags = {
            "out_of_range": False,
            "stuck": False,
            "outlier": False,
            "reasons": []
        }
        
        # 1. Out-of-range detection
        if self._is_out_of_range(reading):
            flags["out_of_range"] = True
            flags["reasons"].append("Reading out of safe range")
        
        # 2. Stuck sensor detection (no change for 24 hours)
        if self._is_stuck_sensor(device_id, db):
            flags["stuck"] = True
            flags["reasons"].append("Sensor readings unchanged for 24 hours")
        
        # 3. Statistical outlier detection (3σ from fleet average)
        if self._is_outlier(reading, device_id, db):
            flags["outlier"] = True
            flags["reasons"].append("Reading is 3σ outlier from fleet")
        
        return flags
    
    def _is_out_of_range(self, reading: Dict[str, Any]) -> bool:
        """Check if reading is outside safe ranges."""
        ph = reading.get('ph')
        if ph and (ph < 0 or ph > 14):
            return True
        
        turbidity = reading.get('turbidity')
        if turbidity and turbidity < 0:
            return True
        
        tds = reading.get('tds')
        if tds and tds < 0:
            return True
        
        temperature = reading.get('temperature')
        if temperature and (temperature < -50 or temperature > 150):
            return True
        
        flow_rate = reading.get('flow_rate')
        if flow_rate and flow_rate < 0:
            return True
        
        return False
    
    def _is_stuck_sensor(self, device_id: str, db: Session) -> bool:
        """Check if sensor readings have been unchanged for 24 hours."""
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        readings = db.query(SensorData).filter(
            SensorData.device_id == device_id,
            SensorData.timestamp >= cutoff_time
        ).order_by(SensorData.timestamp.desc()).limit(2).all()
        
        if len(readings) < 2:
            return False
        
        latest = readings[0]
        previous = readings[1]
        
        # Check if all sensor values are identical
        return (
            latest.ph == previous.ph and
            latest.turbidity == previous.turbidity and
            latest.tds == previous.tds and
            latest.temperature == previous.temperature and
            latest.flow_rate == previous.flow_rate
        )
    
    def _is_outlier(self, reading: Dict[str, Any], device_id: str, db: Session) -> bool:
        """
        Check if reading is a statistical outlier (>3σ from fleet average).
        Fleet = all active devices.
        """
        # Get last 100 readings from all active devices
        recent_readings = db.query(SensorData).filter(
            SensorData.timestamp >= datetime.utcnow() - timedelta(hours=1)
        ).all()
        
        if len(recent_readings) < 10:
            return False  # Not enough data for statistical test
        
        # Check pH outlier
        ph = reading.get('ph')
        if ph and self._is_value_outlier(ph, [r.ph for r in recent_readings if r.ph]):
            return True
        
        # Check turbidity outlier
        turbidity = reading.get('turbidity')
        if turbidity and self._is_value_outlier(turbidity, [r.turbidity for r in recent_readings if r.turbidity]):
            return True
        
        return False
    
    def _is_value_outlier(self, value: float, fleet_values: list) -> bool:
        """Check if value is >3σ from mean of fleet."""
        if not fleet_values:
            return False
        
        import statistics
        mean = statistics.mean(fleet_values)
        stdev = statistics.stdev(fleet_values)
        
        if stdev == 0:
            return False
        
        z_score = abs((value - mean) / stdev)
        return z_score > 3


class AlertManager:
    """Manage alert generation based on quality scores."""
    
    def __init__(self, config=None):
        """Initialize with config."""
        self.config = config or settings
    
    def get_alert_severity(self, quality_score: int) -> str:
        """Determine alert severity based on quality score."""
        if quality_score < self.config.alert_threshold_emergency:
            return "emergency"
        elif quality_score < self.config.alert_threshold_critical:
            return "critical"
        elif quality_score < self.config.alert_threshold_warning:
            return "warning"
        return None  # No alert
    
    def get_alert_message(self, quality_score: int, anomaly_flags: Dict) -> str:
        """Generate a human-readable alert message."""
        reasons = anomaly_flags.get("reasons", [])
        reason_str = "; ".join(reasons) if reasons else "Quality score below threshold"
        
        severity = self.get_alert_severity(quality_score)
        return f"{severity.upper()}: {reason_str} (score: {quality_score}/100)"
