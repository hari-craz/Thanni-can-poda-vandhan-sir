#include "SensorReader.h"

SensorReader::SensorReader() {
  prev_ph   = 7.0f;
  prev_turb = 1.0f;
  prev_tds  = 150.0f;
  prev_temp = 25.0f;
  prev_flow = 5.0f;

  stuck_ph   = 0;
  stuck_turb = 0;
  stuck_tds  = 0;
  stuck_temp = 0;
  stuck_flow = 0;
  is_first   = true;
}

bool SensorReader::performReading(SensorReading& rd, uint32_t interval, uint32_t maxStuckSamples) {
  // ── ADC reads ────────────────────────────────────────────────────────
  float raw_ph   = analogRead(PIN_PH)        * (3.3f / 4095.0f) * 3.5f;
  float raw_turb = analogRead(PIN_TURBIDITY) * (1000.0f / 4095.0f);
  float raw_tds  = analogRead(PIN_TDS)       * (5000.0f / 4095.0f);
  float raw_temp = -10.0f + analogRead(PIN_TEMP) * (100.0f / 4095.0f);

  // ── Flow Sensor (Pulse Count) ────────────────────────────────────────
  uint32_t pulses = 0;
  portENTER_CRITICAL(&flowMux);
  pulses = flowPulseCount;
  flowPulseCount = 0;
  portEXIT_CRITICAL(&flowMux);

  float hz = (float)pulses / (float)interval;
  float raw_flow = hz / 7.5f;

  // ── Calibration offsets ──────────────────────────────────────────────
  float cal_ph   = raw_ph   + config.ph_offset;
  float cal_turb = raw_turb + config.turbidity_offset;
  float cal_tds  = raw_tds  + config.tds_offset;
  float cal_temp = raw_temp + config.temp_offset;
  float cal_flow = raw_flow + config.flow_offset;

  float sm_ph, sm_turb, sm_tds, sm_temp, sm_flow;

  if (is_first) {
    sm_ph   = cal_ph;
    sm_turb = cal_turb;
    sm_tds  = cal_tds;
    sm_temp = cal_temp;
    sm_flow = cal_flow;
    is_first = false;
  } else {
    // ── Per-sensor rate-of-change clamp ─────────────────────────────────
    float dMin = (float)interval / 60.0f;
    float lim_ph   = PH_DELTA_PER_MIN   * dMin;
    float lim_turb = TURB_DELTA_PER_MIN * dMin;
    float lim_tds  = TDS_DELTA_PER_MIN  * dMin;
    float lim_temp = TEMP_DELTA_PER_MIN * dMin;
    float lim_flow = FLOW_DELTA_PER_MIN * dMin;

    auto clamp = [](float val, float prev, float limit) -> float {
      float diff = val - prev;
      if (diff > limit)  return prev + limit;
      if (diff < -limit) return prev - limit;
      return val;
    };

    cal_ph   = clamp(cal_ph,   prev_ph,   lim_ph);
    cal_turb = clamp(cal_turb, prev_turb, lim_turb);
    cal_tds  = clamp(cal_tds,  prev_tds,  lim_tds);
    cal_temp = clamp(cal_temp, prev_temp, lim_temp);
    cal_flow = clamp(cal_flow, prev_flow, lim_flow);

    // ── EMA smoothing (alpha = 0.3) ──────────────────────────────────────
    sm_ph   = cal_ph   * 0.3f + prev_ph   * 0.7f;
    sm_turb = cal_turb * 0.3f + prev_turb * 0.7f;
    sm_tds  = cal_tds  * 0.3f + prev_tds  * 0.7f;
    sm_temp = cal_temp * 0.3f + prev_temp * 0.7f;
    sm_flow = cal_flow * 0.3f + prev_flow * 0.7f;
  }

  // ── Sanity bounds ────────────────────────────────────────────────────
  bool valid = (sm_ph   >= PH_MIN   && sm_ph   <= PH_MAX   &&
                sm_turb >= TURB_MIN && sm_turb <= TURB_MAX &&
                sm_tds  >= TDS_MIN  && sm_tds  <= TDS_MAX  &&
                sm_temp >= TEMP_MIN && sm_temp <= TEMP_MAX &&
                sm_flow >= FLOW_MIN && sm_flow <= FLOW_MAX);

  if (valid) {
    // ── Stuck sensor detection (24h flatline threshold) ───────────────
    auto tick = [](float cur, float prev, uint32_t& cnt) {
      if (fabsf(cur - prev) < 0.0001f) cnt++; else cnt = 0;
    };
    tick(sm_ph,   prev_ph,   stuck_ph);
    tick(sm_turb, prev_turb, stuck_turb);
    tick(sm_tds,  prev_tds,  stuck_tds);
    tick(sm_temp, prev_temp, stuck_temp);
    tick(sm_flow, prev_flow, stuck_flow);

    isPhStuck   = stuck_ph   >= maxStuckSamples;
    isTurbStuck = stuck_turb >= maxStuckSamples;
    isTdsStuck  = stuck_tds  >= maxStuckSamples;
    isTempStuck = stuck_temp >= maxStuckSamples;
    isFlowStuck = stuck_flow >= maxStuckSamples;

    prev_ph = sm_ph; prev_turb = sm_turb; prev_tds = sm_tds;
    prev_temp = sm_temp; prev_flow = sm_flow;

    rd.ph          = sm_ph;
    rd.turbidity   = sm_turb;
    rd.tds         = sm_tds;
    rd.temperature = sm_temp;
    rd.flow_rate   = sm_flow;
    rd.raw_ph      = raw_ph;
    rd.seq_no      = ++globalSeqNo;
    bool synced = false;
    getUTCTime(rd.timestamp, sizeof(rd.timestamp), synced);
    strncpy(rd.timestamp_source, synced ? "device" : "server_adjusted",
            sizeof(rd.timestamp_source) - 1);
    rd.timestamp_source[sizeof(rd.timestamp_source) - 1] = '\0';
    return true;
  }
  return false;
}
