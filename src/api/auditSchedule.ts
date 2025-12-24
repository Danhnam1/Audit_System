import { apiClient } from '../hooks/axios';

export interface CreateAuditScheduleDto {
  auditId: string;
  milestoneName: string;
  dueDate: string; // ISO string
  notes?: string;
  status?: string;
}

export interface UpdateAuditScheduleDto {
  milestoneName: string;
  dueDate: string; // ISO string
  notes?: string;
  status?: string;
  // Note: scheduleId is passed via route parameter, NOT in body
  // Note: auditId is NOT included in update DTO
}

export const addAuditSchedule = async (payload: CreateAuditScheduleDto): Promise<any> => {
  return apiClient.post('/AuditSchedule', payload) as any;
};

export const updateAuditSchedule = async (scheduleId: string | number, payload: UpdateAuditScheduleDto): Promise<any> => {
  
  
  try {
    const response = await apiClient.put(`/AuditSchedule/${scheduleId}`, payload) as any;
    
    return response;
  } catch (error: any) {
   
    throw error;
  }
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
