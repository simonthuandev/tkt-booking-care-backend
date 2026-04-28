export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  tokenFamily: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload extends JwtPayload {
  tokenFamily: string; // để detect refresh token reuse attack
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tokenFamily: string;
}

export enum UserRole {
  USER = 'user',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
}
