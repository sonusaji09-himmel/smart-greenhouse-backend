import { z } from './zodOpenApi';

export const loginRequestSchema = z
  .object({
    email: z
      .email({ message: 'Valid email is required' })
      .openapi({ example: 'admin@greenhouse.local' }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 chars')
      .openapi({ example: 'ChangeMe123!' }),
  })
  .strict()
  .openapi('LoginRequest');

export type LoginInput = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      token: z.string(),
      expiresIn: z.string(),
      user: z.object({
        email: z.string(),
        role: z.string(),
      }),
    }),
  })
  .openapi('LoginResponse');
