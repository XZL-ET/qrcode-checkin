import { signAdminToken, verifyAdminToken } from '@/lib/auth';

describe('auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('signs and verifies a valid admin token', async () => {
    const token = await signAdminToken({ adminId: 1, username: 'admin' });
    expect(typeof token).toBe('string');

    const payload = await verifyAdminToken(token);
    expect(payload).toMatchObject({ adminId: 1, username: 'admin' });
  });

  it('rejects an invalid token', async () => {
    await expect(verifyAdminToken('bad-token')).rejects.toThrow();
  });

  it('rejects token with wrong secret', async () => {
    const token = await signAdminToken({ adminId: 1, username: 'admin' });
    process.env.JWT_SECRET = 'wrong-secret';
    await expect(verifyAdminToken(token)).rejects.toThrow();
  });
});
