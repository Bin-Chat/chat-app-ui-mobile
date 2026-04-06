export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidName(name: string): boolean {
  return /^[a-zA-ZÀ-ỹ\s]+$/.test(name);
}

export interface PasswordStrength {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  score: number;
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const minLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  const score = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar].filter(
    Boolean
  ).length;
  const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';

  return { minLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar, score, strength };
}
