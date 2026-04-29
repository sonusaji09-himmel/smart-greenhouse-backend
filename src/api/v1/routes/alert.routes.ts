import { Router } from 'express';
import { openApiRegistry } from '../../../config/openapi';
import { authGuard } from '../../../middlewares/auth.middleware';
import { validateRequest } from '../../../middlewares/validate.middleware';
import { alertController } from '../controllers/alert.controller';
import { errorResponseSchema } from '../validators/common.validator';
import { alertQuerySchema, alertResponseSchema } from '../validators/alert.validator';

const router = Router();

router.get('/', authGuard, validateRequest({ query: alertQuerySchema }), alertController.list);

openApiRegistry.registerPath({
  method: 'get',
  path: '/alerts',
  tags: ['Alerts'],
  summary: 'List active sustained-threshold alerts',
  request: { query: alertQuerySchema },
  responses: {
    200: {
      description: 'Active alerts',
      content: { 'application/json': { schema: alertResponseSchema } },
    },
    400: {
      description: 'Invalid query',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export { router as alertRouter };
