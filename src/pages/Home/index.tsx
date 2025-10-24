import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

const HomePage = () => {
  const roles = [
    {
      name: 'Admin',
      path: ROUTES.ADMIN,
      description: 'Full system access and management',
      color: 'from-purple-500 to-purple-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      name: 'SQA Staff',
      path: ROUTES.SQA_STAFF,
      description: 'Quality assurance and testing',
      color: 'from-blue-500 to-blue-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: 'Department Staff',
      path: ROUTES.DEPARTMENT_STAFF,
      description: 'Department operations',
      color: 'from-green-500 to-green-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: 'Department Head',
      path: ROUTES.DEPARTMENT_HEAD,
      description: 'Department management',
      color: 'from-indigo-500 to-indigo-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Audit Internal',
      path: ROUTES.AUDIT_INTERNAL,
      description: 'Internal audit functions',
      color: 'from-orange-500 to-orange-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'Audit External',
      path: ROUTES.AUDIT_EXTERNAL,
      description: 'External audit access',
      color: 'from-red-500 to-red-700',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">AMS Web Portal</h1>
          <p className="text-xl text-gray-600">Audit Management System</p>
          <p className="text-gray-500 mt-2">Select your role to access the portal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Link
              key={role.path}
              to={role.path}
              className="group"
            >
              <div className={`bg-gradient-to-br ${role.color} rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 p-8 text-white`}>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 opacity-90 group-hover:opacity-100 transition-opacity">
                    {role.icon}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{role.name}</h2>
                  <p className="text-white/80">{role.description}</p>
                  <div className="mt-4 flex items-center text-sm font-medium">
                    <span>Access Portal</span>
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">© 2025 AMS Web. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
