import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { sensorService } from '../services/sensor.service';
import type { CreateSensorReadingInput } from '../validators/sensor.validator';

/**
 * Controllers strictly handle HTTP concerns: translate request → service call →
 * response. No business logic, no database access.
 */
export const sensorController = {
  ingest: asyncHandler(
    async (req: Request<unknown, unknown, CreateSensorReadingInput>, res: Response) => {
      const reading = await sensorService.ingestReading(req.body);

      res.status(StatusCodes.CREATED).json(
        success(
          {
            id: reading.id,
            recordedAt: reading.recordedAt.toISOString(),
          },
          'Data received successfully.',
        ),
      );
    },
  ),
};
