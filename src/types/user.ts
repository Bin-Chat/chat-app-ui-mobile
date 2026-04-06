export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatar?: string | null;
  phone?: string | null;
  bio?: string | null;
  isActive: boolean;
  role?: UserRole;
  createdAt?: string;
  updatedAt?: string;
}
