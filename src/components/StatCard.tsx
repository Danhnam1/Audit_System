import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'primary' | 'primary-light' | 'primary-medium' | 'primary-dark' | 'gray';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  variant = 'primary-light',
  className = '' 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          border: 'border-primary-100',
          text: 'text-primary-600',
          iconBg: 'bg-primary-100'
        };
      case 'primary-light':
        return {
          border: 'border-primary-100',
          text: 'text-primary-700',
          iconBg: 'bg-primary-200'
        };
      case 'primary-medium':
        return {
          border: 'border-primary-100',
          text: 'text-primary-700',
          iconBg: 'bg-primary-200'
        };
      case 'primary-dark':
        return {
          border: 'border-primary-100',
          text: 'text-primary-600',
          iconBg: 'bg-primary-600 text-white'
        };
      case 'gray':
        return {
          border: 'border-gray-100',
          text: 'text-gray-600',
          iconBg: 'bg-gray-100'
        };
      default:
        return {
          border: 'border-primary-100',
          text: 'text-primary-600',
          iconBg: 'bg-primary-100'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`bg-white rounded-xl border ${styles.border} shadow-md p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className={`text-3xl font-bold ${styles.text} mt-1`}>{value}</p>
        </div>
        <div className={`${styles.iconBg} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
