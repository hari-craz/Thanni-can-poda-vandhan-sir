# Frontend Development Roadmap - Hydronix Dashboard

**Status**: Starting Phase 1  
**Framework**: Next.js with React  
**Styling**: Tailwind CSS  
**Charts**: Recharts  
**Data Fetching**: SWR + React Query  
**State**: Zustand  
**Testing**: Vitest + React Testing Library

---

## Phase 1: Project Setup & Core Infrastructure (Week 1)

### 1.1 Project Initialization
- [ ] Create Next.js project with TypeScript
- [ ] Install and configure Tailwind CSS
- [ ] Set up ESLint and Prettier
- [ ] Configure environment variables (.env.local)
- [ ] Set up folder structure (components, pages, hooks, lib, types)

### 1.2 Authentication System
- [ ] Create login page (/login)
- [ ] Set up JWT token storage (HttpOnly cookie)
- [ ] Create auth context/hook
- [ ] Create protected route wrapper
- [ ] Set up API client with auth headers
- [ ] Implement logout functionality

### 1.3 Layout & Navigation
- [ ] Create main layout wrapper
- [ ] Create sidebar/navbar navigation
- [ ] Create breadcrumb navigation
- [ ] Add responsive mobile menu
- [ ] Set up dark mode toggle (optional)

### 1.4 Core API Integration
- [ ] Set up axios/fetch client with interceptors
- [ ] Create API endpoints wrapper
- [ ] Error handling and retry logic
- [ ] Type definitions for API responses
- [ ] Create custom hooks (useApi, useFetch, etc.)

---

## Phase 2: Core Dashboard Pages (Week 2)

### 2.1 Device Overview Page
- [ ] Create `/devices` page
- [ ] Display device grid/cards
- [ ] Show device status (online/offline)
- [ ] Display key metrics (pH, turbidity, TDS, temp, flow)
- [ ] Show quality score with color coding
- [ ] Alert badge with count
- [ ] Click to navigate to device detail

### 2.2 Device Detail Page
- [ ] Create `/devices/[device_id]` dynamic page
- [ ] Device header with metadata
- [ ] Real-time metrics display (cards/widgets)
- [ ] Quality score gauge chart
- [ ] Anomaly flags section
- [ ] Historical data charts (7 days default)
- [ ] Time range selector

### 2.3 Charts & Visualization
- [ ] Implement line charts with Recharts
- [ ] Multi-series chart support
- [ ] Zoom and pan functionality
- [ ] CSV export feature
- [ ] Chart legend and tooltips

### 2.4 Alerts Page
- [ ] Create `/alerts` page
- [ ] Alert list with filters
- [ ] Alert severity badges
- [ ] Acknowledge alert functionality
- [ ] Alert detail modal/page

---

## Phase 3: Real-Time Updates & Advanced Features (Week 3)

### 3.1 WebSocket Integration
- [ ] Set up WebSocket connection
- [ ] Subscribe to device updates
- [ ] Handle reconnection logic
- [ ] Implement fallback to HTTP polling
- [ ] Update UI in real-time (<2s latency)

### 3.2 Multi-Device Comparison
- [ ] Create `/comparison` page
- [ ] Device selector with checkboxes
- [ ] Overlay charts for comparison
- [ ] Comparative metrics table
- [ ] Quality score comparison

### 3.3 Settings & Admin Panel
- [ ] Create `/settings` page
- [ ] User management section
- [ ] Device management section
- [ ] Alert threshold configuration
- [ ] Notification settings

### 3.4 Additional Pages
- [ ] Dashboard home page with summary
- [ ] Device map view (if applicable)
- [ ] Analytics/reports page
- [ ] User profile page

---

## Phase 4: Polish & Optimization (Week 4)

### 4.1 Performance Optimization
- [ ] Code splitting and lazy loading
- [ ] Image optimization
- [ ] API response caching
- [ ] Pagination for large datasets
- [ ] Virtual scrolling for long lists

### 4.2 User Experience
- [ ] Loading states and skeletons
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Confirmation dialogs
- [ ] Empty states

### 4.3 Responsive Design
- [ ] Mobile layout optimization
- [ ] Touch-friendly interactions
- [ ] Tablet layout testing
- [ ] Cross-browser testing

### 4.4 Testing & QA
- [ ] Unit tests for components
- [ ] Integration tests for flows
- [ ] E2E tests with Cypress
- [ ] Accessibility testing (a11y)
- [ ] Performance testing

