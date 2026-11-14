export interface AuthenticatedUser {
  id: string;
  companyId: string;
  primaryBranchId: string | null;
  allowedBranchIds: string[];
  sessionId: string;
  username: string;
  mustChangePassword: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  companyId: string;
}
