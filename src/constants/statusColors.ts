/**
 * Status Color System - Aviation Blue Theme
 * Uses primary (sky) colors for consistent branding
 * Based on Audit State Diagrams workflow
 */

// Status color mapping using primary colors
export const STATUS_COLORS = {
  // Completed/Success States - Xanh lục/Teal (Positive outcomes)
  'Approve': 'bg-teal-500 text-white',
  'Approved': 'bg-teal-500 text-white',
  'Resolved': 'bg-green-600 text-white',
  'Verified': 'bg-teal-400 text-white',
  'Distributed': 'bg-teal-600 text-white',
  'Closed': 'bg-green-700 text-white',
  
  // Validated/Confirmed States - Primary đậm
  'Validated': 'bg-primary-700 text-white',
  'Registered': 'bg-primary-600 text-white',
  
  // In Progress/Active States - Primary vừa
  'In Progress': 'bg-primary-500 text-white',
  'InProgress': 'bg-primary-500 text-white',
  
  // Under Review States - Primary nhạt
  'Under Review': 'bg-primary-200 text-primary-800',
  'UnderReview': 'bg-primary-200 text-primary-800',
  'Pending Review': 'bg-primary-200 text-primary-800',
  'PendingReview': 'bg-primary-200 text-primary-800',
  
  // Pending/Waiting States - Primary rất nhạt
  'Pending': 'bg-primary-100 text-primary-700',
  'Submitted': 'bg-primary-100 text-primary-700',
  // Director/Lead review specific pending states
  'PendingDirectorApproval': 'bg-primary-200 text-primary-800',
  'Pending Director Approval': 'bg-primary-200 text-primary-800',
  'PendingLeadApproval': 'bg-primary-200 text-primary-800',
  'Pending Lead Approval': 'bg-primary-200 text-primary-800',
  
  // Draft/Initial States - Xám nhạt
  'Draft': 'bg-gray-200 text-gray-700',
  'Open': 'bg-gray-300 text-gray-800',
  
  // Rejected/Negative States - Xám đậm
  'Rejected': 'bg-gray-500 text-white',
  'Cancelled': 'bg-gray-600 text-white',
  
  // Special States
  'Reopened': 'bg-primary-800 text-white',
  'Overdue': 'bg-primary-900 text-white',
  
  // User/System States
  'Active': 'bg-teal-500 text-white',
  'Inactive': 'bg-gray-400 text-white',
  'Suspended': 'bg-gray-600 text-white',
  
  // Backup States  
  'Failed': 'bg-gray-700 text-white',
} as const;

// Priority color mapping using primary colors
export const PRIORITY_COLORS = {
  'Critical': 'bg-primary-900 text-white',
  'High': 'bg-primary-700 text-white',
  'Medium': 'bg-primary-500 text-white',
  'Low': 'bg-primary-300 text-primary-900',
} as const;

// Helper function to get status color
export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700';
};

// Helper function to get priority color
export const getPriorityColor = (priority: string): string => {
  return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'text-gray-600';
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
  INITIAL: ['Draft', 'Pending', 'Registered', 'Submitted', 'Open'],
  PROCESSING: ['Under Review', 'UnderReview', 'Pending Review', 'PendingReview', 'In Progress', 'InProgress', 'Validated', 'PendingDirectorApproval', 'Pending Director Approval', 'PendingLeadApproval', 'Pending Lead Approval'],
  SUCCESS: ['Approve', 'Approved', 'Verified', 'Resolved', 'Distributed', 'Closed'],
  NEGATIVE: ['Rejected', 'Cancelled'],
  SPECIAL: ['Reopened', 'Overdue'],
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
