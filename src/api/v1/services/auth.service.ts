import bcrypt from 'bcryptjs';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/AppError';
import type { LoginInput } from '../validators/auth.validator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'admin' | 'viewer';
}

/**
 * Seed admin user sourced from env vars.
 *
 * The hash is computed once at module load so `/auth/login` runs in constant
 * time regardless of whether the email matches. A real deployment would
 * replace this with a proper user repository; the interface here is small
 * enough that swapping it in later is a one-file change.
 */
const SEED_USER = {
  email: env.ADMIN_EMAIL,
  role: 'admin' as const,
  passwordHash: bcrypt.hashSync(env.ADMIN_PASSWORD, 10),
};

export const authService = {
  async login(
    input: LoginInput,
  ): Promise<{ token: string; expiresIn: string; user: { email: string; role: string } }> {
    const emailMatches = input.email.toLowerCase() === SEED_USER.email.toLowerCase();
    const passwordMatches = await bcrypt.compare(input.password, SEED_USER.passwordHash);

    if (!emailMatches || !passwordMatches) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: SEED_USER.email,
      email: SEED_USER.email,
      role: SEED_USER.role,
    };

    const signOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign(payload, env.JWT_SECRET as Secret, signOptions);

    return {
      token,
      expiresIn: env.JWT_EXPIRES_IN,
      user: { email: SEED_USER.email, role: SEED_USER.role },
    };
  },

  verify(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as Secret);
      if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
        throw AppError.unauthorized('Invalid token');
      }
      return decoded as JwtPayload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.unauthorized('Invalid or expired token');
    }
  },
};

export type AuthService = typeof authService;
