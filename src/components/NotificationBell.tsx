import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';
import { useSignalR } from '../contexts/SignalRContext';
import { getAdminUsers } from '../api/adminUsers';
import { getNotifications, markNotificationRead, deleteNotification, type AdminNotificationDTO } from '../api/notifications.ts';
import { unwrap } from '../utils/normalize';
import { toast } from 'react-toastify';
import type { NotificationData } from '../services/signalRService';

interface NotificationItem extends AdminNotificationDTO {
  createdAtDate?: Date | null;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuthStore();
  const { isConnected, onNotification, offNotification } = useSignalR();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [statusFilter, setStatusFilter] = useState<'All' | 'Read' | 'Unread'>('All');
  
  // Get read notifications from localStorage
  const getReadNotifications = (): Set<string> => {
    try {
      const stored = localStorage.getItem('read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Check if notification is unread
  const isUnread = useCallback((n: any) => {
    const notificationId = String(n.notificationId || '');
    const readSet = getReadNotifications();
    if (readSet.has(notificationId)) return false;
    return !n.isRead && !n.readAt;
  }, []);

  // Filter notifications based on status
  const filteredItems = useMemo(() => {
    if (statusFilter === 'All') return items;
    const readSet = getReadNotifications();
    return items.filter((n: any) => {
      const notificationId = String(n.notificationId || '');
      // Check if marked as read in localStorage
      const isMarkedRead = readSet.has(notificationId);
      // Check if marked as read in API response
      const isReadFromAPI = n.isRead || n.readAt;
      const isRead = isMarkedRead || isReadFromAPI;
      
      if (statusFilter === 'Unread') {
        return !isRead;
      } else {
        // statusFilter === 'Read'
        return isRead;
      }
    });
  }, [items, statusFilter]);

  // Save read notification to localStorage
  const markAsReadInStorage = (notificationId: string) => {
    try {
      const readSet = getReadNotifications();
      readSet.add(notificationId);
      localStorage.setItem('read_notifications', JSON.stringify(Array.from(readSet)));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  // Only count notifications that are not read
  // Check both: API isRead/readAt AND localStorage
  const unreadCount = useMemo(() => {
    const readSet = getReadNotifications();
    return items.filter(n => {
      const notificationId = String((n as any).notificationId || '');
      // Check if marked as read in localStorage
      if (readSet.has(notificationId)) {
        return false;
      }
      // Check if marked as read in API response
      const isRead = (n as any).isRead;
      const readAt = (n as any).readAt;
      return !isRead && !readAt;
    }).length;
  }, [items]);

  const load = async () => {
    setLoading(true);
    try {
      // Map current auth user to admin userId (backend ids)
      let meId = myUserId;
      if (!meId) {
        const admins = await getAdminUsers();
  const me = (admins || []).find((a: any) => String(a.email || '').toLowerCase() === String(user?.email || '').toLowerCase());
  if (me) meId = String(me.userId || me.$id || me.email);
        setMyUserId(meId || null);
      }

      const res = await getNotifications();
      const all = unwrap<AdminNotificationDTO>(res);
      const mine = (all || []).filter((n: any) => {
        if (meId) return String(n.userId || n.recipientId) === meId;
        // fallback by email if API stores email in userId
        if (user?.email) return String(n.userId || '').toLowerCase() === String(user.email).toLowerCase();
        return false;
      });

      // Merge with localStorage read status
      const readSet = getReadNotifications();
      const sorted: NotificationItem[] = mine
        .map((n: any) => {
          const notificationId = String(n.notificationId || '');
          // If marked as read in localStorage, ensure isRead is true
          if (readSet.has(notificationId) && !n.isRead) {
            return {
              ...n,
              isRead: true,
              readAt: n.readAt || new Date().toISOString(),
              createdAtDate: n.createdAt ? new Date(n.createdAt) : null
            };
          }
          return {
            ...n,
            createdAtDate: n.createdAt ? new Date(n.createdAt) : null
          };
        })
        .sort((a: any, b: any) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0));
      setItems(sorted);
    } finally {
      setLoading(false);
    }
  };

  // Load notifications from API on mount
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

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
  useEffect(() => {
    const handleNewNotification = (data: NotificationData) => {
      console.log('[NotificationBell] Received notification from SignalR:', data);
      
      // Use functional update to check if notification already exists
      setItems((prev) => {
        // Check if notification already exists
        const exists = prev.some(
          (item) => item.notificationId === data.notificationId
        );

        if (exists) {
          console.log('[NotificationBell] Notification already exists, skipping');
          return prev;
        }

        // Add new notification to the list
        const newItem: NotificationItem = {
          ...data,
          createdAtDate: data.createdAt 
            ? new Date(data.createdAt) 
            : new Date(),
        };
        
        console.log('[NotificationBell] Adding new notification to list');
        
        // Show toast notification
        toast.info(data.title || 'New notification', {
          position: 'top-right',
          autoClose: 5000,
        });
        
        return [newItem, ...prev];
      });
    };

    // Register callback
    onNotification(handleNewNotification);

    // Cleanup
    return () => {
      offNotification();
    };
  }, [onNotification, offNotification]);

  const handleMarkRead = async (id: string) => {
    // Save to localStorage immediately (works even without backend)
    markAsReadInStorage(id);
    
    // Update UI immediately
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

    // Try to update backend (optional - won't break if it fails)
    try {
      await markNotificationRead(id);
      // Optionally reload from API if backend update succeeds
      // await load();
    } catch (error) {
      // Silently fail - localStorage already saved, so it's fine
      console.log('Backend update failed, but saved to localStorage:', error);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter(n => {
      const notificationId = String((n as any).notificationId || '');
      const readSet = getReadNotifications();
      // Check both localStorage and API status
      if (readSet.has(notificationId)) return false;
      const isRead = (n as any).isRead;
      const readAt = (n as any).readAt;
      return !isRead && !readAt;
    });
    
    if (unread.length === 0) return;
    
    // Save all to localStorage immediately
    unread.forEach(n => {
      const id = String((n as any).notificationId || '');
      if (id) markAsReadInStorage(id);
    });

    // Update UI immediately
    setItems(prev => prev.map(n => {
      const notificationId = String((n as any).notificationId || '');
      const readSet = getReadNotifications();
      if (readSet.has(notificationId) && !(n as any).isRead) {
        return {
          ...(n as any),
          isRead: true,
          readAt: (n as any).readAt || new Date().toISOString()
        } as any;
      }
      return n;
    }));

    // Try to update backend (optional)
    try {
      await Promise.all(unread.map(n => markNotificationRead(String((n as any).notificationId || ''))).map(p => p.catch(() => null)));
    } catch (error) {
      console.log('Backend update failed, but saved to localStorage:', error);
    }

    toast.success(`Marked ${unread.length} notification(s) as read`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setItems(prev => prev.filter(n => String((n as any).notificationId) !== String(id)));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className="relative" ref={notificationRef}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors duration-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* SignalR connection indicator */}
        {isConnected && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></span>
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
                                onClick={() => (n as any).notificationId && handleMarkRead(String((n as any).notificationId))} 
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                title="Mark as read"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => (n as any).notificationId && handleDelete(String((n as any).notificationId))}
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
