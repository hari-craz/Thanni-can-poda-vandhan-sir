"""Simple test runner to validate backend components."""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_imports():
    """Test that all modules can be imported."""
    print("\n" + "="*70)
    print("TESTING IMPORTS")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    modules = [
        ('app.database', 'Database ORM'),
        ('app.schemas', 'Pydantic Schemas'),
        ('app.config', 'Configuration'),
        ('app.auth', 'Authentication'),
        ('app.quality_score', 'Quality Scoring'),
        ('app.rate_limiter', 'Rate Limiting'),
        ('app.main', 'FastAPI App'),
    ]
    
    for module_name, description in modules:
        try:
            __import__(module_name)
            print(f"✓ {description:30} ({module_name})")
            tests_passed += 1
        except Exception as e:
            print(f"✗ {description:30} ({module_name})")
            print(f"  Error: {str(e)[:100]}")
            tests_failed += 1
    
    return tests_passed, tests_failed


def test_auth_module():
    """Test authentication functions."""
    print("\n" + "="*70)
    print("TESTING AUTHENTICATION MODULE")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        from app.auth import hash_api_key
        
        # Test hashing
        key1 = hash_api_key("test_key")
        key2 = hash_api_key("test_key")
        
        if key1 != key2 and len(key1) > 20:
            print("✓ API key hashing (generates unique hashes)")
            tests_passed += 1
        else:
            print("✗ API key hashing (hashes should be unique)")
            tests_failed += 1
            
    except Exception as e:
        print(f"✗ Authentication module error: {str(e)}")
        tests_failed += 1
    
    return tests_passed, tests_failed


