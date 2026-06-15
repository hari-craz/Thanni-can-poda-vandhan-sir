# HYDRONIX FRONTEND MASTER PROMPT (PUBLIC-FIRST WATER MONITORING PLATFORM)

You are a Principal Product Designer, Senior React Architect, Enterprise UX Lead, and Staff Frontend Engineer.

Your task is to design and build the COMPLETE frontend ecosystem for Hydronix.

Hydronix is a production-grade IoT Water Monitoring Platform that receives sensor data from ESP32 devices and provides real-time water quality monitoring, analytics, alerting, anomaly detection, reporting, and device management.

This is NOT a traditional SaaS application where users log in first.

The platform is a PUBLIC WATER MONITORING PORTAL.

The first thing visitors see must be live water monitoring statistics.

Authentication is only required for administrative operations.

Build the entire frontend architecture accordingly.

---

# PRODUCT VISION

Hydronix should feel like:

* National Water Monitoring Command Center
* Smart City Operations Dashboard
* Industrial Monitoring Platform
* Municipal Water Quality Control Center

Users should instantly understand water conditions within seconds of opening the website.

No login wall.

No role selection screen.

No onboarding flow.

Monitoring first.

Management second.

---

# TECHNOLOGY STACK

React 19

TypeScript

Vite

TailwindCSS

shadcn/ui

React Query

Zustand

React Router

Axios

React Hook Form

Zod

Framer Motion

WebSocket

Recharts

NextAuth-compatible auth architecture

---

# DESIGN SYSTEM

Design Style:

WHITE LIQUID MORPHISM

Requirements:

* Premium SaaS quality
* Apple-level polish
* Enterprise-grade dashboards
* Water-inspired visuals
* White frosted glass cards
* Floating liquid backgrounds
* Aqua gradients
* Soft shadows
* Large clean spacing
* Minimal visual clutter
* Modern data visualization

Colors:

Primary Blue #0070F3

Light Blue #3B9EFF

Cyan #00B4D8

Teal #00897B

Warning #F59E0B

Danger #EF4444

Background #F0F7FF

Typography:

Headings:
Space Grotesk

Body:
Inter

Metrics:
JetBrains Mono

Animation:

Framer Motion

Accessibility:

WCAG AA

Keyboard navigation

Screen reader support

Reduced motion support

Dark mode ready

---

# AUTHENTICATION MODEL

IMPORTANT

There are ONLY TWO ROLES:

SUPER_ADMIN

ADMIN

NO VIEWER

NO OPERATOR

NO CUSTOMER LOGIN

NO USER DASHBOARD

Authentication exists only for management functions.

---

# PUBLIC EXPERIENCE

Route:

/

This is the MAIN EXPERIENCE.

The homepage must immediately display live water monitoring information.

NO LOGIN REQUIRED.

NO SPLASH SCREEN.

NO MARKETING-FIRST DESIGN.

DATA FIRST.

Users should instantly see:

Current Water Quality

System Health

Device Health

Live Metrics

Live Sensor Data

Current Alerts

Recent Trends

Recent Activity

---

# PUBLIC HOMEPAGE SECTIONS

SECTION 1

Hero Monitoring Banner

Display:

Hydronix

Real-Time Water Monitoring Platform

Live Status Indicator

Current Water Health Score

Total Active Devices

Online Devices

Critical Alerts

Last Updated Time

---

SECTION 2

National Dashboard Metrics

Cards:

Total Devices

Online Devices

Offline Devices

Average pH

Average TDS

Average Turbidity

Average Temperature

Average Flow Rate

Water Quality Score

Critical Alerts

Warning Alerts

Anomalies Detected

---

SECTION 3

Live Monitoring Feed

Real-time incoming readings

Device Name

Location

pH

TDS

Temperature

Flow Rate

Status

Timestamp

Auto-updating via WebSocket

---

SECTION 4

Live Water Quality Trends

Charts:

pH Trend

TDS Trend

Temperature Trend

Flow Rate Trend

Turbidity Trend

Quality Score Trend

---

SECTION 5

Device Status Overview

Map View

Grid View

Device Cards

Device Health Indicators

Signal Strength

Last Seen

Status

---

SECTION 6

