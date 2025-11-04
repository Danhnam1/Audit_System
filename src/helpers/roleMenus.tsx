import type { SidebarMenuItem } from '../components/Sidebar';
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

  switch (role) {
    case 'Admin':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
        { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
        { icon: <AuditIcon />, label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: <ReportsIcon />, label: 'Reports', path: '/admin/reports' },
        { icon: <DatabaseIcon />, label: 'Database', path: '/admin/database' },
        { icon: <SettingsIcon />, label: 'Settings', path: '/admin/settings' },
      ];

    case 'SQAHead':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-head' },
        { icon: <AuditIcon />, label: 'Audit Review', path: '/sqa-head/review' },
        { icon: <ReportsIcon />, label: 'Reports', path: '/sqa-head/reports' },
        { icon: <UsersIcon />, label: 'Team', path: '/sqa-head/team' },
      ];

    case 'SQAStaff':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-staff' },
        { icon: <AuditIcon />, label: 'Audit Planning', path: '/sqa-staff/planning' },
        { icon: <DashboardIcon />, label: 'Finding Management', path: '/sqa-staff/findings' },
        { icon: <ReportsIcon />, label: 'Reports', path: '/sqa-staff/reports' },
        { icon: <DashboardIcon />, label: 'Requests', path: '/sqa-staff/requests' },
      ];

    case 'DepartmentHead':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/department-head' },
        { icon: <AuditIcon />, label: 'Audit Plans', path: '/department-head/audit-plans' },
        { icon: <UsersIcon />, label: 'Task Management', path: '/department-head/assign-tasks' },
        { icon: <AuditIcon />, label: 'Review Evidence', path: '/department-head/review-evidence' },
        { icon: <ReportsIcon />, label: 'Findings Progress', path: '/department-head/findings' },
       
      ];

    case 'DepartmentStaff':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/department-staff' },
        { icon: <DashboardIcon />, label: 'Review Audit Plans', path: '/director/review-plans' },
        { icon: <DashboardIcon />, label: 'Review Audit Results', path: '/director/review-results' },
      ];

    case 'Director':
      return [
        { icon: <DashboardIcon />, label: 'Dashboard', path: '/director' },
      ];

    default:
      return base;
  }
};

export default getRoleMenu;

