import React, { useEffect, useState, useRef } from 'react';
import { useSignalR } from '../contexts/SignalRContext';
import { getNotifications, type AdminNotificationDTO } from '../api/notifications';
import type { NotificationData } from '../services/signalRService';
import useAuthStore, { useUserId } from '../store/useAuthStore';
import { unwrap } from '../utils/normalize';

interface NotificationToastProps {
  notification: AdminNotificationDTO | NotificationData;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);
    
    // Auto close after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  // Removed navigation on click - just close the toast

  const title = (notification as any).title || 'Notification';
  const message = (notification as any).message || '';
  const isUnread = !(notification as any).isRead && !(notification as any).readAt;

  return (
    <div
      className={`fixed left-4 bottom-4 z-[9999] transition-all duration-300 ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0'
      }`}
      style={{ maxWidth: '400px', width: 'calc(100vw - 2rem)' }}
    >
      <div
        className={`bg-white rounded-lg shadow-2xl border-l-4 transition-all ${
          isUnread ? 'border-blue-500' : 'border-gray-300'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isUnread ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <svg
                className={`w-5 h-5 ${isUnread ? 'text-blue-600' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                    {title}
                  </h4>
                  {message && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {message}
                    </p>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Container component to manage multiple toasts
export const NotificationToastContainer: React.FC = () => {
  const { onNotification, offNotification } = useSignalR();
  const { user } = useAuthStore();
  const userIdFromToken = useUserId();
  const [toasts, setToasts] = useState<Array<{ id: string; notification: AdminNotificationDTO | NotificationData }>>([]);

  // Helper to normalize GUID for comparison
  const normalizeUserId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    let normalized = String(id).toLowerCase().trim();
    normalized = normalized.replace(/[{}[\]]/g, '');
    return normalized;
  };

  // Track shown notification IDs to prevent duplicates
  const getShownNotificationIds = (): Set<string> => {
    try {
      const stored = sessionStorage.getItem('shown_toast_notification_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveShownNotificationIds = (ids: Set<string>) => {
    try {
      sessionStorage.setItem('shown_toast_notification_ids', JSON.stringify(Array.from(ids)));
    } catch (error) {
      // Silently fail
    }
  };

  // Track last loaded notification ID to detect new ones
  const lastNotificationIdRef = useRef<string | null>(null);
  const lastLoadTimeRef = useRef<number>(0);

  // Load notifications from API and show toast for newest one
  const loadAndShowNewestNotification = async () => {
    try {
      const meId = normalizeUserId(userIdFromToken);
      if (!meId && !user?.email) return;

      const res = await getNotifications();
      const all = unwrap<AdminNotificationDTO>(res);

      // Filter notifications for current user
      const mine = (all || []).filter((n: any) => {
        const notificationUserId = normalizeUserId(n.userId || n.recipientId);
        
        if (meId && notificationUserId) {
          return notificationUserId === meId;
        }
        
        if (!meId && user?.email) {
          const notificationEmail = String(n.userId || '').toLowerCase().trim();
          return notificationEmail === String(user.email).toLowerCase().trim();
        }
        
        return false;
      });

      // Exclude inactive notifications (same as NotificationBell)
      const activeMine = mine.filter((n: any) => {
        const status = String(n.status || '').toLowerCase();
        return status !== 'inactive';
      });

      // Apply same filter default as NotificationBell:
      // 1. Filter by status: 'All' (default) - show all notifications
      // 2. Sort by creation date (newest first)
      let filtered = activeMine;
      
      // Note: For toast, we show all notifications (statusFilter = 'All' by default)
      // If you want to only show unread, you can add filter here:
      // filtered = activeMine.filter((n: any) => !n.isRead && !n.readAt);

      // Sort by creation date (newest first) - same as NotificationBell filteredItems
      const sorted = filtered
        .map((n: any) => ({
          ...n,
          createdAtDate: n.createdAt ? new Date(n.createdAt) : null
        }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAtDate?.getTime() || 0;
          const bTime = b.createdAtDate?.getTime() || 0;
          return bTime - aTime; // Newest first (same as NotificationBell filteredItems)
        });

      // Get the newest notification (applying same filter default as NotificationBell)
      if (sorted.length > 0) {
        const newest = sorted[0];
        const notificationId = String(newest.notificationId || newest.id || '');
        
        // Only show if it's a new notification (different from last one)
        if (notificationId && notificationId !== lastNotificationIdRef.current) {
          // Create a unique ID for tracking
          const uniqueId = `${notificationId}_${newest.createdAt || Date.now()}`;
          
          // Check if we've already shown this notification
          const shownIds = getShownNotificationIds();
          if (!shownIds.has(uniqueId)) {
            // Mark as shown
            shownIds.add(uniqueId);
            
            // Clean up old IDs
            if (shownIds.size > 50) {
              const idsArray = Array.from(shownIds);
              const trimmedIds = new Set(idsArray.slice(-25));
              saveShownNotificationIds(trimmedIds);
            } else {
              saveShownNotificationIds(shownIds);
            }

            // Update last notification ID
            lastNotificationIdRef.current = notificationId;
            
            // Add toast - only show newest notification (filter default: newest first)
            const toastId = `toast_${Date.now()}_${Math.random()}`;
            setToasts((prev) => [...prev, { id: toastId, notification: newest }]);
          }
        }
      }
      
      lastLoadTimeRef.current = Date.now();
    } catch (error) {
      // Silently fail
    }
  };

  // Load notifications on mount and periodically
  useEffect(() => {
    if (userIdFromToken || user?.email) {
      // Initial load
      loadAndShowNewestNotification();
      
      // Poll for new notifications every 10 seconds
      const intervalId = setInterval(() => {
        loadAndShowNewestNotification();
      }, 10000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [userIdFromToken, user?.email]);

  // Also listen to SignalR notifications
  useEffect(() => {
    const handleNewNotification = (data: NotificationData) => {
      // Check if this notification is for the current user
      const notificationUserId = normalizeUserId(data.userId);
      const currentUserId = normalizeUserId(userIdFromToken);

      if (notificationUserId && currentUserId && notificationUserId !== currentUserId) {
        return; // Not for this user, ignore
      }

      // Create a unique ID for this notification
      const notificationId = `${data.notificationId || data.title || ''}_${data.createdAt || Date.now()}`;

      // Check if we've already shown this notification
      const shownIds = getShownNotificationIds();
      if (shownIds.has(notificationId)) {
        return;
      }

      // Mark as shown
      shownIds.add(notificationId);

      // Clean up old IDs (keep only last 50)
      if (shownIds.size > 50) {
        const idsArray = Array.from(shownIds);
        const trimmedIds = new Set(idsArray.slice(-25));
        saveShownNotificationIds(trimmedIds);
      } else {
        saveShownNotificationIds(shownIds);
      }

      // Update last notification ID
      if (data.notificationId) {
        lastNotificationIdRef.current = String(data.notificationId);
      }

      // Add toast
      const toastId = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id: toastId, notification: data }]);
    };

    // Register callback
    onNotification(handleNewNotification);

    // Cleanup
    return () => {
      offNotification();
    };
  }, [onNotification, offNotification, userIdFromToken, user]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed left-4 bottom-4 z-[9999] space-y-3" style={{ maxWidth: '400px' }}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 9999 - index,
          }}
        >
          <NotificationToast
            notification={toast.notification}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;