Current Alerts

Critical Alerts

Warnings

Recently Resolved

Alert Timeline

---

SECTION 7

Recent Anomalies

Outliers

Unsafe Readings

Sensor Failures

Connectivity Issues

---

SECTION 8

System Health

Backend Health

Database Health

MQTT Health

WebSocket Health

API Status

---

SECTION 9

Hydronix Overview

How the platform works

Architecture overview

Monitoring capabilities

---

SECTION 10

Footer

Contact

Documentation

GitHub

Admin Login

---

# PUBLIC ROUTES

/

Main Monitoring Dashboard

/live

Dedicated Fullscreen Monitoring Dashboard

/devices

Public Device Directory

/devices/:deviceId

Public Device Details

Limited data

Public charts

Public metrics

/about

Platform Overview

/status

System Status Page

---

# NAVIGATION

Top Navigation

Logo

Dashboard

Devices

Live

Status

About

Admin Login

Admin Login should be a small secondary button.

Never make login the primary action.

---

# LOGIN

Route

/login

Only for Admin and Super Admin.

Fields:

Email

Password

Remember Me

Forgot Password

Login Button

JWT Authentication

Role comes from backend.

Never ask user to select role.

Automatically redirect after login.

---

# SUPER ADMIN CAPABILITIES

Full platform access.

Can:

Manage Admins

Manage Devices

Provision Devices

Generate API Keys

Rotate API Keys

Delete Devices

View Audit Logs

View Security Logs

Manage Notifications

Manage Thresholds

Manage System Settings

Manage Integrations

View Infrastructure Metrics

Manage Backups

Manage MQTT Configuration

Manage WebSocket Configuration

Manage Database Configuration

---

# ADMIN CAPABILITIES

Can:

View Devices

View Analytics

View Alerts

Acknowledge Alerts

View Reports

Export Data

View Anomalies

View Device Details

View System Health

Cannot:

Create Admins

Delete Admins

Manage System Secrets

Manage Platform Settings

Manage Infrastructure

Rotate Master Keys

---

# ADMIN PANEL

Route:

/admin

Protected

---

# ADMIN ROUTES

/admin/dashboard

Executive Dashboard

Widgets:

Devices

Quality Score

Alerts

System Health

Anomalies

Reports

---

/admin/devices

Device Management

Search

Filters

Table

Grid

Bulk Actions

---

/admin/devices/:id

Device Detail

Live Metrics

Charts

Alerts

Anomalies

Calibration

Firmware

Connectivity

Exports

---

/admin/alerts

Alert Center

---

/admin/alerts/:id

Alert Details

---

/admin/anomalies

Anomaly Center

---

/admin/analytics

Advanced Analytics

---

/admin/reports

Reporting Center

---

/admin/provisioning

Device Provisioning

SUPER_ADMIN ONLY

Generate:

Device ID

API Key

QR Code

---

/admin/users

SUPER_ADMIN ONLY

Admin Management

---

/admin/users/:id

SUPER_ADMIN ONLY

Admin Profile

---

/admin/api-keys

SUPER_ADMIN ONLY

API Key Management

---

/admin/audit

SUPER_ADMIN ONLY

Audit Logs

---

/admin/settings

SUPER_ADMIN ONLY

System Settings

---

# REAL TIME REQUIREMENTS

Use WebSocket.

Update:

Live Metrics

Alerts

Anomalies

Device Status

Quality Scores

Monitoring Feed

Dashboard Widgets

Fallback:

React Query Polling

---

# CHART REQUIREMENTS

Line Charts

Area Charts

Bar Charts

Heat Maps

Gauge Charts

Trend Charts

Comparison Charts

Timeline Charts

Metrics:

pH

TDS

Temperature

Flow Rate

Turbidity

Quality Score

---

# COMPONENT LIBRARY

Generate reusable:

Sidebar

Topbar

Mobile Navigation

Metric Cards

Status Cards

Alert Cards

Charts

Data Tables

Filters

Search

Pagination

Dialogs

Drawers

Forms

Date Pickers

Notification Center

User Menu

Device Cards

Map Components

Health Indicators

Skeleton Loaders

Empty States

Error States

Offline States

---

# RESPONSIVE REQUIREMENTS

