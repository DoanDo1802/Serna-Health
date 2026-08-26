export type DeclaredGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export interface EmergencyContact {
  fullName: string;
  phone: string;
  relationship: string;
  version?: number;
}

export interface PatientView {
  id: string;
  version: number;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phone?: string | null;
  email?: string | null;
  declaredGender: DeclaredGender;
  address?: string | null;
  emergencyContact?: EmergencyContact | null;
  createdAt: string;
  updatedAt: string;
}

export type IdentifierType = 'CCCD' | 'PASSPORT' | 'NATIONAL_ID';
export type IdentifierStatus = 'ACTIVE' | 'REVOKED' | 'ENTERED_IN_ERROR';
export type VerificationSource = 'SELF_DECLARED' | 'STAFF_RECORDED' | 'MANUALLY_VERIFIED';

export interface PatientIdentifierView {
  id: string;
  version: number;
  patientId: string;
  identifierType: IdentifierType;
  issuer: string;
  jurisdiction: string;
  displaySuffix: string;
  status: IdentifierStatus;
  verificationSource: VerificationSource;
  collectedByAccountId?: string | null;
  collectedAt: string;
  verifiedAt?: string | null;
  effectiveFrom: string;
  revokedAt?: string | null;
  evidenceReference?: string | null;
}

export type AccountRelationship = 'OWN' | 'SELF' | 'PARENT' | 'CHILD' | 'SPOUSE' | 'GUARDIAN' | 'REPRESENTATIVE';
export type VerificationTier = 'PENDING' | 'IDENTITY_VERIFIED' | 'REPRESENTATION_VERIFIED';

export interface PatientAccountLinkView {
  id: string;
  version: number;
  accountId: string;
  patientId: string;
  relationship: AccountRelationship;
  verificationTier: VerificationTier;
  permissionScope: Record<string, unknown>;
  validFrom: string;
  validTo?: string | null;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientCreateRequest {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  declaredGender: DeclaredGender;
  address?: string;
  emergencyContact?: EmergencyContact;
}

export interface PatientUpdateRequest {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  declaredGender: DeclaredGender;
  address?: string;
  emergencyContact?: EmergencyContact;
}

export interface PatientIdentifierAddRequest {
  identifierType: IdentifierType;
  issuer: string;
  jurisdiction: string;
  value: string;
  verificationSource: 'SELF_DECLARED' | 'STAFF_RECORDED';
}

export interface PatientAccountLinkRequest {
  accountId: string;
  relationship: string;
  verificationTier: 'PENDING' | 'IDENTITY_VERIFIED' | 'REPRESENTATION_VERIFIED';
  permissionScope: Record<string, unknown>;
  validFrom: string;
  validTo?: string | null;
}

export interface PageResponse<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}
