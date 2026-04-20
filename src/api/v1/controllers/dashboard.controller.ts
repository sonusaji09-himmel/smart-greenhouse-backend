import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { dashboardService } from '../services/dashboard.service';

export const dashboardController = {
  getOverview: asyncHandler(async (_req: Request, res: Response) => {
    const overview = await dashboardService.getOverview();

    if (!overview) {
      res.status(StatusCodes.OK).json(success({ message: 'No sensor data available yet.' }));
      return;
    }

    res.status(StatusCodes.OK).json(success(overview));
  }),
};
