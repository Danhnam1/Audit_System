// Application constants
export const APP_NAME = 'AMS Web';

// User Roles
export const ROLES = {
  ADMIN: 'Admin',
  SQA_STAFF: 'Auditor',
  SQA_HEAD: 'Lead Auditor',
  DEPARTMENT_STAFF: 'CAPAOwner',
  DEPARTMENT_HEAD: 'AuditeeOwner',
  DIRECTOR: 'Director',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  AUDITOR: '/auditor',
  LEAD_AUDITOR: '/lead-auditor',
  CAPA_OWNER: '/capa-owner',
  AUDITEE_OWNER: '/auditee-owner',
  DIRECTOR: '/director',
} as const;

export const API_ENDPOINTS = {
  // Define API endpoints
};

// Export status colors
export * from './statusColors';

export {};
