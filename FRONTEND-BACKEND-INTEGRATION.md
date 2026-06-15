# Frontend-Backend Integration Guide

## Current Status

### Frontend ✅ (Phase 1 Complete)
- Next.js 14 with TypeScript
- Zustand state management
- Tailwind CSS styling
- Authentication flow with JWT
- 5 main pages (login, devices, device detail, alerts, settings)
- Axios HTTP client with interceptors
- Running on http://localhost:3000

### Backend ✅ (70% Complete)
- FastAPI with 13 endpoints
- SQLAlchemy ORM with 5 models
- API key authentication
- Quality scoring and anomaly detection
- Rate limiting (Redis)
- Comprehensive test suite (24/24 tests passing)
- Ready for deployment
- Running on http://localhost:8000

## Integration Checklist

### Phase 1: Core API Endpoints (Week 2)

**1. Device Endpoints**
```bash
# GET /devices - List all devices
✓ Backend ready
- Frontend: Replace mock data in devices/page.tsx
- Action: Call api.get('/devices') on component mount

# GET /devices/{device_id} - Get single device
✓ Backend ready
- Frontend: Call api.get(`/devices/${params.id}`) in device detail page

# POST /devices - Create device
⚠️ Needs user authentication first
- Backend: Implement JWT user auth
- Frontend: Call api.post('/devices', deviceData)

# PUT /devices/{device_id} - Update device
✓ Backend ready
- Frontend: Call api.put(`/devices/${id}`, updates)
```

**2. Sensor Data Endpoints**
```bash
# POST /data - Ingest sensor readings
✓ Backend ready
- Testing: Use ESP32 or test client to send data

# GET /data/{device_id} - Get readings for device
✓ Backend ready
- Frontend: Fetch with time range: /data/HYDRO_001?start=2024-01-01&end=2024-12-31

# GET /data/latest/{device_id} - Get latest reading
✓ Backend ready (via /devices/{id}/latest endpoint)
- Frontend: Real-time updates in device detail
```

**3. Alerts Endpoints**
```bash
# GET /alerts - List active alerts
✓ Backend ready
- Frontend: Display in alerts/page.tsx

# POST /alerts/{id}/acknowledge - Acknowledge alert
✓ Backend ready
- Frontend: Add button to AlertCard component
```

### Phase 2: Real-Time Features (Week 3)

**1. WebSocket Integration**
```javascript
// Backend ready but not yet implemented in production
// docs/Backend-Spec.md specifies /ws endpoint
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update device readings in real-time
};
```

**2. MQTT Integration** (Optional for Phase 1)
```python
# Backend supports MQTT but needs Docker setup
# See docker-compose.yml for MQTT broker config
```

## Step-by-Step Integration

### Step 1: Start Backend
```bash
cd backend
pip install -r requirements.txt

# For development with hot reload:
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or with Docker:
docker-compose up -d
```

### Step 2: Verify Backend is Running
```bash
curl http://localhost:8000/health
# Response: {"status": "healthy", "timestamp": "2024-06-15T..."}
```

### Step 3: Test Backend API
```bash
# Create a test device
curl -X POST http://localhost:8000/devices \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "HYDRO_TEST_001",
    "name": "Test Device",
    "location": "Lab",
    "firmware_version": "2.1.0"
  }'

# Send test sensor data
curl -X POST http://localhost:8000/data \
  -H "Content-Type: application/json" \
  -H "X-API-Key: hydro_HYDRO_TEST_001_testtoken123" \
  -d '{
    "device_id": "HYDRO_TEST_001",
    "timestamp": "2024-06-15T14:00:00Z",
    "ph": 7.2,
    "turbidity": 2.5,
    "tds": 245,
    "temperature": 22.5,
    "flow_rate": 5.3
  }'

# Fetch devices
curl http://localhost:8000/devices
```

### Step 4: Frontend API Integration

**Update `frontend/src/lib/api.ts`:**
```typescript
// Already configured with:
// - Base URL from .env.local (http://localhost:8000)
// - Request interceptor for JWT token
// - Response interceptor for 401 redirect
```

