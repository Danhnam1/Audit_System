// Application constants
export const APP_NAME = 'AMS Web';

// User Roles
export const ROLES = {
  ADMIN: 'Admin',
  SQA_STAFF: 'SQAStaff',
  SQA_HEAD: 'SQAHead',
  DEPARTMENT_STAFF: 'DepartmentStaff',
  DEPARTMENT_HEAD: 'DepartmentHead',
  DIRECTOR: 'Director',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  SQA_STAFF: '/sqa-staff',
  SQA_HEAD: '/sqa-head',
  DEPARTMENT_STAFF: '/department-staff',
  DEPARTMENT_HEAD: '/department-head',
  DIRECTOR: '/director',
} as const;

export const API_ENDPOINTS = {
  // Define API endpoints
};

export {};
