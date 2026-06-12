export interface JwtPayload {
  sub: string; // sub la chuan cua JWT, thuong la Primary key
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  tokenFamily: string;
  iat?: number;
  exp?: number;
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
