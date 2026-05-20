import jwt from 'jsonwebtoken';
import { BadRequestError } from './caso-churn.service';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  nome: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string = '7d';
  private readonly refreshTokenExpiry: string = '30d';

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokens(payload: AuthPayload): Tokens {
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(
      { userId: payload.userId },
      this.jwtRefreshSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        algorithm: 'HS256'
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): AuthPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      }) as AuthPayload;
      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestError('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestError('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token and generate new access token
   */
  refreshAccessToken(refreshToken: string, payload: AuthPayload): Tokens {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret, {
        algorithms: ['HS256']
      }) as { userId: string };

      if (decoded.userId !== payload.userId) {
        throw new BadRequestError('Token mismatch');
      }

      return this.generateTokens(payload);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestError('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for development)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
