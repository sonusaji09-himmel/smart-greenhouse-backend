import { Router } from 'express';
import { openApiRegistry } from '../../../config/openapi';
import { authGuard } from '../../../middlewares/auth.middleware';
import { validateRequest } from '../../../middlewares/validate.middleware';
import { actuatorController } from '../controllers/actuator.controller';
import {
  actuatorCommandQuerySchema,
  actuatorCommandResponseSchema,
  actuatorParamsSchema,
  actuatorStateResponseSchema,
} from '../validators/actuator.validator';
import { errorResponseSchema } from '../validators/common.validator';

const router = Router();

router.get('/state', authGuard, actuatorController.getState);
router.post(
  '/:actuator/activate',
  authGuard,
  validateRequest({ params: actuatorParamsSchema, query: actuatorCommandQuerySchema }),
  actuatorController.activate,
);
router.post(
  '/:actuator/deactivate',
  authGuard,
  validateRequest({ params: actuatorParamsSchema, query: actuatorCommandQuerySchema }),
  actuatorController.deactivate,
);
router.post(
  '/:actuator/stop',
  authGuard,
  validateRequest({ params: actuatorParamsSchema, query: actuatorCommandQuerySchema }),
  actuatorController.stop,
);

openApiRegistry.registerPath({
  method: 'get',
  path: '/actuators/state',
  tags: ['Actuators'],
  summary: 'Get last known actuator states',
  responses: {
    200: {
      description: 'Current state of each actuator',
      content: { 'application/json': { schema: actuatorStateResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/actuators/{actuator}/activate',
  tags: ['Actuators'],
  summary: 'Activate an actuator manually',
  request: { params: actuatorParamsSchema, query: actuatorCommandQuerySchema },
  responses: {
    200: {
      description: 'Command dispatched',
      content: { 'application/json': { schema: actuatorCommandResponseSchema } },
    },
    409: {
      description: 'Manual command rejected by safety constraints',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/actuators/{actuator}/deactivate',
  tags: ['Actuators'],
  summary: 'Deactivate an actuator manually',
  request: { params: actuatorParamsSchema, query: actuatorCommandQuerySchema },
  responses: {
    200: {
      description: 'Command dispatched',
      content: { 'application/json': { schema: actuatorCommandResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/actuators/{actuator}/stop',
  tags: ['Actuators'],
  summary: 'Stop an actuator manually',
  request: { params: actuatorParamsSchema, query: actuatorCommandQuerySchema },
  responses: {
    200: {
      description: 'Command dispatched',
      content: { 'application/json': { schema: actuatorCommandResponseSchema } },
    },
  },
});

export { router as actuatorRouter };