**Update `frontend/src/app/devices/page.tsx`:**
```typescript
// Replace mock data with real API calls:
React.useEffect(() => {
  const fetchDevices = async () => {
    try {
      const api = getApiClient();
      const response = await api.get('/devices');
      setDevices(response.data);
    } catch (error) {
      setError('Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  };
  fetchDevices();
}, []);
```

### Step 5: Test Integration

**Login Test:**
1. Frontend: http://localhost:3000/login
2. Backend: Create test user via database migration
3. Login should store JWT token in localStorage
4. Redirect to /devices page

**Devices Test:**
1. Verify mock devices replaced with real backend data
2. Check device cards display with status indicators
3. Click device to view detail page with sensor readings

**Real-Time Data Test:**
1. Run backend test: `python run_backend_tests.py`
2. Post test sensor data to backend
3. Frontend should fetch and display latest readings

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
NEXT_PUBLIC_ENABLE_MQTT=false
NEXT_PUBLIC_ENABLE_ML=false
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/hydronix
REDIS_URL=redis://localhost:6379/0
MQTT_BROKER_URL=mqtt://localhost:1883
LOG_LEVEL=INFO
API_KEY_ALGORITHM=HS256
```

## Known Issues & Workarounds

### Issue 1: CORS Errors
**Frontend receives `Access-Control-Allow-Origin` error**

Solution: Add CORS middleware to FastAPI:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue 2: 401 Unauthorized
**API calls return 401 even with valid token**

Solution: Check that:
1. Token is stored in localStorage
2. Request interceptor includes `Authorization: Bearer <token>`
3. Backend validates token correctly
4. Check token expiration

### Issue 3: Device Data Not Loading
**Devices page shows "No Devices Yet"**

Solution:
1. Check backend is running: `curl http://localhost:8000/health`
2. Check devices exist: `curl http://localhost:8000/devices`
3. Check frontend console for API errors
4. Verify .env.local has correct API_BASE_URL

## Testing Scenarios

### Test 1: Complete User Flow
```
1. Frontend: Access http://localhost:3000
2. Redirected to /login (no auth)
3. Login with test credentials
4. Redirected to /devices
5. See device list from backend
6. Click device to view detail
7. See sensor readings and charts
8. Click logout
9. Redirected to /login
```

### Test 2: Real-Time Updates
```
1. Open device detail page
2. In another terminal: Send sensor data to backend
3. Frontend should update within 5 seconds (polling interval)
4. Chart should reflect new data point
```

### Test 3: Alert Handling
```
1. Backend sends alert (e.g., pH out of range)
2. Frontend /alerts page shows new alert
3. User acknowledges alert
4. Alert status changes to acknowledged
5. Alert remains visible but marked as resolved
```

## Performance Targets

- **Page Load**: < 3 seconds (for /devices)
- **API Response**: < 1 second (for 100 devices)
- **Real-Time Update**: < 5 seconds (with polling)
- **Chart Rendering**: < 1 second (for 1000 data points)

## Deployment Notes

### Development
- Frontend: `npm run dev` on port 3000
- Backend: `uvicorn app.main:app --reload` on port 8000
- Both services must be accessible for integration

### Production
- Frontend: `npm run build && npm start` or deploy to Vercel
- Backend: `docker-compose up` with PostgreSQL + Redis
- Set environment variables for production URLs
- Enable HTTPS for secure token transmission

## Next Steps

1. **Week 2**: Implement API integration (devices, sensors)
2. **Week 3**: Add charts and real-time features
3. **Week 4**: Testing and performance optimization
4. **Week 5**: Deployment and monitoring

## Support & Debugging

### Frontend Logs
```bash
# Enable verbose logging
NEXT_DEBUG=* npm run dev
```

### Backend Logs
```bash
# Check logs
tail -f backend/logs/*.log

# Test API
python run_backend_tests.py
```

### Network Debugging
```bash
# Check if services are running
netstat -an | findstr LISTENING
# Frontend: :3000
# Backend: :8000
```
