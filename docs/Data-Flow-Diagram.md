# Hydronix Data Flow Diagram

## System Data Flow

```mermaid
flowchart LR
    A[ESP32 Sensors\npH Temp Turbidity TDS Flow] --> B[ESP32 Firmware\nRead Validate Package]
    B --> C[Local Display\nLive Values]
    B --> D{Internet Available?}
    D -- Yes --> E[MQTT or HTTP Uplink]
    D -- No --> F[SD Card Buffer Queue]
    F --> G[Reconnect and Replay Worker]
    G --> E
    E --> H[Backend Ingestion API/Broker]
    H --> I[Auth and Schema Validation]
    I --> J[(PostgreSQL Time-Series Data)]
    J --> K[Rule Engine\nScore and Anomaly Detection]
    K --> L[(Alerts Table)]
    J --> M[Dashboard API]
    L --> M
    M --> N[Web Dashboard\nOverview Charts Alerts]
```

## Sequence View

```mermaid
sequenceDiagram
    participant D as ESP32 Device
    participant B as Backend
    participant DB as Database
    participant UI as Dashboard

    loop Sampling interval
        D->>D: Read sensors and display
        alt Network available
            D->>B: Send JSON payload
            B->>B: Validate auth and schema
            B->>DB: Insert reading
            B->>DB: Compute score and alerts
            B-->>D: ACK
        else Offline
            D->>D: Store payload on SD queue
        end
    end

    D->>B: Replay queued payloads on reconnect
    B->>DB: Upsert with dedupe by device_id + seq_no
    UI->>B: Request devices, data, status
    B->>UI: Return latest metrics and history
```

## How Everything Works Together

1. Device keeps collecting readings whether online or offline.
2. Offline records are queued locally and replayed safely later.
3. Backend persists and processes data into usable intelligence.
4. Dashboard reads both raw metrics and processed alerts for operations.
