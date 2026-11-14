export interface AuthenticatedUser {
  id: string;
  companyId: string;
  primaryBranchId: string | null;
  allowedBranchIds: string[];
  sessionId: string;
  username: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  companyId: string;
}