def test_quality_score_module():
    """Test quality scoring functions."""
    print("\n" + "="*70)
    print("TESTING QUALITY SCORE MODULE")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        from app.quality_score import QualityScorer, AlertManager
        
        scorer = QualityScorer()
        
        # Test 1: Perfect water quality
        data_perfect = {
            "ph": 7.0,
            "turbidity": 1.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        score = scorer.calculate_score(data_perfect)
        if score == 100:
            print("✓ Perfect water quality scores 100")
            tests_passed += 1
        else:
            print(f"✗ Perfect water quality (expected 100, got {score})")
            tests_failed += 1
        
        # Test 2: High turbidity penalty
        data_bad = {
            "ph": 7.0,
            "turbidity": 10.0,
            "tds": 100,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        score = scorer.calculate_score(data_bad)
        if score == 70:  # Turbidity penalty is 30: 100 - 30 = 70
            print(f"✓ High turbidity reduces score correctly (score: {score})")
            tests_passed += 1
        else:
            print(f"✗ High turbidity penalty (expected 70, got {score})")
            tests_failed += 1
        
        # Test 3: Multiple penalties compound
        data_multiple = {
            "ph": 9.0,
            "turbidity": 10.0,
            "tds": 400,
            "temperature": 25.0,
            "flow_rate": 5.0
        }
        score_multiple = scorer.calculate_score(data_multiple)
        if score_multiple < 70:
            print(f"✓ Multiple penalties compound (score: {score_multiple})")
            tests_passed += 1
        else:
            print(f"✗ Multiple penalties (expected <70, got {score_multiple})")
            tests_failed += 1
        
        # Test 4: Alert severity
        manager = AlertManager()
        severity = manager.get_alert_severity(25)
        if severity == "critical":
            print("✓ Alert severity mapping works (25 -> critical)")
            tests_passed += 1
        else:
            print(f"✗ Alert severity (expected 'critical', got '{severity}')")
            tests_failed += 1
            
    except Exception as e:
        print(f"✗ Quality score module error: {str(e)}")
        tests_failed += 1
    
    return tests_passed, tests_failed


def test_database_models():
    """Test database ORM models."""
    print("\n" + "="*70)
    print("TESTING DATABASE MODELS")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        from app.database import Base, Device, APIKey, SensorData, Alert, AuditLog
        
        models = [
            ('Device', Device),
            ('APIKey', APIKey),
            ('SensorData', SensorData),
            ('Alert', Alert),
            ('AuditLog', AuditLog),
        ]
        
        for name, model_class in models:
            if hasattr(model_class, '__tablename__'):
                print(f"✓ {name:15} model defined")
                tests_passed += 1
            else:
                print(f"✗ {name:15} model missing __tablename__")
                tests_failed += 1
                
    except Exception as e:
        print(f"✗ Database models error: {str(e)}")
        tests_failed += 1
    
    return tests_passed, tests_failed


def test_config():
    """Test configuration system."""
    print("\n" + "="*70)
    print("TESTING CONFIGURATION SYSTEM")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        from app.config import Settings
        
        config = Settings()
        
        # Test key settings exist
        settings_to_check = [
            ('database_url', str),
            ('api_host', str),
            ('api_port', int),
            ('quality_score_safe_ph_min', (int, float)),
            ('quality_score_safe_turbidity_max', (int, float)),
        ]
        
        for setting_name, expected_type in settings_to_check:
            if hasattr(config, setting_name):
                value = getattr(config, setting_name)
                if isinstance(value, expected_type):
                    print(f"✓ Config setting '{setting_name}' exists and valid")
                    tests_passed += 1
                else:
                    print(f"✗ Config setting '{setting_name}' type mismatch")
                    tests_failed += 1
            else:
                print(f"✗ Config setting '{setting_name}' missing")
                tests_failed += 1
                
    except Exception as e:
        print(f"✗ Configuration system error: {str(e)}")
        tests_failed += 1
    
    return tests_passed, tests_failed


def test_schemas():
    """Test Pydantic schemas."""
    print("\n" + "="*70)
    print("TESTING PYDANTIC SCHEMAS")
    print("="*70)
    
    tests_passed = 0
    tests_failed = 0
    
    try:
        from app.schemas import SensorDataIngestionRequest, DataIngestionResponse
        
        # Test valid data passes validation
        valid_data = {
            "device_id": "HYDRO_001",
            "timestamp": "2026-06-15T13:00:00Z",
            "timestamp_source": "device",
            "ph": 7.0,
            "turbidity": 2.0,
            "tds": 200,
            "temperature": 25.0,
            "flow_rate": 5.0,
            "device_reset_count": 0,
            "seq_no": 1
        }
        
        request = SensorDataIngestionRequest(**valid_data)
        if request.device_id == "HYDRO_001":
            print("✓ SensorDataIngestionRequest validates correctly")
            tests_passed += 1
        else:
            print("✗ SensorDataIngestionRequest validation failed")
            tests_failed += 1
        
        # Test invalid device_id is rejected
        try:
            invalid_data = valid_data.copy()
            invalid_data["device_id"] = "INVALID_ID"
            request = SensorDataIngestionRequest(**invalid_data)
            print("✗ Invalid device_id should be rejected")
            tests_failed += 1
        except Exception:
            print("✓ Invalid device_id correctly rejected")
            tests_passed += 1
        
    except Exception as e:
        print(f"✗ Schema validation error: {str(e)}")
        tests_failed += 1
    
    return tests_passed, tests_failed


def main():
    """Run all tests."""
    print("\n")
    print("=" * 70)
    print(" " * 15 + "BACKEND VALIDATION TEST SUITE")
    print("=" * 70)
    
    total_passed = 0
    total_failed = 0
    
    # Run all test suites
    test_suites = [
        ("Module Imports", test_imports),
        ("Authentication", test_auth_module),
        ("Quality Scoring", test_quality_score_module),
        ("Database Models", test_database_models),
        ("Configuration", test_config),
        ("Pydantic Schemas", test_schemas),
    ]
    
    for suite_name, test_func in test_suites:
        try:
            passed, failed = test_func()
            total_passed += passed
            total_failed += failed
        except Exception as e:
            print(f"\n✗ {suite_name} suite error: {str(e)}")
            total_failed += 1
    
    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"✓ Tests Passed: {total_passed}")
    print(f"✗ Tests Failed: {total_failed}")
    print(f"  Total Tests:  {total_passed + total_failed}")
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total_failed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit(main())