Desktop

Tablet

Mobile

Monitoring-first layout.

On mobile:

Water metrics must remain visible above the fold.

Critical alerts must always be visible.

---

# FOLDER STRUCTURE

Generate enterprise-scale structure.

src/

app/

routes/

pages/

features/

components/

layouts/

providers/

services/

hooks/

store/

types/

utils/

charts/

forms/

assets/

styles/

---

# DELIVERABLES

Generate:

1. Complete Information Architecture

2. Complete Sitemap

3. Complete Route Tree

4. Complete User Flows

5. Complete RBAC Matrix

6. Complete Design System

7. Complete Folder Structure

8. Complete Component Inventory

9. Complete API Integration Architecture

10. Complete React Query Architecture

11. Complete Zustand Architecture

12. Complete WebSocket Architecture

13. Complete Mobile Experience

14. Complete Tablet Experience

15. Complete Desktop Experience

16. Dashboard Wireframes

17. Table Designs

18. Form Designs

19. Public Monitoring Experience

20. Admin Management Experience

21. Production-Ready React Architecture

Build this as a world-class smart-city water monitoring platform ready for production deployment.





# ADDITIONAL UI/UX REQUIREMENTS — PAGE BY PAGE DESIGN SPECIFICATION

## DESIGN PHILOSOPHY

Hydronix should feel like:

* Apple Dashboard
* Tesla Control Center
* Stripe Admin
* Linear
* Notion

Combined with:

* White Glass Morphism
* Water Inspired Visuals
* Premium Enterprise Feel

---

# GLOBAL DESIGN SYSTEM

## Theme

White Liquid Glass Morphism

### Background

```css
Background:
#F0F7FF

Glass:
rgba(255,255,255,0.72)

Border:
rgba(255,255,255,0.4)

Shadow:
0 8px 40px rgba(0,0,0,0.08)

Backdrop:
blur(24px)
```

---

## Card Style

Every card must have:

* Frosted glass
* Soft shadow
* Rounded corners (24px)
* Blur background
* Hover elevation
* Smooth animation

Apple VisionOS inspired.

---

## Navigation

Top Navigation:

Logo

Dashboard

Devices

Live Monitoring

Status

About

Admin Login

Glass floating navbar.

Sticky.

---

# PAGE 1

## HOME PAGE

Route:

/

Purpose:

Public Monitoring Dashboard

---

### Hero Section

Display:

Hydronix

Real-Time Water Monitoring

Live Status Badge

Current Water Health Score

Online Devices

Critical Alerts

Last Updated

---

### KPI Section

Large Glass Cards:

Water Quality Score

Online Devices

Offline Devices

Average pH

Average TDS

Average Temperature

Average Flow

Average Turbidity

---

### Live Device Feed

Table:

Device

Location

Status

pH

TDS

Flow

Temperature

Timestamp

Auto-updating

---

### Live Charts

Glass Chart Containers

pH Trend

TDS Trend

Temperature Trend

Flow Trend

Quality Trend

---

### Device Map

Interactive map

Colored markers

Green

Yellow

Red

---

### Recent Alerts

Timeline style

Glass alert cards

---

### System Health

MQTT

Database

Backend

WebSocket

Status indicators

---

# PAGE 2

## LIVE COMMAND CENTER

Route:

/live

Purpose:

24/7 Monitoring Screen

Fullscreen layout

Large widgets

Auto-refresh

TV display mode

No sidebars

No distractions

---

# PAGE 3

## DEVICES

Route:

/devices

Purpose:

Device Directory

---

Layout:

Grid Toggle

Table Toggle

Search

Filters

Sort

Pagination

---

Device Card:

Glass Card

Device Name

Location

Status

Signal

Water Score

Last Seen

Quick Actions

---

# PAGE 4

## DEVICE DETAIL

Route:

/devices/:id

---

Sections:

Overview

Metrics

History

Alerts

Anomalies

Calibration

Connectivity

Export

---

### Header

Device Name

Location

Status

Signal

Firmware

---

### Metrics Grid

pH

TDS

Flow

Temperature

Turbidity

Quality Score

---

### Historical Charts

7 Days

30 Days

90 Days

1 Year

