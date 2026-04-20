import { Router } from 'express';
import { sensorController } from '../controllers/sensor.controller';
import { validateRequest } from '../../../middlewares/validate.middleware';
import {
  createSensorReadingResponseSchema,
  createSensorReadingSchema,
} from '../validators/sensor.validator';
import { errorResponseSchema } from '../validators/common.validator';
import { openApiRegistry } from '../../../config/openapi';

const router = Router();

router.post('/data', validateRequest({ body: createSensorReadingSchema }), sensorController.ingest);

openApiRegistry.registerPath({
  method: 'post',
  path: '/sensors/data',
  tags: ['Sensors'],
  summary: 'Ingest a sensor reading',
  description:
    'Called by the ESP32 every ~30 seconds to submit the latest environmental sensor sample.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: createSensorReadingSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Reading accepted and persisted',
      content: { 'application/json': { schema: createSensorReadingResponseSchema } },
    },
    400: {
      description: 'Invalid payload',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    500: {
      description: 'Unexpected server error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export { router as sensorRouter };