---

## Technology Stack Details

### Dependencies to Install
```json
{
  "next": "14.x",
  "react": "18.x",
  "tailwindcss": "3.x",
  "recharts": "2.x",
  "zustand": "4.x",
  "axios": "1.x",
  "swr": "2.x",
  "react-query": "3.x",
  "js-cookie": "3.x",
  "date-fns": "2.x",
  "classnames": "2.x"
}
```

### Dev Dependencies
```json
{
  "typescript": "5.x",
  "eslint": "8.x",
  "prettier": "3.x",
  "tailwindcss": "3.x",
  "@tailwindcss/forms": "0.x",
  "autoprefixer": "10.x",
  "postcss": "8.x",
  "vitest": "1.x",
  "@testing-library/react": "14.x",
  "@testing-library/jest-dom": "6.x"
}
```

---

## Project Structure

```
frontend/
├── public/
│   ├── icons/
│   ├── images/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Loading.tsx
│   │   ├── device/
│   │   │   ├── DeviceCard.tsx
│   │   │   ├── DeviceMetrics.tsx
│   │   │   ├── QualityGauge.tsx
│   │   │   └── AlertBadge.tsx
│   │   ├── charts/
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── GaugeChart.tsx
│   │   └── alerts/
│   │       ├── AlertList.tsx
│   │       └── AlertDetail.tsx
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── index.tsx
│   │   ├── login.tsx
│   │   ├── devices/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── alerts/
│   │   │   └── index.tsx
│   │   ├── comparison.tsx
│   │   ├── settings.tsx
│   │   └── api/
│   │       └── auth.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDevice.ts
│   │   ├── useWebSocket.ts
│   │   └── useFetch.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── types/
│   │   ├── device.ts
│   │   ├── alert.ts
│   │   └── user.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   └── deviceStore.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── variables.css
│   └── config/
│       └── config.ts
├── tests/
│   ├── components/
│   ├── hooks/
│   └── pages/
├── .env.local (example)
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Key Pages & Routes

| Route | Purpose | Auth Required | Role |
|-------|---------|---------------|------|
| `/login` | Login page | ❌ | Public |
| `/` | Dashboard home | ✅ | All |
| `/devices` | Device list | ✅ | All |
| `/devices/:id` | Device detail | ✅ | All |
| `/alerts` | Alerts list | ✅ | All |
| `/comparison` | Device comparison | ✅ | Operator+ |
| `/settings` | Admin settings | ✅ | Admin |
| `/profile` | User profile | ✅ | All |

---

## API Integration Points

### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token

### Device Endpoints
- `GET /devices` - List devices
- `GET /devices/:id` - Get device detail
- `GET /data/:device_id` - Get historical data
- `GET /devices/:id/latest` - Get latest reading
- `POST /devices/:id/heartbeat` - Update device status

### Alert Endpoints
- `GET /alerts` - List alerts
- `POST /alerts/:id/acknowledge` - Acknowledge alert
- `GET /anomalies` - List anomalies

### WebSocket
- `ws://backend:8000/updates` - Real-time updates

---

## Development Workflow

### Week 1 (Setup)
1. Create Next.js project
2. Configure styling and tools
3. Implement authentication
4. Create base layout

### Week 2 (Core Pages)
1. Build device overview
2. Build device detail
3. Implement charts
4. Build alerts page

### Week 3 (Real-time)
1. Add WebSocket integration
2. Add multi-device comparison
3. Add settings panel

### Week 4 (Polish)
1. Optimize performance
2. Add tests
3. Polish UX
4. Deploy

---

## Success Criteria

✅ Dashboard loads in <3 seconds  
✅ Real-time updates in <2 seconds  
✅ Mobile responsive (320px-2560px)  
✅ >85% lighthouse score  
✅ >80% test coverage  
✅ Zero console errors in production  
✅ Accessible (WCAG 2.1 AA)  
✅ All features from spec implemented  

---

## Next Actions

1. Create Next.js project with TypeScript
2. Install and configure dependencies
3. Set up folder structure
4. Begin Phase 1 (authentication & layout)

---

**Created**: June 15, 2026  
**Target Duration**: 4 weeks  
**Team Size**: 1 developer  
**Frontend Framework**: Next.js 14 + React 18 + Tailwind CSS
