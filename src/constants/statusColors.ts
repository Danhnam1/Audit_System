/**
 * Status Color System - Aviation Blue Theme
 * Uses primary (sky) colors for consistent branding
 * Based on Audit State Diagrams workflow
 */

// Status color mapping using primary colors
export const STATUS_COLORS = {
  // Completed/Success States - Green (Positive outcomes)
  'Approved': 'bg-green-100 text-green-800',
  'Completed': 'bg-green-100 text-green-800',
  'Closed': 'bg-green-600 text-white',
  'Verified': 'bg-teal-100 text-teal-800',
  'Published': 'bg-blue-100 text-blue-800',
  
  // In Progress/Active States - Medium primary/sky tone
  'In Progress': 'bg-sky-500 text-white',
  'InProgress': 'bg-sky-500 text-white',
  'Assigned': 'bg-sky-400 text-white',
  
  // Under Review States - Light primary/sky tone
  'Under Review': 'bg-sky-200 text-sky-800',
  'UnderReview': 'bg-sky-200 text-sky-800',
  'Pending Review': 'bg-sky-200 text-sky-800',
  'PendingReview': 'bg-sky-200 text-sky-800',
  
  // Pending/Waiting States - Very light primary/sky tone
  'Pending': 'bg-sky-100 text-sky-700',
  'Submitted': 'bg-sky-100 text-sky-700',
  // Director/Lead review specific pending states
  'PendingDirectorApproval': 'bg-sky-200 text-sky-800',
  'Pending Director Approval': 'bg-sky-200 text-sky-800',
  'PendingLeadApproval': 'bg-sky-200 text-sky-800',
  'Pending Lead Approval': 'bg-sky-200 text-sky-800',
  
  // Draft/Initial States - Light gray
  'Draft': 'bg-gray-200 text-gray-700',
  'Open': 'bg-gray-300 text-gray-800',
  
  // Rejected/Negative States - Red/Orange (Clear warning)
  'Rejected': 'bg-red-100 text-red-800',
  'Declined': 'bg-orange-200 text-orange-900', // Rejected by Lead Auditor (different from Director's Rejected)
  'Returned': 'bg-orange-100 text-orange-800',
  'Return': 'bg-orange-100 text-orange-800',
  'Cancelled': 'bg-red-200 text-red-800',
  
  // Special States
  'Reopened': 'bg-purple-100 text-purple-800',
  'Overdue': 'bg-red-500 text-white',
  'Archived': 'bg-orange-500 text-white',
  
  // Checklist Status States
  'Compliant': 'bg-green-500 text-white',
  'NonCompliant': 'bg-green-100 text-green-800',
  'Non-Compliant': 'bg-green-100 text-green-800',
  
  // User/System States
  'Active': 'bg-teal-500 text-white',
  'Inactive': 'bg-gray-400 text-white',
  'Suspended': 'bg-gray-500 text-white',
  'Expired': 'bg-gray-400 text-white',
  'Revoked': 'bg-red-300 text-red-900',
  
  // Schedule/Planning States
  'Planned': 'bg-blue-100 text-blue-800',
  
  // Notification States
  'Sent': 'bg-blue-100 text-blue-700',
  
  // Action/Review States
  'Reviewed': 'bg-teal-100 text-teal-800',
  'Resolved': 'bg-green-100 text-green-800',
} as const;

// Priority color mapping using primary/sky colors
export const PRIORITY_COLORS = {
  'Critical': 'bg-red-600 text-white',
  'High': 'bg-orange-500 text-white',
  'Medium': 'bg-sky-500 text-white',
  'Low': 'bg-sky-200 text-sky-800',
} as const;

// Severity color mapping for findings
export const SEVERITY_COLORS = {
  'Critical': 'bg-red-100 text-red-800',
  'Major': 'bg-orange-100 text-orange-800',
  'Minor': 'bg-green-100 text-green-800',
  'Observation': 'bg-blue-100 text-blue-800',
  'Low': 'bg-green-100 text-green-800',
  'Medium': 'bg-yellow-100 text-yellow-800',
  'High': 'bg-red-100 text-red-800',
} as const;

// Helper function to get status color
export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700';
};

// Helper function to get priority color
export const getPriorityColor = (priority: string): string => {
  return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'text-gray-600';
};

// Helper function to get severity color
export const getSeverityColor = (severity: string): string => {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || 'bg-gray-100 text-gray-700';
};

// Badge variants for different use cases
export const BADGE_VARIANTS = {
  // For small tags (standards, delivery mode, etc.)
  'primary-light': 'bg-primary-100 text-primary-700',
  'primary-medium': 'bg-primary-200 text-primary-800',
  'primary-dark': 'bg-primary-300 text-primary-900',
  'primary-solid': 'bg-primary-500 text-white',
  
  // Neutral badges
  'gray-light': 'bg-gray-100 text-gray-700',
  'gray-medium': 'bg-gray-200 text-gray-800',
} as const;

// Helper function to get badge variant
export const getBadgeVariant = (variant: keyof typeof BADGE_VARIANTS): string => {
  return BADGE_VARIANTS[variant];
};

// Export type definitions for TypeScript
export type StatusType = keyof typeof STATUS_COLORS;
export type PriorityType = keyof typeof PRIORITY_COLORS;
export type BadgeVariantType = keyof typeof BADGE_VARIANTS;

// Workflow Stage Groups (for filtering and logic)
export const STATUS_GROUPS = {
  INITIAL: ['Draft', 'Pending', 'Submitted', 'Open', 'Assigned'],
  PROCESSING: ['Under Review', 'UnderReview', 'Pending Review', 'PendingReview', 'In Progress', 'InProgress', 'PendingDirectorApproval', 'Pending Director Approval', 'PendingLeadApproval', 'Pending Lead Approval'],
  SUCCESS: ['Approved', 'Completed', 'Resolved', 'Closed', 'Reviewed'],
  NEGATIVE: ['Rejected', 'Declined', 'Returned', 'Return', 'Cancelled'],
  SPECIAL: ['Reopened', 'Overdue'],
  CHECKLIST: ['Compliant', 'NonCompliant', 'Non-Compliant', 'Overdue'],
} as const;

// Helper to check if status is in a group
export const isStatusInGroup = (status: string, group: keyof typeof STATUS_GROUPS): boolean => {
  return (STATUS_GROUPS[group] as readonly string[]).includes(status);
};

// Helper to get status progress percentage (for progress bars)
export const getStatusProgress = (status: string): number => {
  if (isStatusInGroup(status, 'INITIAL')) return 20;
  if (isStatusInGroup(status, 'PROCESSING')) return 50;
  if (isStatusInGroup(status, 'SUCCESS')) return 100;
  if (isStatusInGroup(status, 'NEGATIVE')) return 0;
  return 0;
};
