import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardOverviewQuery } from '../validators/dashboard.validator';

export const dashboardController = {
  getOverview: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as DashboardOverviewQuery;
    const overview = await dashboardService.getOverview(query.deviceId);

    if (!overview) {
      res.status(StatusCodes.OK).json(success({ message: 'No sensor data available yet.' }));
      return;
    }

    res.status(StatusCodes.OK).json(success(overview));
  }),
};
