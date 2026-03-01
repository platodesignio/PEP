import bcrypt from "bcryptjs";

const COST_FACTOR = 12;

const PASSWORD_REQUIREMENTS = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST_FACTOR);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return { valid: false, reason: `パスワードは${PASSWORD_REQUIREMENTS.minLength}文字以上必要です` };
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, reason: "大文字を含める必要があります" };
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, reason: "小文字を含める必要があります" };
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, reason: "数字を含める必要があります" };
  }
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, reason: "記号を含める必要があります" };
  }
  return { valid: true };
}
