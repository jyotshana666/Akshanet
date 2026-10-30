import { describe, it, expect } from 'vitest';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function get(path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

describe('Smoke Tests (requires running services)', () => {
  describe('Health', () => {
    it('API health check returns 200', async () => {
      const res = await fetch(`${API}/health`);
      expect(res.status).toBe(200);
    });
  });

  describe('Auth — seeded demo roles', () => {
    const roles = [
      { email: 'admin@demo-inst.ac.in', role: 'institution_admin', label: 'Institution Admin' },
      { email: 'student@demo.in', role: 'student', label: 'Student' },
      { email: 'officer@aicte.gov.in', role: 'aicte_officer', label: 'AICTE Officer' },
      { email: 'hr@demo-corp.com', role: 'employer', label: 'Employer' },
    ];

    for (const { email, role, label } of roles) {
      it(`POST /auth/login as ${label} → 200`, async () => {
        const { status, data } = await post('/auth/login', { email, otp: '000000' });
        expect(status).toBe(200);
        expect(data).toHaveProperty('user');
        expect(data.user.role).toBe(role);
      });
    }
  });

  describe('Dashboard endpoints', () => {
    it('GET /institution/dashboard returns stats shape', async () => {
      const login = await post('/auth/login', { email: 'admin@demo-inst.ac.in', otp: '000000' });
      expect(login.status).toBe(200);

      const cookie = `token=${login.data.token}`;
      const { status, data } = await get('/institution/dashboard', cookie);
      expect(status).toBe(200);
      expect(data).toHaveProperty('totalAdmissions');
      expect(data).toHaveProperty('verified');
      expect(data).toHaveProperty('pending');
      expect(data).toHaveProperty('flagged');
    });

    it('GET /aicte/dashboard returns national stats', async () => {
      const login = await post('/auth/login', { email: 'officer@aicte.gov.in', otp: '000000' });
      expect(login.status).toBe(200);

      const cookie = `token=${login.data.token}`;
      const { status, data } = await get('/aicte/dashboard', cookie);
      expect(status).toBe(200);
      expect(data).toHaveProperty('totalInstitutions');
      expect(data).toHaveProperty('totalAdmissions');
    });
  });
});
