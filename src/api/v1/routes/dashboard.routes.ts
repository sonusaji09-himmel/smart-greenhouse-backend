import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { validateRequest } from '../../../middlewares/validate.middleware';
import { authGuard } from '../../../middlewares/auth.middleware';
import {
  dashboardOverviewQuerySchema,
  dashboardOverviewResponseSchema,
} from '../validators/dashboard.validator';
import { errorResponseSchema } from '../validators/common.validator';
import { openApiRegistry } from '../../../config/openapi';

const router = Router();

router.get(
  '/overview',
  authGuard,
  validateRequest({ query: dashboardOverviewQuerySchema }),
  dashboardController.getOverview,
);

openApiRegistry.registerPath({
  method: 'get',
  path: '/dashboard/overview',
  tags: ['Dashboard'],
  summary: 'Get the latest dashboard overview',
  description:
    'Returns the most recent sensor reading with a pre-computed status (optimal / warning / critical) for each sensor. Polled by the React dashboard every ~10 seconds.',
  request: { query: dashboardOverviewQuerySchema },
  responses: {
    200: {
      description: 'Latest reading with computed per-sensor status',
      content: { 'application/json': { schema: dashboardOverviewResponseSchema } },
    },
    500: {
      description: 'Unexpected server error',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export { router as dashboardRouter };
