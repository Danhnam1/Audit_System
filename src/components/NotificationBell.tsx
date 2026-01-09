import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import useAuthStore, { useUserId } from '../store/useAuthStore';
import { useSignalR } from '../contexts/SignalRContext';
import { getNotifications, markNotificationRead, deleteNotification, type AdminNotificationDTO } from '../api/notifications.ts';
import { unwrap } from '../utils/normalize';
import { toast } from 'react-toastify';
import type { NotificationData } from '../services/signalRService';

interface NotificationItem extends AdminNotificationDTO {
  createdAtDate?: Date | null;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuthStore();
  const userIdFromToken = useUserId(); // Get userId from JWT token
  const { isConnected: _isConnected, onNotification, offNotification } = useSignalR();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [statusFilter, setStatusFilter] = useState<'All' | 'Read' | 'Unread'>('All');
  
  // Check if notification is unread (only based on backend API response)
  const isUnread = useCallback((n: any) => {
    return !n.isRead && !n.readAt;
  }, []);

  // Filter notifications based on status and sort by creation date (newest first)
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Filter by status
    if (statusFilter !== 'All') {
      filtered = items.filter((n: any) => {
      const isRead = n.isRead || n.readAt;
      
      if (statusFilter === 'Unread') {
        return !isRead;
      } else {
        // statusFilter === 'Read'
        return isRead;
      }
      });
    }
    
