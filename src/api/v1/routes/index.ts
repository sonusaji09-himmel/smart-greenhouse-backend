import { Router } from 'express';
import { sensorRouter } from './sensor.routes';
import { dashboardRouter } from './dashboard.routes';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';

/**
 * Aggregates every v1 router under one mount point.
 *
 * Each domain owns its own router file; this module exists purely to wire
 * them together behind a single `/api/v1` prefix, keeping `app.ts` thin.
 */
const v1Router = Router();

v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/sensors', sensorRouter);
v1Router.use('/dashboard', dashboardRouter);

export { v1Router };
