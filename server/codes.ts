import { createHash, randomBytes } from 'node:crypto';

export type CodeRole = 'reader' | 'owner';

const PREFIX: Record<CodeRole, string> = { reader: 'r', owner: 'o' };

export function generateCode(role: CodeRole): string {
  return `${PREFIX[role]}_${randomBytes(24).toString('base64url')}`;
}

// Codes are high-entropy random values, so a fast hash is sufficient.
export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}
