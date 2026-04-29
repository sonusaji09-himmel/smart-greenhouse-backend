import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { success } from '../../../utils/ApiResponse';
import { asyncHandler } from '../../../utils/asyncHandler';
import { actuatorControlService } from '../services/actuatorControl.service';
import { sensorQueryService } from '../services/sensorQuery.service';
import type { ActuatorCommandQuery, ActuatorIdInput } from '../validators/actuator.validator';

const defaultDeviceId = 'esp32-01';

const commandBase = async (
  req: Request,
  res: Response,
  action: 'activate' | 'deactivate' | 'stop',
): Promise<void> => {
  const { actuator } = req.params as unknown as { actuator: ActuatorIdInput };
  const query = req.query as unknown as ActuatorCommandQuery;
  const deviceId = query.deviceId ?? defaultDeviceId;
  const latest = await sensorQueryService.latest({ deviceId });

  if (action === 'activate') {
    await actuatorControlService.activate(deviceId, actuator, 'manual', latest ?? undefined);
  } else if (action === 'deactivate') {
    await actuatorControlService.deactivate(deviceId, actuator, 'manual');
  } else {
    await actuatorControlService.stop(deviceId, actuator, 'manual');
  }

  res.status(StatusCodes.OK).json(
    success(
      {
        actuator,
        action,
        source: 'manual',
        deviceId,
      },
      `Actuator ${actuator} ${action} command dispatched`,
    ),
  );
};

export const actuatorController = {
  getState: asyncHandler(async (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json(success(actuatorControlService.getState()));
  }),

  activate: asyncHandler(async (req: Request, res: Response) => {
    await commandBase(req, res, 'activate');
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    await commandBase(req, res, 'deactivate');
  }),

  stop: asyncHandler(async (req: Request, res: Response) => {
    await commandBase(req, res, 'stop');
  }),
};
