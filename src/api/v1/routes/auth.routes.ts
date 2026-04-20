import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRequest } from '../../../middlewares/validate.middleware';
import { loginRequestSchema, loginResponseSchema } from '../validators/auth.validator';
import { errorResponseSchema } from '../validators/common.validator';
import { openApiRegistry } from '../../../config/openapi';

const router = Router();

router.post('/login', validateRequest({ body: loginRequestSchema }), authController.login);

openApiRegistry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Exchange credentials for a JWT',
  description:
    'Returns a bearer token used to authenticate subsequent read requests when `AUTH_ENABLED=true`.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: loginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Authentication succeeded',
      content: { 'application/json': { schema: loginResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export { router as authRouter };
