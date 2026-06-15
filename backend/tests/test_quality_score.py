"""Test quality scoring module."""
import pytest
from app.quality_score import QualityScorer, AlertManager


class TestQualityScoring:
    """Test quality score calculation."""
    
    def test_perfect_water_quality(self):
        """Test perfect water quality scores 100."""
        data = {
            "ph": 7.0,
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score == 100
    
    def test_high_ph_penalty(self):
        """Test high pH reduces score."""
        data = {
            "ph": 9.0,  # Out of safe range (6.5-8.5)
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score < 100
        assert score > 50  # Should still be warning level
    
    def test_low_ph_penalty(self):
        """Test low pH reduces score."""
        data = {
            "ph": 5.5,  # Out of safe range (6.5-8.5)
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score < 100
    
    def test_high_turbidity_penalty(self):
        """Test high turbidity (most critical) reduces score significantly."""
        data = {
            "ph": 7.0,
            "turbidity": 10.0,  # Double the safe limit (5 NTU)
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        # Turbidity penalty is 30 points when exceeded
        # Score: 100 - 30 = 70
        assert score == 70
    
    def test_severe_turbidity_multiple_penalties(self):
        """Test multiple penalties compound together."""
        data = {
            "ph": 9.0,  # Out of range - penalty
            "turbidity": 10.0,  # Penalty: 30
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        # pH penalty (9.0, safe 6.5-8.5) + turbidity 30
        # Should be < 70
        assert score < 70
    
    def test_high_tds_penalty(self):
        """Test high TDS reduces score."""
        data = {
            "ph": 7.0,
            "turbidity": 1.0,
            "tds": 500,  # Above safe limit (300)
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score < 100
    
    def test_high_temperature_penalty(self):
        """Test extreme temperature reduces score."""
        data = {
            "ph": 7.0,
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 50.0,  # Above safe range (5-45°C)
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score < 100
    
    def test_combined_penalties(self):
        """Test combined penalties stack correctly."""
        data = {
            "ph": 9.0,  # Penalty
            "turbidity": 8.0,  # Penalty (most critical)
            "tds": 400,  # Penalty
            "temperature": 50.0,  # Penalty
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        score = scorer.calculate_score(data)
        
        assert score < 30  # Should be emergency level


class TestAnomalyDetection:
    """Test anomaly detection methods."""
    
    def test_out_of_range_anomaly(self):
        """Test out-of-range detection."""
        data = {
            "ph": 15.0,  # Way out of range (0-14)
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        # Just test the internal method
        result = scorer._is_out_of_range(data)
        assert result is True
    
    def test_no_anomalies_normal_data(self):
        """Test no anomalies for normal data."""
        data = {
            "ph": 7.0,
            "turbidity": 2.0,
            "tds": 200,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        
        scorer = QualityScorer()
        result = scorer._is_out_of_range(data)
        assert result is False


class TestAlertManager:
    """Test alert severity mapping."""
    
    def test_emergency_alert_low_score(self):
        """Test low score triggers emergency alert."""
        manager = AlertManager()
        severity = manager.get_alert_severity(5)
        
        assert severity == "emergency"
    
    def test_critical_alert_mid_score(self):
        """Test mid-range score triggers critical alert."""
        manager = AlertManager()
        severity = manager.get_alert_severity(25)
        
        assert severity == "critical"
    
    def test_warning_alert_high_score(self):
        """Test high score triggers warning alert."""
        manager = AlertManager()
        severity = manager.get_alert_severity(45)
        
        assert severity == "warning"
    
    def test_no_alert_excellent_score(self):
        """Test excellent score produces no alert."""
        manager = AlertManager()
        severity = manager.get_alert_severity(95)
        
        assert severity is None or severity == "ok"
    
    def test_alert_message_generation(self):
        """Test alert message is generated correctly."""
        manager = AlertManager()
        message = manager.get_alert_message(
            quality_score=25,
            anomaly_flags={"reasons": ["pH > 10"]}
        )
        
        assert message is not None
        assert "25" in message or "critical" in message.lower()
