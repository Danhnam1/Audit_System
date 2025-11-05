import type { SidebarMenuItem } from '../components/Sidebar';
import { ROUTES } from '../constants';
import {
  UsersIcon,
  SettingsIcon,
  DashboardIcon,
  AuditIcon,
  ReportsIcon,
  DatabaseIcon,
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
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
        { icon: <UsersIcon />, label: 'Department Management', path: '/admin/departments' },
        { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
        { icon: <AuditIcon />, label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: <ReportsIcon />, label: 'Reports', path: '/admin/reports' },
        { icon: <DatabaseIcon />, label: 'Database', path: '/admin/database' },
        { icon: <SettingsIcon />, label: 'Settings', path: '/admin/settings' },
      ];

    case 'leadauditor':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.LEAD_AUDITOR },
        { icon: <AuditIcon />, label: 'Audit Review', path: `${ROUTES.LEAD_AUDITOR}/audit-review` },
        { icon: <ReportsIcon />, label: 'Reports', path: `${ROUTES.LEAD_AUDITOR}/reports` },
        { icon: <UsersIcon />, label: 'Team', path: `${ROUTES.LEAD_AUDITOR}/team` },
      ];

    case 'auditor':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.AUDITOR },
        { icon: <AuditIcon />, label: 'Audit Planning', path: `${ROUTES.AUDITOR}/planning` },
        { icon: <DashboardIcon />, label: 'Finding Management', path: `${ROUTES.AUDITOR}/findings` },
        { icon: <ReportsIcon />, label: 'Reports', path: `${ROUTES.AUDITOR}/reports` },
        { icon: <DashboardIcon />, label: 'Requests', path: `${ROUTES.AUDITOR}/requests` },
      ];

    case 'auditeeowner':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.AUDITEE_OWNER },
        { icon: <AuditIcon />, label: 'Audit Plans', path: `${ROUTES.AUDITEE_OWNER}/audit-plans` },
        { icon: <UsersIcon />, label: 'Task Management', path: `${ROUTES.AUDITEE_OWNER}/assign-tasks` },
        { icon: <AuditIcon />, label: 'Review Evidence', path: `${ROUTES.AUDITEE_OWNER}/review-evidence` },
        { icon: <ReportsIcon />, label: 'Findings Progress', path: `${ROUTES.AUDITEE_OWNER}/findings` },
      ];

    case 'capaowner':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.CAPA_OWNER },
        { icon: <DashboardIcon />, label: 'Tasks', path: `${ROUTES.CAPA_OWNER}/tasks` },
        { icon: <DashboardIcon />, label: 'Progress', path: `${ROUTES.CAPA_OWNER}/progress` },
      ];

    case 'director':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: ROUTES.DIRECTOR },
      ];

    default:
      console.warn('No menu found for role:', role, '- Using base menu');
      return base;
  }
};

export default getRoleMenu;

