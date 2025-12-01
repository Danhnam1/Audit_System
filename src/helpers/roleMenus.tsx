import type { SidebarMenuItem } from '../components/Sidebar';
import { ROUTES } from '../constants';
import {
  UsersIcon,
  DashboardIcon,
  AuditIcon,
  ReportsIcon,
  UploadIcon,
  ClipboardCheckIcon,
  DocumentIcon,
  QualityIcon,
} from '../layouts/icons';


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
        { icon: <UsersIcon />, label: 'Department Management', path: '/admin/departments' },
        { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
        { icon: <QualityIcon />, label: 'Criteria Management', path: '/admin/criteria' },
        { icon: <ClipboardCheckIcon />, label: 'Checklist Management', path: '/admin/checklists' },
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
            // { icon: <ClipboardCheckIcon />, label: 'Review Audit Plans', path: `${ROUTES.AUDITOR}/audit-review` },
            // { icon: <UsersIcon />, label: 'My Audit Teams', path: `${ROUTES.AUDITOR}/team` },
          ],
        },
        {
          label: 'Audit Reports',
          children: [
            { icon: <ReportsIcon />, label: 'Reports', path: `${ROUTES.AUDITOR}/reports` },
            { icon: <UploadIcon />, label: 'History Upload', path: `${ROUTES.AUDITOR}/history-upload` },
          ],
        },
        {
          label: 'Audit Assignment',
          children: [
            { icon: <DashboardIcon />, label: 'Finding Management', path: `${ROUTES.AUDITOR}/findings` },
            { icon: <DashboardIcon />, label: 'Requests', path: `${ROUTES.AUDITOR}/requests` },
            { icon: <AuditIcon />, label: 'Lead Audit Final Review', path: `${ROUTES.AUDITOR}/lead-final-review` },
          ],
        },
      ];

    case 'auditeeowner':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.AUDITEE_OWNER },
        { icon: <AuditIcon />, label: 'Audit Plans', path: `${ROUTES.AUDITEE_OWNER}/audit-plans` },
        { icon: <ReportsIcon />, label: 'Findings Management', path: `${ROUTES.AUDITEE_OWNER}/findings` },
        { icon: <QualityIcon />, label: 'CAPA Owner Management', path: `${ROUTES.AUDITEE_OWNER}/capa-management` },
      ];

    case 'capaowner':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.CAPA_OWNER },
        { icon: <DashboardIcon />, label: 'Tasks', path: `${ROUTES.CAPA_OWNER}/tasks` },
        // { icon: <DashboardIcon />, label: 'Progress', path: `${ROUTES.CAPA_OWNER}/progress` },
      ];

    case 'director':
      return [
        // { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.DIRECTOR },
        { icon: <AuditIcon />, label: 'Review Audit Plans', path: '/director/review-plans' },
        // { icon: <AuditIcon />, label: 'Review Audit Results', path: '/director/review-results' },
        // { icon: <ReportsIcon />, label: 'Summary Report', path: '/director/summary-report' },
      ];
    case 'leadauditor':
      return [
        { icon: <AuditIcon />, label: 'Audit Planning', path: '/lead-auditor/auditplanning' },
        { icon: <AuditIcon />, label: 'Audit Assignment', path: '/auditor/audit-assignment' },
        { icon: <DocumentIcon />, label: 'Review Reports', path: '/lead-auditor/lead-reports' },
      ];

    default:
      console.warn('No menu found for role:', role, '- Using base menu');
      return base;
  }
};

export default getRoleMenu;

