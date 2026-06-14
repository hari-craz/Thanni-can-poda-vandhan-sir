# Frontend Dashboard Specification

## Purpose
Provide real-time and historical monitoring for multiple Hydronix devices with clear, responsive visual analytics.

## Recommended Stack

1. React with Vite (or Next.js)
2. UI: Tailwind CSS or component library
3. Charts: Recharts or Chart.js
4. Data fetching: React Query or SWR
5. Realtime updates: WebSocket (ws library)
6. Auth: JWT stored in secure HttpOnly cookie or localStorage
7. State: Zustand or Redux
8. Testing: Vitest + React Testing Library

## Authentication & Authorization

### Login Flow

1. User navigates to `/login`
2. Enter email + password
3. POST `/auth/login` with credentials
4. Backend returns JWT token (claims: `{ user_id, email, role, devices: [...], exp }`
5. Store JWT in HttpOnly cookie (secure + same-site)
6. Redirect to dashboard
7. All API requests include Authorization header: `Bearer <JWT>`

### RBAC Roles

- **Admin**: Manage users, API keys, device settings, view all data
- **Operator**: View all data, acknowledge alerts, run calibration
- **Viewer**: Read-only access to assigned devices

### Device Assignment

- Users have subset of devices they can access
- Dashboard filters all data to `devices` array in JWT
- Backend enforces: user can only see data for assigned devices

### Logout

- Clear JWT cookie
- Navigate to `/login`
- Optional: POST `/auth/logout` to backend (invalidate session)

## Core Screens

### 1. Login Screen

1. Email input
2. Password input
3. Remember me checkbox (optional)
4. Submit button
5. Error message display
6. Redirect to dashboard on success

### 2. Device Overview

1. Card/grid of devices
2. Online/offline badge (color: green/red)
3. Last seen timestamp + signal strength
4. Current key metrics: pH, turbidity, TDS, temperature, flow rate (latest value)
5. Quality score (0-100, color-coded: red <30, yellow 30-70, green >70)
6. Alert count badge (red if unacknowledged critical alerts)
7. Click to view device detail

### 3. Device Detail

1. Device header: name, location, status, signal strength
2. **Real-time Metrics** (WebSocket updates <2s latency):
   - Large widgets: pH, turbidity, TDS, temperature, flow rate
   - Color indicators for out-of-range values
   - Last updated timestamp
3. **Quality Score Gauge**:
   - Circular progress: 0-100
   - Color: red/yellow/green based on range
   - Trend arrow (↑ improving, ↓ worsening)
4. **Anomaly Flags** (if any):
   - "Sensor may be stuck" warning
   - "Out of safe range" alert
5. **Historical Charts** (default: last 7 days):
   - Line chart: pH, turbidity, TDS, temperature, flow rate (multi-series)
   - Time range filter: 7d, 30d, 90d, 1y
   - Zoom + pan
   - CSV export
6. **Alert Timeline**:
   - List of recent alerts (most recent first)
   - Alert type, severity, timestamp
   - "Acknowledge" button
   - Acknowledge message textbox
7. **Calibration Status**:
   - "Last calibrated: 2026-06-10"
   - "Recalibration due in 20 days"
   - Display warning if overdue

### 4. Multi-Device Comparison

1. Select devices to compare (multi-select checkboxes)
2. Overlay charts (different colors per device)
3. Compare quality scores (bar chart)
4. Compare anomaly counts
5. Metric summary table (device | pH | turbidity | quality score)

### 5. Alerts Screen

1. Filter by: severity, device, status (unacknowledged, acknowledged, resolved)
2. Table/list of alerts:
   - Device ID, severity, message, triggered time, escalation level
   - Status badge: unacknowledged (red), acknowledged, resolved (green)
   - "Acknowledge" button
3. Alert detail on click:
   - Full message + reading values
   - Timeline of escalations
   - Acknowledgement notes
   - "Resolve Alert" button (for ops)

### 6. Settings Screen (Admin Only)

1. **User Management**:
   - List users: email, role, active status
   - Add user button (email invitation)
   - Disable user button
2. **Device Management**:
   - List devices: device_id, name, location, is_active
   - Edit device name/location
   - Deregister device (soft delete)
   - View device API keys (masked)
   - Rotate key button
3. **Alert Thresholds**:
   - Edit safe pH range, turbidity limit, TDS limit
   - Save changes
4. **Notification Settings**:
   - Email/SMS/Slack configuration
   - Quiet hours (no alerts 10pm-7am)
   - Escalation intervals

## Latency Targets

- Sensor reading to dashboard: **<2 seconds** (WebSocket)
- Dashboard page load: **<3 seconds** (95th percentile)
- Historical chart render (1 year): **<5 seconds**
- Alert delivery to user: **<1 minute** (backend to email)

## Real-Time Transport

### WebSocket Connection

- Endpoint: `ws://backend:8000/updates`
- Subscribe message:
  ```json
  {
    "action": "subscribe",
    "devices": ["HYDRO_001", "HYDRO_002"]
  }
  ```
- Received message:
  ```json
  {
    "event": "reading_updated",
    "device_id": "HYDRO_001",
    "data": {
      "ph": 7.2,
      "turbidity": 3.1,
      "tds": 120,
      "temperature": 25,
      "flow_rate": 10,
      "timestamp": "2026-06-14T21:00:00Z",
      "quality_score": 85
    }
  }
  ```
- Alert message:
  ```json
  {
    "event": "alert_triggered",
    "device_id": "HYDRO_001",
    "alert": {
      "id": 123,
      "severity": "critical",
      "message": "pH out of safe range (9.2)",
      "timestamp": "2026-06-14T21:00:00Z"
    }
  }
  ```
- Status message:
  ```json
  {
    "event": "device_status_changed",
    "device_id": "HYDRO_001",
    "status": "offline"
  }
  ```
- Fallback to HTTP polling if WebSocket fails: `GET /devices/:device_id/latest?since=<timestamp>` every 5 seconds

## Data Fetching & Pagination

- Default view: last 7 days (not full history)
- Endpoint: `GET /data/:device_id?limit=10080` (7 days × 1440 min)
- Pagination: `GET /data/:device_id?limit=100&before=<timestamp>`
- Lazy-load older data on scroll
- Cache latest 7 days in Redis (1-minute TTL)

## UX Requirements

1. Mobile responsive layout (breakpoints: 375px, 768px, 1024px, 1440px)
2. Clear status colors:
   - Green: safe/online
   - Yellow: warning/caution
   - Red: critical/offline
3. Fast load and smooth transitions (CSS animations, no hard page refreshes)
4. Accessible contrast (WCAG AA minimum)
5. Readable typography: 16px+ minimum for body text

## Visual Direction

1. Blue/cyan palette representing water + technology
2. Card-based modular layout with 1rem spacing
3. Consistent component library (buttons, inputs, cards)
4. Light modern interface with strong readability
5. Dark mode support (optional Phase 2)

## Data Contracts

Consume endpoints:

1. `GET /devices`
2. `GET /data/:device_id?from=&to=&limit=`
3. `GET /status`

Optional realtime:

1. `GET /stream/:device_id` (SSE)
2. WebSocket `/ws`

## Frontend Acceptance Criteria

1. Device list reflects status within 10 seconds.
2. Charts support at least 30 days of history per device.
3. Users can detect unsafe water states in under 3 clicks.
4. Dashboard remains usable on mobile screens.
