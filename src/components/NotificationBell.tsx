import React, { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import { getAdminUsers } from '../api/adminUsers';
import { getNotifications, markNotificationRead, type AdminNotificationDTO } from '../api/notifications.ts';
import { unwrap } from '../utils/normalize';

interface NotificationItem extends AdminNotificationDTO {
  createdAtDate?: Date | null;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const unreadCount = useMemo(() => items.filter(n => !(n as any).isRead && !(n as any).readAt).length, [items]);

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

      const sorted: NotificationItem[] = mine
        .map((n: any) => ({ ...n, createdAtDate: n.createdAt ? new Date(n.createdAt) : null }))
        .sort((a: any, b: any) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0));
      setItems(sorted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems(prev => prev.map(n => (String((n as any).notificationId) === String(id) ? ({ ...(n as any), isRead: true, readAt: new Date().toISOString() } as any) : n)));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter(n => !(n as any).isRead && !(n as any).readAt);
    await Promise.all(unread.map(n => markNotificationRead(String((n as any).notificationId || ''))).map(p => p.catch(() => null)));
    setItems(prev => prev.map(n => ({ ...(n as any), isRead: true, readAt: (n as any).readAt || new Date().toISOString() } as any)));
  };

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-700"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">Thông báo</span>
              <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:underline">Đánh dấu đã đọc</button>
            </div>
            <div className="flex gap-2 text-xs">
              {['All','AuditeeOwner','AuditTeam','DepartmentHead'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-2 py-0.5 rounded-full border ${categoryFilter===c ? 'bg-primary-50 text-primary-700 border-primary-200' : 'text-gray-600 hover:bg-gray-50 border-gray-200'}`}
                >
                  {c === 'All' ? 'Tất cả' : c}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Đang tải...</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Không có thông báo</div>
            ) : (
              items
                .filter((n) => categoryFilter==='All' || (n as any).category === categoryFilter)
                .map((n) => (
                <div key={String((n as any).notificationId || Math.random())} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{(n as any).title || 'Thông báo'}</p>
                      <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{(n as any).message}</p>
                      {(n as any).category && (
                        <span className="mt-1 inline-flex text-[10px] items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {(n as any).category}
                        </span>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{(n as any).createdAt ? new Date((n as any).createdAt).toLocaleString() : ''}</p>
                    </div>
                    {!((n as any).isRead) && (
                      <button onClick={() => (n as any).notificationId && handleMarkRead(String((n as any).notificationId))} className="text-xs text-primary-600 hover:underline">
                        Đánh dấu đọc
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
