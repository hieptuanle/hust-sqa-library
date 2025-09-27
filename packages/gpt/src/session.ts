import { randomUUID } from 'node:crypto';
import { SessionData } from './types.js';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24; // 24 hours

export class SessionStore {
  private readonly sessions = new Map<string, SessionData>();

  createSession(userId: string, username: string): SessionData {
    const sessionId = randomUUID();
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    const session: SessionData = { sessionId, userId, username, expiresAt };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string | undefined | null): SessionData | null {
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  deleteSession(sessionId: string | undefined | null): void {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }
}
