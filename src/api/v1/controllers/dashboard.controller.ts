import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { dashboardService } from '../services/dashboard.service';
import { sseEmitterService } from '../services/sseEmitter.service';
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

  stream: (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseEmitterService.addClient(res);
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

    const cleanup = () => {
      sseEmitterService.removeClient(res);
      if (!res.writableEnded) res.end();
    };

    req.on('close', cleanup);
    res.on('error', cleanup);
  },
};
