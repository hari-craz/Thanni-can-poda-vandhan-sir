# Frontend Dashboard Specification

## Purpose
Provide real-time and historical monitoring for multiple Hydronix devices with clear, responsive visual analytics.

## Recommended Stack

1. React with Vite (or Next.js)
2. UI: Tailwind CSS or component library
3. Charts: Recharts or Chart.js
4. Data fetching: React Query
5. Realtime updates: WebSocket or polling

## Core Screens

### 1. Device Overview

1. Card/grid of devices
2. Online/offline badge
3. Last seen timestamp
4. Current key metrics and quality score
5. Quick alert count

### 2. Device Detail

1. Live metric widgets
2. Historical line charts
3. Quality score trend
4. Alert timeline
5. Time-range filters

### 3. Multi-Device Comparison

1. Select multiple devices
2. Overlay charts
3. Compare score and anomaly rates

## UX Requirements

1. Mobile responsive layout
2. Clear status colors for safe/warning/critical
3. Fast load and smooth transitions
4. Accessible contrast and readable typography

## Visual Direction

1. Blue/cyan palette representing water + technology
2. Card-based modular layout
3. Consistent spacing and hierarchy
4. Light modern interface with strong readability

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
