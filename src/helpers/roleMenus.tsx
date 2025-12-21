import type { SidebarMenuItem } from '../components/Sidebar';
import { ROUTES } from '../constants';
import {
  UsersIcon,
  DashboardIcon,
  AuditIcon,
  ReportsIcon,
  ClipboardCheckIcon,
  DocumentIcon,
  QualityIcon,
  ArchiveIcon,
  DepartmentIcon,
  ShieldIcon,
  ClockIcon,
} from '../layouts/icons';
import { HiOutlineUpload } from 'react-icons/hi';


// Return default menu items per role. Pages can still override by passing menuItems to MainLayout.
export const getRoleMenu = (role?: string | null): SidebarMenuItem[] => {
  const base: SidebarMenuItem[] = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/dashboard' },
    { icon: <ReportsIcon />, label: 'Reports', path: '/reports' },
  ];

  // Normalize role - remove spaces and convert to lowercase for comparison
  const normalizedRole = role?.toLowerCase().replace(/\s+/g, '') || '';
  
  console.log('=== getRoleMenu Debug ===');
  console.log('Original role:', role);
  console.log('Normalized role:', normalizedRole);

  // Check by normalized role first, then by exact match
  switch (normalizedRole) {
    case 'admin':
      return [
        // { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
        { icon: <DepartmentIcon />, label: 'Department Management', path: '/admin/departments' },
        { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
        { icon: <QualityIcon />, label: 'Criteria Management', path: '/admin/criteria' },
        { icon: <ClipboardCheckIcon />, label: 'Checklist Management', path: '/admin/checklists' },
        { icon: <ShieldIcon />, label: 'Sensitive Area Management', path: '/admin/sensitive-areas' },
        { icon: <ArchiveIcon />, label: 'Archived History', path: '/admin/archived-history' },
        // { icon: <AuditIcon />, label: 'Audit Logs', path: '/admin/audit-logs' },
        // { icon: <ReportsIcon />, label: 'Reports', path: '/admin/reports' },
        // { icon: <DatabaseIcon />, label: 'Database', path: '/admin/database' },
        // { icon: <SettingsIcon />, label: 'Settings', path: '/admin/settings' },
      ];

    case 'auditor':
      return [
        {
          label: 'Audits',
          children: [
            { icon: <AuditIcon />, label: 'Audit Planning', path: `${ROUTES.AUDITOR}/planning` },
            { icon: <ClockIcon />, label: 'Schedule', path: `${ROUTES.AUDITOR}/schedule` },
            // { icon: <ClipboardCheckIcon />, label: 'Review Audit Plans', path: `${ROUTES.AUDITOR}/audit-review` },
            // { icon: <UsersIcon />, label: 'My Audit Teams', path: `${ROUTES.AUDITOR}/team` },
          ],
        },
        {
          label: 'Audit Reports',
          children: [
            { icon: <ReportsIcon />, label: 'Reports', path: `${ROUTES.AUDITOR}/reports` },
            { icon: <HiOutlineUpload />, label: 'History Upload', path: `${ROUTES.AUDITOR}/history-upload` },
            { icon: <DocumentIcon />, label: 'Final Summary', path: `${ROUTES.AUDITOR}/final-summary` },
          ],
        },
        {
          label: 'Audit Assignment',
          children: [
            { icon: <DashboardIcon />, label: 'Task Management', path: `${ROUTES.AUDITOR}/findings` },
            // { icon: <AuditIcon />, label: 'Lead Audit Final Review', path: `${ROUTES.AUDITOR}/lead-final-review` },
          ],
        },
        {
          label: 'Access',
          children: [
            { icon: <ShieldIcon />, label: 'My QR', path: `${ROUTES.AUDITOR}/my-qr` },
          ],
        },
      ];

    case 'auditeeowner':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: `${ROUTES.AUDITEE_OWNER}/dashboard` },
        { icon: <AuditIcon />, label: 'Audit Plans', path: `${ROUTES.AUDITEE_OWNER}/audit-plans` },
        { icon: <ReportsIcon />, label: 'Findings Management', path: `${ROUTES.AUDITEE_OWNER}/findings` },
        { icon: <QualityIcon />, label: 'CAPA Owner Management', path: `${ROUTES.AUDITEE_OWNER}/capa-management` },
        { icon: <DocumentIcon />, label: 'My Witnessed', path: `${ROUTES.AUDITEE_OWNER}/my-witnessed` },
        { icon: <ShieldIcon />, label: 'Scan QR Code', path: `${ROUTES.AUDITEE_OWNER}/audit-schedule` },
      ];

    case 'capaowner':
      return [
        { icon: <DashboardIcon />, label: 'Tasks', path: `${ROUTES.CAPA_OWNER}/tasks` },
        { icon: <DocumentIcon />, label: 'My Witnessed', path: `${ROUTES.CAPA_OWNER}/my-witnessed` },
        // { icon: <DashboardIcon />, label: 'Progress', path: `${ROUTES.CAPA_OWNER}/progress` },
      ];

    case 'director':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/director/dashboard' },
        { icon: <AuditIcon />, label: 'Review Audit Plans', path: '/director/review-plans' },
        { icon: <ClockIcon />, label: 'Extension Requests', path: '/director/extension-requests' },
        { icon: <ArchiveIcon />, label: 'Archived History', path: '/director/archived-history' },
        { icon: <DocumentIcon />, label: 'Final Summary & Effectiveness', path: '/director/final-summary' },
        // { icon: <AuditIcon />, label: 'Review Audit Results', path: '/director/review-results' },
        // { icon: <ReportsIcon />, label: 'Summary Report', path: '/director/summary-report' },
      ];
    case 'leadauditor':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: `${ROUTES.LEAD_AUDITOR}/dashboard` },
        { icon: <AuditIcon />, label: 'Audit Planning', path: '/lead-auditor/auditplanning' },
        { icon: <UsersIcon />, label: 'Specify Create Plan', path: '/lead-auditor/specify-create-plan' },
        { icon: <AuditIcon />, label: 'Audit Assignment', path: '/auditor/audit-assignment' },
        { icon: <DocumentIcon />, label: 'Review Reports', path: '/lead-auditor/lead-reports' },
        { icon: <ClipboardCheckIcon />, label: 'Action Review', path: '/lead-auditor/action-review' },
        { icon: <DocumentIcon />, label: 'Final Summary Review ', path: '/lead-auditor/final-summary-review' },
        { icon: <ArchiveIcon />, label: 'Archived History', path: '/lead-auditor/archived-history' },
      ];

    default:
      console.warn('No menu found for role:', role, '- Using base menu');
      return base;
  }
};

export default getRoleMenu;