    // Sort by creation date (newest first) - ensure filtered items are also sorted
    return filtered.sort((a: any, b: any) => {
      const aDate = a.createdAtDate || (a.createdAt ? new Date(a.createdAt) : null);
      const bDate = b.createdAtDate || (b.createdAt ? new Date(b.createdAt) : null);
      const aTime = aDate?.getTime() || 0;
      const bTime = bDate?.getTime() || 0;
      return bTime - aTime; // Newest first
    });
  }, [items, statusFilter]);

  // Only count notifications that are not read (only based on backend API response)
  const unreadCount = useMemo(() => {
    return items.filter(n => {
      const isRead = (n as any).isRead;
      const readAt = (n as any).readAt;
      return !isRead && !readAt;
    }).length;
  }, [items]);

  // Helper to normalize GUID for comparison (case-insensitive, remove any extra characters)
  const normalizeUserId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    // Convert to string, lowercase, remove all whitespace and special characters except hyphens
    let normalized = String(id).toLowerCase().trim();
    // Remove any curly braces or brackets that might be in the GUID
    normalized = normalized.replace(/[{}[\]]/g, '');
    return normalized;
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Use userId from JWT token (most reliable)
      const meId = normalizeUserId(userIdFromToken);

      const res = await getNotifications();
      const all = unwrap<AdminNotificationDTO>(res);

      // Filter notifications for current user
      // Compare normalized GUIDs (case-insensitive)
      const mine = (all || []).filter((n: any) => {
        const notificationUserId = normalizeUserId(n.userId || n.recipientId);
        
        // Primary: Match by userId from JWT token
        if (meId && notificationUserId) {
          return notificationUserId === meId;
        }
        
        // Fallback: Match by email (if backend stores email in userId field)
        if (!meId && user?.email) {
          const notificationEmail = String(n.userId || '').toLowerCase().trim();
          return notificationEmail === String(user.email).toLowerCase().trim();
        }
        
        return false;
      });

      // Exclude inactive notifications (those "deleted" by setting status to Inactive)
      const activeMine = mine.filter((n: any) => {
        const status = String(n.status || '').toLowerCase();
        return status !== 'inactive'; // only show active notifications
      });

      // Sort by creation date (newest first)
      const sorted: NotificationItem[] = activeMine
        .map((n: any) => ({
          ...n,
          createdAtDate: n.createdAt ? new Date(n.createdAt) : null
        }))
        .sort((a: any, b: any) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0));
      setItems(sorted);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userIdFromToken, user?.email]);

  // Load notifications from API when user ID is ready or email changes
  useEffect(() => {
    if (userIdFromToken || user?.email) {
      void load();
    }
  }, [load, userIdFromToken, user?.email]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Handle real-time notifications from SignalR
  // Use sessionStorage to track if we've already shown a notification to prevent duplicates across page navigations
  const getShownNotificationIds = (): Set<string> => {
    try {
      const stored = sessionStorage.getItem('shown_notification_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveShownNotificationIds = (ids: Set<string>) => {
    try {
      sessionStorage.setItem('shown_notification_ids', JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('Failed to save shown notification IDs:', error);
    }
  };

  const loadRef = useRef(load);
  
  // Keep loadRef updated
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  
  useEffect(() => {
    const handleNewNotification = async (data: NotificationData) => {
      // Check if this notification is for the current user
      const notificationUserId = normalizeUserId(data.userId);
      const currentUserId = normalizeUserId(userIdFromToken);
      
      if (notificationUserId && currentUserId && notificationUserId !== currentUserId) {
        return; // Not for this user, ignore
      }

      // Create a unique ID for this notification to prevent duplicates
      const notificationId = `${data.notificationId || data.title || ''}_${data.createdAt || Date.now()}`;
      
      // Check if we've already shown this notification (from sessionStorage)
      const shownIds = getShownNotificationIds();
      if (shownIds.has(notificationId)) {
        return;
      }
      
      // Mark as shown
      shownIds.add(notificationId);
      
      // Clean up old IDs (keep only last 100 to prevent memory leak)
      if (shownIds.size > 100) {
        const idsArray = Array.from(shownIds);
        const trimmedIds = new Set(idsArray.slice(-50));
        saveShownNotificationIds(trimmedIds);
      } else {
        saveShownNotificationIds(shownIds);
      }
      
      // Reload notifications from API to get the latest data
      // This ensures we have complete and up-to-date information from the server
      // No toast notification - users can check notification bell for new notifications
      await loadRef.current(true); // Silent reload (don't show loading spinner)
    };

    // Register callback - this will also trigger any pending notification
    onNotification(handleNewNotification);

    // Cleanup
    return () => {
      offNotification();
    };
  }, [onNotification, offNotification, user]); // Added 'user' to check role for filtering notifications

  const handleMarkRead = async (id: string) => {
    try {
      // Update backend first
      await markNotificationRead(id);
      
      // Update UI after successful backend update
      setItems(prev => prev.map(n => {
        if (String((n as any).notificationId) === String(id)) {
          return {
            ...(n as any),
            isRead: true,
            readAt: new Date().toISOString()
          } as any;
        }
        return n;
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter(n => {
      const isRead = (n as any).isRead;
      const readAt = (n as any).readAt;
      return !isRead && !readAt;
    });
    
    if (unread.length === 0) return;

    try {
      // Update backend for all unread notifications
      await Promise.all(
        unread.map(n => 
          markNotificationRead(String((n as any).notificationId || ''))
            .catch(err => {
              console.error(`Failed to mark notification ${(n as any).notificationId} as read:`, err);
              return null;
            })
        )
      );

      // Update UI after successful backend updates
      setItems(prev => prev.map(n => {
        const isRead = (n as any).isRead;
        const readAt = (n as any).readAt;
        if (!isRead && !readAt) {
          return {
            ...(n as any),
            isRead: true,
            readAt: new Date().toISOString()
          } as any;
        }
        return n;
      }));

      toast.success(`Marked ${unread.length} notification(s) as read`);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setItems(prev => prev.filter(n => String((n as any).notificationId) !== String(id)));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className="relative" ref={notificationRef}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-800 transition-colors duration-200"
        >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-hidden bg-white border border-gray-200 rounded-xl shadow-2xl z-50">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead} 
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            {/* Status filters */}
            <div className="flex gap-2">
              {(['All', 'Unread', 'Read'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {status === 'All' ? 'All' : status === 'Unread' ? 'Unread' : 'Read '}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto max-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500">Loading notifications...</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-medium text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">
                  {statusFilter === 'Unread' ? 'All notifications are read' : statusFilter === 'Read' ? 'No read notifications' : "You're all caught up!"}
                </p>
              </div>
            ) : (
              filteredItems.map((n) => {
                const unread = isUnread(n);

                return (
                  <div 
                    key={String((n as any).notificationId || Math.random())} 
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                      unread ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      {unread && (
                        <div className="mt-1.5 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                      {!unread && (
                        <div className="mt-1.5 w-2 h-2 flex-shrink-0"></div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${unread ? 'text-gray-900' : 'text-gray-700'}`}>
                              {(n as any).title || 'Notification'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                              {(n as any).message}
                            </p>
                            
                            {/* Category and time */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {(n as any).category && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                                  {(n as any).category}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {(n as any).createdAt ? new Date((n as any).createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : ''}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-start gap-1 flex-shrink-0">
                            {unread && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  (n as any).notificationId && handleMarkRead(String((n as any).notificationId));
                                }} 
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                title="Mark as read"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                (n as any).notificationId && handleDelete(String((n as any).notificationId));
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete notification"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
