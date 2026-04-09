# Hydronix ER Diagram

```mermaid
erDiagram
    DEVICES {
        text device_id PK
        text name
        text location
        text status
        timestamptz last_seen
        text api_key_hash
        timestamptz created_at
    }

    SENSOR_DATA {
        bigint id PK
        text device_id FK
        float ph
        float turbidity
        float tds
        float temperature
        float flow_rate
        int quality_score
        jsonb anomaly_flags
        timestamptz timestamp
        bigint seq_no
    }

    ALERTS {
        bigint id PK
        text device_id FK
        text severity
        text message
        timestamptz triggered_at
        timestamptz reading_timestamp
    }

    DEVICES ||--o{ SENSOR_DATA : produces
    DEVICES ||--o{ ALERTS : triggers
```

## Notes

1. `devices.device_id` is the canonical node identity.
2. `sensor_data` has unique (`device_id`, `seq_no`) for deduplication.
3. `alerts` links to device and event timing for operator response.
