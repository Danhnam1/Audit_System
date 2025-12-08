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

export const deleteNotification = async (notificationId: string): Promise<void> => {
  await apiClient.delete(`/admin/AdminNotification/${notificationId}`);
};

// Create a new notification
export const createNotification = async (notification: {
  userId: string; // recipient user id
  title: string;
  message: string;
  remarks?: string; // Remarks field (required by backend)
  entityType?: string;
  entityId?: string;
  category?: string;
}): Promise<AdminNotificationDTO> => {
  // Convert to PascalCase for .NET API
  const payload = {
    UserId: notification.userId,
    Title: notification.title,
    Message: notification.message,
    Remarks: notification.remarks || '', // Required field - use empty string if not provided
    EntityType: notification.entityType || null,
    EntityId: notification.entityId || null,
    Category: notification.category || null,
    Status: 'Sent',
    IsRead: false,
  };
  
  const res: any = await apiClient.post('/admin/AdminNotification', payload);
  return res?.data || res;
};

export default {
  getNotifications,
  getNotificationById,
  markNotificationRead,
  deleteNotification,
  createNotification,
};
