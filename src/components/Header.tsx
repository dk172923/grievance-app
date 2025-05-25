'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellIcon, HomeIcon, ArrowLeftOnRectangleIcon, UserIcon } from '@heroicons/react/24/outline';

interface Notification {
  id: number;
  message: string;
  grievance_id: number;
  is_read: boolean;
  created_at: string;
}

interface HeaderProps {
  role: 'user' | 'employee';
}

export default function Header({ role }: HeaderProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;

      if (session) {
        const channel = supabase
          .channel('notifications')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              setNotifications((prev) => [payload.new as Notification, ...prev]);
            }
          )
          .subscribe();

        await fetchNotifications();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    initialize();
  }, []);

  const fetchNotifications = async () => {
    const sessionResponse = await supabase.auth.getSession();
    const session = sessionResponse.data.session;
    if (!session) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const markNotificationAsRead = async (notificationId: number) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    router.push('/');
    router.refresh();
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <header className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-wide cursor-pointer">Grievance Portal</h1>
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/${role}`}>
            <button className="flex items-center px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-800 transition-all duration-300 cursor-pointer">
              <HomeIcon className="h-5 w-5 mr-2" />
              Home
            </button>
          </Link>
          <Link href={`/dashboard/${role}/profile`}>
            <button className="flex items-center px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-800 transition-all duration-300 cursor-pointer">
              <UserIcon className="h-5 w-5 mr-2" />
              Profile
            </button>
          </Link>
          <div className="relative">
            <button onClick={toggleNotifications} className="relative">
              <BellIcon className="h-8 w-8 text-white hover:text-gray-200 transition-all duration-300 cursor-pointer" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Notifications</h3>
                  {notifications.length === 0 ? (
                    <p className="text-gray-600">No unread notifications.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="p-3 mb-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-all duration-200 cursor-pointer"
                        onClick={() => markNotificationAsRead(notif.id)}
                      >
                        <p className="text-sm text-gray-800">{notif.message}</p>
                        <p className="text-xs text-gray-600">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-300 cursor-pointer"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}