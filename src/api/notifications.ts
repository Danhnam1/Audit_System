import { apiClient } from '../hooks/axios';
import { unwrap } from '../utils/normalize';

export interface AdminNotificationDTO {
  notificationId?: string;
  userId?: string; // recipient user id or email
  title?: string;
  message?: string;
  entityType?: string; // e.g. 'AuditPlan'
  entityId?: string; // related audit plan id
  category?: string; // e.g. 'AuditeeOwner' | 'AuditTeam' | 'DepartmentHead'
  isRead?: boolean;
  status?: string; // e.g. 'Sent' | 'Scheduled'
  createdAt?: string;
  readAt?: string | null;
}

export const getNotifications = async (): Promise<AdminNotificationDTO[]> => {
  const res: any = await apiClient.get('/admin/AdminNotification');
  return unwrap(res?.data || res?.$values || res?.values || res);
};

export const getNotificationById = async (notificationId: string): Promise<AdminNotificationDTO> => {
  const res: any = await apiClient.get(`/admin/AdminNotification/${notificationId}`);
  return res?.data || res;
};

export const markNotificationRead = async (notificationId: string): Promise<AdminNotificationDTO> => {
  const res: any = await apiClient.put(`/admin/AdminNotification/${notificationId}`, { isRead: true });
  return res?.data || res;
};

export default {
  getNotifications,
  getNotificationById,
  markNotificationRead,
};
