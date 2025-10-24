// Page components with lazy loading
// Auth pages
export { LoginPage } from './Auth';

// Home page - not lazy loaded for better initial performance
export { default as HomePage } from './Home/index.tsx';

// Welcome pages for each role - exported normally (lazy loading done in AppRoutes.tsx)
export { default as AdminWelcome } from './Admin/Welcome';
export { default as SQAStaffWelcome } from './SQAStaff/Welcome';
export { default as SQAHeadWelcome } from './SQAHead/Welcome';
export { default as DepartmentStaffWelcome } from './DepartmentStaff/Welcome';
export { default as DepartmentHeadWelcome } from './DepartmentHead/Welcome';
export { default as DirectorWelcome } from './Director/Welcome';

