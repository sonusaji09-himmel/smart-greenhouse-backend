import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { success } from '../../../utils/ApiResponse';
import { asyncHandler } from '../../../utils/asyncHandler';
import { alertEngineService } from '../services/alertEngine.service';
import type { AlertQueryInput } from '../validators/alert.validator';

export const alertController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AlertQueryInput;
    const alerts = await alertEngineService.getActiveAlerts(query.deviceId);
    res.status(StatusCodes.OK).json(
      success({
        count: alerts.length,
        alerts,
      }),
    );
  }),
};
