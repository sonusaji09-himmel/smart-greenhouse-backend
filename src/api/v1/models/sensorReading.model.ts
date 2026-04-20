import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

/**
 * Domain shape of a single sensor sample persisted in MongoDB.
 * All environmental values are doubles; the collection is append-only.
 */
export interface SensorReading {
  deviceId: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightLevel: number;
  recordedAt: Date;
}

export type SensorReadingDocument = HydratedDocument<SensorReading>;

const sensorReadingSchema = new Schema<SensorReading>(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      default: 'esp32-01',
      index: true,
    },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    soilMoisture: { type: Number, required: true },
    lightLevel: { type: Number, required: true },
    recordedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    collection: 'sensor_data',
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        const record = ret as Record<string, unknown>;
        const id = record._id;
        if (id) {
          record.id = String(id);
        }
        delete record._id;
        return record;
      },
    },
  },
);

/**
 * Compound index that serves both the "latest reading" query and any future
 * time-range scans per device. Matches the legacy ASP.NET implementation.
 */
sensorReadingSchema.index({ deviceId: 1, recordedAt: -1 }, { name: 'deviceId_recordedAt' });

export const SensorReadingModel: Model<SensorReading> = model<SensorReading>(
  'SensorReading',
  sensorReadingSchema,
);