---

### Alerts Panel

Alert History

Acknowledged

Pending

---

### Anomaly Panel

Outliers

Sensor Issues

Connectivity Issues

---

# PAGE 5

## STATUS PAGE

Route:

/status

---

Show:

API Health

Database

MQTT

WebSocket

Storage

Latency

Uptime

Incident History

---

# PAGE 6

## ABOUT PAGE

Route:

/about

---

Project Overview

Architecture

How Hydronix Works

Features

Technology Stack

Documentation

---

# LOGIN PAGE

Route:

/login

---

Apple Style Login Card

Glass Center Panel

Logo

Email

Password

Remember Me

Login

Forgot Password

---

# ADMIN AREA

All admin pages must use:

Glass Sidebar

Glass Topbar

Glass Cards

White Theme

Apple Style

---

# ADMIN DASHBOARD

Route:

/admin/dashboard

---

Widgets:

Total Devices

Online Devices

Alerts

Anomalies

Quality Score

System Health

---

Charts:

Quality Trends

Device Trends

Alert Trends

---

Recent Activity Feed

---

# USERS MANAGEMENT

Route:

/admin/users

SUPER_ADMIN ONLY

---

Page Layout

Glass Table

Search

Filters

Role Filter

Status Filter

---

Columns

Name

Email

Role

Devices Assigned

Status

Last Login

Actions

---

Actions

Create User

Edit User

Suspend User

Delete User

Assign Devices

Reset Password

---

# USER DETAILS

Route:

/admin/users/:id

---

Profile Card

User Information

Activity Logs

Assigned Devices

Permissions

Security Information

Recent Actions

---

# SETTINGS PAGE

Route:

/admin/settings

SUPER_ADMIN ONLY

---

Left Sidebar

Settings Categories

---

## General Settings

Platform Name

Organization Name

Timezone

Language

Theme

---

## Water Quality Settings

pH Thresholds

TDS Thresholds

Flow Thresholds

Temperature Thresholds

Turbidity Thresholds

---

## Alert Settings

Email Alerts

SMS Alerts

Slack Alerts

Webhook Alerts

Escalation Rules

---

## Device Settings

Default Sampling Rate

Device Timeout

Offline Threshold

Calibration Frequency

---

## MQTT Settings

Broker URL

Port

TLS

Authentication

---

## WebSocket Settings

Heartbeat

Reconnect Strategy

Polling Fallback

---

## API Settings

Rate Limits

JWT Expiry

API Keys

CORS

---

## Backup Settings

Retention

Frequency

Storage Location

---

## Security Settings

Password Policy

2FA

Session Timeout

IP Whitelist

Audit Logs

---

# API KEYS PAGE

Route:

/admin/api-keys

SUPER_ADMIN ONLY

---

Generate Key

Rotate Key

Revoke Key

Expiry

Device Association

---

# DEVICE PROVISIONING

Route:

/admin/provisioning

SUPER_ADMIN ONLY

---

Generate:

Device ID

API Key

QR Code

Setup URL

---

# AUDIT LOGS

Route:

/admin/audit

SUPER_ADMIN ONLY

---

Timeline Layout

Glass Cards

Filters

Search

Date Range

---

Show:

User

Action

IP

Timestamp

Severity

---

# ALERT CENTER

Route:

/admin/alerts

---

Glass Table

Critical

Warning

Resolved

Pending

---

# ANALYTICS

Route:

/admin/analytics

---

Water Analytics

Device Analytics

Regional Analytics

Performance Analytics

Predictive Analytics

---

# REPORTS

Route:

/admin/reports

---

Generate

Daily

Weekly

Monthly

Custom

Export:

PDF

Excel

CSV

---

# ANIMATIONS

Use Framer Motion

Page transitions

Card hover

Chart transitions

Sidebar animation

Modal animation

Loading animation

Apple-like smoothness

---

# FINAL REQUIREMENT

Every page must look like:

Apple Dashboard + VisionOS + Tesla Control Center + Stripe Admin

using:

White Theme

Glass Morphism

Liquid Background

Premium Enterprise Design

Responsive Design

Production Ready UI

No dark theme by default.

White Glass Morphism is the primary visual language across the entire platform.
