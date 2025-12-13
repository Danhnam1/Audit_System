import { apiClient } from '../hooks/axios';

export interface CreateAuditScheduleDto {
  auditId: string;
  milestoneName: string;
  dueDate: string; // ISO string
  notes?: string;
  status?: string;
}

export const addAuditSchedule = async (payload: CreateAuditScheduleDto): Promise<any> => {
  return apiClient.post('/AuditSchedule', payload) as any;
};

export const updateAuditSchedule = async (scheduleId: string | number, payload: Partial<CreateAuditScheduleDto>): Promise<any> => {
  return apiClient.put(`/AuditSchedule/${scheduleId}`, payload) as any;
};

export const deleteAuditSchedule = async (scheduleId: string | number): Promise<any> => {
  return apiClient.delete(`/AuditSchedule/${scheduleId}`) as any;
};

export const getAuditSchedules = async (auditId: string | number): Promise<any> => {
  return apiClient.get(`/AuditSchedule/audit/${auditId}`) as any;
};

export const getAuditScheduleByAudit = async (auditId: string | number): Promise<any> => {
  return apiClient.get(`/AuditSchedule/audit/${auditId}`) as any;
};

export default {
  addAuditSchedule,
  updateAuditSchedule,
  deleteAuditSchedule,
  getAuditSchedules,
};
