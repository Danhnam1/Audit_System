// TypeScript type definitions
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export * from './auth.types';
