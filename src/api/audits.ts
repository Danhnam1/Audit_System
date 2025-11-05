import { apiClient } from './index';

export const createAudit = async (payload: any) => {
  const res = await apiClient.post('/Audits', payload);
  return res.data;
};

export default {
  createAudit,
};
