import { SensorReadingModel, type SensorReadingDocument } from '../models/sensorReading.model';
import type { CreateSensorReadingInput } from '../validators/sensor.validator';

/**
 * Business logic around sensor readings.
 *
 * Services own all writes and reads against the model layer. Controllers must
 * never talk to Mongoose directly — that keeps the data layer swappable and
 * the business rules centralized.
 */
export const sensorService = {
  /**
   * Persists a new sensor reading. Returns the saved document so controllers
   * can echo identifiers back to the caller.
   */
  async ingestReading(input: CreateSensorReadingInput): Promise<SensorReadingDocument> {
    const recordedAt = input.timestamp ? new Date(input.timestamp) : new Date();

    return SensorReadingModel.create({
      deviceId: input.deviceId ?? 'esp32-01',
      temperature: input.temperature,
      humidity: input.humidity,
      soilMoisture: input.soilMoisture,
      lightLevel: input.lightLevel,
      recordedAt,
    });
  },

  /**
   * Returns the single most recent document in the collection.
   * The compound `(deviceId, recordedAt desc)` index makes this effectively O(1).
   */
  async getLatestReading(): Promise<SensorReadingDocument | null> {
    return SensorReadingModel.findOne().sort({ recordedAt: -1 }).exec();
  },
};

export type SensorService = typeof sensorService;
