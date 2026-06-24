#ifndef SENSOR_READER_H
#define SENSOR_READER_H

#include "Config.h"

class SensorReader {
private:
  float prev_ph;
  float prev_turb;
  float prev_tds;
  float prev_temp;
  float prev_flow;

  uint32_t stuck_ph;
  uint32_t stuck_turb;
  uint32_t stuck_tds;
  uint32_t stuck_temp;
  uint32_t stuck_flow;
  bool is_first;

public:
  SensorReader();
  bool performReading(SensorReading& rd, uint32_t interval, uint32_t maxStuckSamples);
};

#endif // SENSOR_READER_H
