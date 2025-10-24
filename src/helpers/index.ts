// Helper functions
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('vi-VN').format(date);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

export {};
