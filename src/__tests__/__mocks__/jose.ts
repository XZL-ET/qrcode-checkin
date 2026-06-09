// Mock for jose ESM module
const encoder = new TextEncoder();

export class SignJWT {
  private payload: Record<string, unknown>;
  private header: Record<string, unknown> = {};
  private expiresIn = '';

  constructor(payload: Record<string, unknown>) {
    this.payload = payload;
  }

  setProtectedHeader(header: Record<string, unknown>) {
    this.header = header;
    return this;
  }

  setExpirationTime(exp: string) {
    this.expiresIn = exp;
    return this;
  }

  sign(secret: Uint8Array): Promise<string> {
    const data = JSON.stringify({
      payload: this.payload,
      header: this.header,
      secret: new TextDecoder().decode(secret),
    });
    return Promise.resolve(Buffer.from(data).toString('base64url'));
  }
}

export async function jwtVerify(
  token: string,
  secret: Uint8Array
): Promise<{ payload: Record<string, unknown> }> {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64url').toString());
    const expectedSecret = new TextDecoder().decode(secret);
    if (data.secret !== expectedSecret) {
      throw new Error('invalid signature');
    }
    return { payload: { ...data.payload, adminId: data.payload.adminId, username: data.payload.username } };
  } catch {
    throw new Error('verification failed');
  }
}
