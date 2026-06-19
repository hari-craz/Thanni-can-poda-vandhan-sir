import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db, SensorData, Alert, AuditLog
from ..schemas import (
    AnomaliesListResponse,
    AnomalyResponse,
    AlertsListResponse,
    AlertResponse,
    AlertAcknowledgementRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["alerts"])


@router.get("/anomalies", response_model=AnomaliesListResponse)
async def get_anomalies(
    db: Session = Depends(get_db),
    device_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    GET /anomalies
    Get readings flagged as anomalous by rule engine or ML.
    """
    try:
        query = db.query(SensorData).filter(SensorData.anomaly_flags != None)
        
        if device_id:
            query = query.filter(SensorData.device_id == device_id)
        
        total = query.count()
        anomalies = query.order_by(SensorData.timestamp.desc()).offset(skip).limit(limit).all()
        
        result_anomalies = []
        for reading in anomalies:
            result_anomalies.append(AnomalyResponse(
                id=reading.id,
                device_id=reading.device_id,
                timestamp=reading.timestamp,
                values={
                    "ph": reading.ph,
                    "turbidity": reading.turbidity,
                    "tds": reading.tds,
                    "temperature": reading.temperature,
                    "flow_rate": reading.flow_rate,
                },
                anomaly_flags=reading.anomaly_flags or {}
            ))
        
        return AnomaliesListResponse(anomalies=result_anomalies, total=total)
    
    except Exception as e:
        logger.error(f"Error querying anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts", response_model=AlertsListResponse)
async def get_alerts(
    db: Session = Depends(get_db),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    GET /alerts
    Get alerts by severity/status (for escalation workflow).
    """
    try:
        query = db.query(Alert)
        
        if severity:
            query = query.filter(Alert.severity == severity)
        
        if status == "pending":
            query = query.filter(Alert.acknowledged_at == None)
        elif status == "acknowledged":
            query = query.filter(Alert.acknowledged_at != None)
        
        total = query.count()
        alerts = query.order_by(Alert.triggered_at.desc()).offset(skip).limit(limit).all()
        
        result_alerts = []
        for alert in alerts:
            minutes_unack = None
            if alert.acknowledged_at is None:
                minutes_unack = int((datetime.utcnow() - alert.triggered_at).total_seconds() / 60)
            
            result_alerts.append(AlertResponse(
                id=alert.id,
                device_id=alert.device_id,
                severity=alert.severity,
                message=alert.message,
                triggered_at=alert.triggered_at,
                reading_timestamp=alert.reading_timestamp,
                acknowledged_at=alert.acknowledged_at,
                acknowledged_by=alert.acknowledged_by,
                minutes_unacknowledged=minutes_unack,
            ))
        
        return AlertsListResponse(alerts=result_alerts, total=total)
    
    except Exception as e:
        logger.error(f"Error querying alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    request: AlertAcknowledgementRequest,
    db: Session = Depends(get_db),
):
    """
    POST /alerts/:id/acknowledge
    Mark an alert as acknowledged by user.
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = request.user_id
        alert.acknowledgement_message = request.acknowledgement_message
        
        # Audit log
        audit_log = AuditLog(
            action="acknowledge_alert",
            resource_type="alert",
            resource_id=str(alert_id),
            user_id=request.user_id,
            details={
                "device_id": alert.device_id,
                "message": request.acknowledgement_message,
            }
        )
        db.add(audit_log)
        db.commit()
        
        logger.info(f"Alert {alert_id} acknowledged by {request.user_id}")
        
        return {"ok": True, "acknowledged_at": alert.acknowledged_at}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
