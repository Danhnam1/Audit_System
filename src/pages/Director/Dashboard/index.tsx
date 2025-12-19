import React from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { AuditDashboard } from '../../../components/Dashboard/AuditDashboard';

const DirectorDashboard: React.FC = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: (user as any).fullName || (user as any).name || 'User', avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <AuditDashboard />
    </MainLayout>
  );
};

export default DirectorDashboard;

