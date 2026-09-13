export type AccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'TEMPORARILY_LOCKED' | 'DISABLED';

export interface AccountView {
  id: string;
  email: string;
  emailVerifiedAt?: string | null;
  status: AccountStatus;
  failedAttempts: number;
  lockedUntil?: string | null;
  lastAuthenticatedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface SessionView {
  accountId: string;
  displayEmail: string;
  status: SessionStatus;
  authenticatedAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  roleCodes: string[];
  permissions: string[];
}

export interface CommandAccepted {
  accepted: boolean;
  requestId: string;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  requestId?: string;
  correlationId?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export interface RegistrationRequest {
  email: string;
  password: string;
}

export interface PasswordLoginRequest {
  email: string;
  password: string;
}

export interface OtpLoginRequest {
  email: string;
  code: string;
}

export interface EmailVerificationRequest {
  email: string;
  code?: string;
  token?: string;
}

export interface TargetEmailRequest {
  email: string;
}

export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}
