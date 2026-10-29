export interface AuthUser {
  sub: string;
  role: string;
  institutionId?: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
