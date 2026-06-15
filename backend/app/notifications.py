"""
Notification helper module.
- Email notifications via SMTP (optional, controlled by config.smtp_host)
- Slack webhook notifications (optional, controlled by config.slack_webhook_url)
- Twilio SMS notifications (optional, controlled by Twilio config settings)
- Deduplication using recent alerts (cooldown window)
- Simple escalation: include escalation level in subject/body
"""
import smtplib
import logging
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Optional
import httpx

from .config import settings
from .database import Alert

logger = logging.getLogger(__name__)


def _should_send(db, device_id: str, severity: str) -> bool:
    """Return True if we should send notification for this device/severity based on cooldown."""
    cooldown = timedelta(minutes=settings.notification_cooldown_minutes)
    cutoff = datetime.utcnow() - cooldown
    recent = db.query(Alert).filter(
        Alert.device_id == device_id,
        Alert.severity == severity,
        Alert.triggered_at >= cutoff
    ).count()
    # If recent > 0 then similar alert was sent recently; skip
    return recent == 0


def _send_email(subject: str, body: str, to: Optional[str] = None) -> bool:
    """Send an email via configured SMTP. Returns True on success."""
    if not settings.smtp_host:
        logger.debug("SMTP host not configured; skipping email send")
        return False

    msg = EmailMessage()
    msg["From"] = settings.notification_email_from
    msg["To"] = to or settings.notification_email_to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        if settings.smtp_username and settings.smtp_password:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
        server.send_message(msg)
        server.quit()
        logger.info(f"Notification email sent to {msg['To']}: {subject}")
        return True
    except Exception as e:
        logger.warning(f"Failed to send notification email: {e}")
        return False


def _send_slack(message: str) -> bool:
    """Send alert message to Slack webhook. Returns True on success."""
    if not settings.slack_webhook_url:
        return False
    try:
        response = httpx.post(
            settings.slack_webhook_url,
            json={"text": message},
            timeout=10.0
        )
        if response.status_code in (200, 201):
            logger.info("Alert notification sent to Slack")
            return True
        else:
            logger.warning(f"Failed to send Slack alert, status: {response.status_code}, body: {response.text}")
            return False
    except Exception as e:
        logger.exception(f"Error sending Slack alert: {e}")
        return False


def _send_sms(message: str) -> bool:
    """Send alert message via Twilio SMS. Returns True on success."""
    if not (settings.twilio_account_sid and 
            settings.twilio_auth_token and 
            settings.twilio_phone_from and 
            settings.twilio_phone_to):
        return False
    
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    data = {
        "From": settings.twilio_phone_from,
        "To": settings.twilio_phone_to,
        "Body": message
    }
    try:
        response = httpx.post(
            url,
            data=data,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=10.0
        )
        if response.status_code in (200, 201):
            logger.info("Alert SMS notification sent via Twilio")
            return True
        else:
            logger.warning(f"Failed to send Twilio SMS, status: {response.status_code}, body: {response.text}")
            return False
    except Exception as e:
        logger.exception(f"Error sending Twilio SMS: {e}")
        return False


def send_alert_notification(db, alert: Alert) -> bool:
    """High-level: check dedupe, build message, and send notification(s)."""
    try:
        device_id = alert.device_id
        severity = alert.severity

        if not _should_send(db, device_id, severity):
            logger.info(f"Skipping notification for {device_id} ({severity}) due to cooldown")
            return False

        subject = f"Hydronix Alert: {device_id} -> {severity.upper()}"
        body = (
            f"Device: {device_id}\n"
            f"Severity: {severity}\n"
            f"Triggered at: {alert.triggered_at.isoformat()}\n"
            f"Message:\n{alert.message}\n\n"
            f"Escalation level: {alert.escalation_level}\n"
        )

        sent_any = False

        # Send Email
        if _send_email(subject, body):
            sent_any = True

        # Send Slack Webhook
        if settings.slack_webhook_url:
            if _send_slack(body):
                sent_any = True

        # Send Twilio SMS
        if (settings.twilio_account_sid and 
            settings.twilio_auth_token and 
            settings.twilio_phone_from and 
            settings.twilio_phone_to):
            if _send_sms(body):
                sent_any = True

        if sent_any:
            logger.info(f"Notification sent successfully for alert {alert.id}")
        return sent_any
    except Exception as e:
        logger.exception(f"Error sending alert notification: {e}")
        return False

