import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { success } from '../../../utils/ApiResponse';
import { authService } from '../services/auth.service';
import type { LoginInput } from '../validators/auth.validator';

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as LoginInput;
    const result = await authService.login(body);
    res.status(StatusCodes.OK).json(success(result, 'Authenticated'));
  }),
};
