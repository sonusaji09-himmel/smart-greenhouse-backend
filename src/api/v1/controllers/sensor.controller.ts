import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { sensorIngestionService } from '../services/sensorIngestion.service';
import { sensorQueryService } from '../services/sensorQuery.service';
import type {
  AggregateQuery,
  LatestQuery,
  SensorReadingInput,
  TimeRangeQuery,
} from '../validators/sensor.validator';

/**
 * Controllers strictly handle HTTP concerns: translate request → service call →
 * response. No business logic, no direct data-layer access.
 *
 * Query objects are cast from Express's default `ParsedQs` to our Zod-inferred
 * shapes; the preceding `validateRequest` middleware has already coerced and
 * validated them, so the cast is sound.
 */
export const sensorController = {
  /**
   * HTTP fallback ingestion path. The primary path is MQTT, but this keeps
   * a cURL / Postman-friendly endpoint available for demos and tests.
   */
  ingest: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as SensorReadingInput;
    const result = await sensorIngestionService.ingest(body);
    await sensorIngestionService.flush();

    res.status(StatusCodes.CREATED).json(
      success(
        {
          deviceId: result.deviceId,
          recordedAt: result.recordedAt.toISOString(),
        },
        result.deduplicated ? 'Duplicate dropped.' : 'Data received successfully.',
      ),
    );
  }),

  latest: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as LatestQuery;
    const point = await sensorQueryService.latest(query);
    res.status(StatusCodes.OK).json(success(point));
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as TimeRangeQuery;
    const points = await sensorQueryService.history(query);
    res.status(StatusCodes.OK).json(success({ count: points.length, points }));
  }),

  aggregate: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AggregateQuery;
    const result = await sensorQueryService.aggregate(query);
    res.status(StatusCodes.OK).json(success({ ...result, count: result.buckets.length }));
  }),
};
