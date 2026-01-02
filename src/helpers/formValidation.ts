/**
 * Form Validation Helpers
 * Centralized validation functions for consistent validation across the application
 */

// Email validation regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password validation regex - at least one special character
export const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

// File size constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Validates if a string is not empty (after trimming)
 */
export const validateRequired = (value: string | null | undefined, fieldName: string = 'Field'): string | null => {
  if (!value || !value.trim()) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validates email format
 */
export const validateEmail = (email: string | null | undefined, fieldName: string = 'Email'): string | null => {
  if (!email || !email.trim()) {
    return `${fieldName} is required`;
  }
  if (!EMAIL_REGEX.test(email)) {
    return `Invalid ${fieldName.toLowerCase()} address`;
  }
  return null;
};

/**
 * Validates password strength
 * @param password - Password to validate
 * @param minLength - Minimum length (default: 6)
 * @param requireSpecialChar - Whether to require special character (default: true)
 */
export const validatePassword = (
  password: string | null | undefined,
  minLength: number = 6,
  requireSpecialChar: boolean = true
): string | null => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (requireSpecialChar && !SPECIAL_CHAR_REGEX.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
};

/**
 * Validates if a date is valid
 */
export const validateDate = (date: string | null | undefined, fieldName: string = 'Date'): string | null => {
  if (!date) {
    return `${fieldName} is required`;
  }
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return `Invalid ${fieldName.toLowerCase()}`;
  }
  return null;
};

/**
 * Validates date range (fromDate must be before toDate)
 */
export const validateDateRange = (
  fromDate: string | null | undefined,
  toDate: string | null | undefined,
  fieldNames: { from?: string; to?: string } = {}
): string | null => {
  const fromField = fieldNames.from || 'Start date';
  const toField = fieldNames.to || 'End date';

  const fromError = validateDate(fromDate, fromField);
  if (fromError) return fromError;

  const toError = validateDate(toDate, toField);
  if (toError) return toError;

  const from = new Date(fromDate!);
  const to = new Date(toDate!);

  if (from.getTime() > to.getTime()) {
    return `${fromField} must be before ${toField}`;
  }

  return null;
};

/**
 * Validates minimum days between two dates
 */
export const validateMinDays = (
  fromDate: string | null | undefined,
  toDate: string | null | undefined,
  minDays: number,
  fieldNames: { from?: string; to?: string } = {}
): string | null => {
  const rangeError = validateDateRange(fromDate, toDate, fieldNames);
  if (rangeError) return rangeError;

  const from = new Date(fromDate!);
  const to = new Date(toDate!);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

  if (daysDiff < minDays) {
    return `Period must be at least ${minDays} days`;
  }

  return null;
};

/**
 * Validates if a date is not in the past
 */
export const validateDateNotPast = (
  date: string | null | undefined,
  fieldName: string = 'Date'
): string | null => {
  const dateError = validateDate(date, fieldName);
  if (dateError) return dateError;

  const dateObj = new Date(date!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);

  if (dateObj < today) {
    return `${fieldName} cannot be in the past`;
  }

  return null;
};

/**
 * Validates if a date is after another date
 */
export const validateDateAfter = (
  date: string | null | undefined,
  afterDate: string | null | undefined,
  fieldName: string = 'Date',
  afterFieldName: string = 'Reference date'
): string | null => {
  const dateError = validateDate(date, fieldName);
  if (dateError) return dateError;

  if (!afterDate) {
    return null; // If afterDate is not provided, skip this validation
  }

  const dateObj = new Date(date!);
  const after = new Date(afterDate);
  dateObj.setHours(0, 0, 0, 0);
  after.setHours(0, 0, 0, 0);

  if (dateObj < after) {
    return `${fieldName} must be on or after ${afterFieldName} (${after.toISOString().split('T')[0]})`;
  }

  return null;
};

/**
 * Validates if a date is before another date (with optional offset days)
 */
export const validateDateBefore = (
  date: string | null | undefined,
  beforeDate: string | null | undefined,
  fieldName: string = 'Date',
  beforeFieldName: string = 'Reference date',
  offsetDays: number = 0
): string | null => {
  const dateError = validateDate(date, fieldName);
  if (dateError) return dateError;

  if (!beforeDate) {
    return null; // If beforeDate is not provided, skip this validation
  }

  const dateObj = new Date(date!);
  const maxDate = new Date(beforeDate);
  maxDate.setDate(maxDate.getDate() - offsetDays);
  maxDate.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);

  if (dateObj > maxDate) {
    const maxDateStr = maxDate.toISOString().split('T')[0];
    if (offsetDays > 0) {
      return `${fieldName} must be on or before ${maxDateStr} (at least ${offsetDays} day${offsetDays > 1 ? 's' : ''} before ${beforeFieldName})`;
    }
    return `${fieldName} must be on or before ${maxDateStr}`;
  }

  return null;
};

/**
 * Validates file size
 */
export const validateFileSize = (file: File, maxSize: number = MAX_FILE_SIZE): string | null => {
  if (file.size > maxSize) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const maxMB = (maxSize / 1024 / 1024).toFixed(0);
    return `File "${file.name}" exceeds ${maxMB}MB limit (${sizeMB}MB)`;
  }
  return null;
};

/**
 * Validates multiple files
 */
export const validateFiles = (
  files: File[],
  maxSize: number = MAX_FILE_SIZE,
  minCount: number = 0
): string | null => {
  if (files.length < minCount) {
    return `At least ${minCount} file${minCount > 1 ? 's' : ''} ${minCount > 1 ? 'are' : 'is'} required`;
  }

  const invalidFiles = files.filter(file => file.size > maxSize);
  if (invalidFiles.length > 0) {
    const fileNames = invalidFiles.map(f => f.name).join(', ');
    const maxMB = (maxSize / 1024 / 1024).toFixed(0);
    return `The following files exceed ${maxMB}MB limit: ${fileNames}`;
  }

  return null;
};

/**
 * Validates if an array is not empty
 */
export const validateArrayNotEmpty = (
  array: any[] | null | undefined,
  fieldName: string = 'Selection'
): string | null => {
  if (!array || array.length === 0) {
    return `Please select at least one ${fieldName.toLowerCase()}`;
  }
  return null;
};

/**
 * Validates if a value is selected (not empty/null/undefined)
 */
export const validateSelected = (
  value: string | number | null | undefined,
  fieldName: string = 'Option'
): string | null => {
  if (value === null || value === undefined || value === '') {
    return `Please select a ${fieldName.toLowerCase()}`;
  }
  return null;
};

/**
 * Generic validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Helper to build validation errors object
 */
export const buildValidationErrors = (errors: Array<{ field: string; message: string }>): Record<string, string> => {
  const errorObj: Record<string, string> = {};
  errors.forEach(({ field, message }) => {
    if (message) {
      errorObj[field] = message;
    }
  });
  return errorObj;
};

