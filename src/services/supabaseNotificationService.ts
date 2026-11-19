// Supabase-based Notification Service
import { supabase } from '../supabaseClient';
import { COLUMNS, PAGE } from '../lib/columns';

export interface Notification {
  id: string;
  user_id: string;
  user_role: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
}

export const notificationService = {
  // Get user notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(COLUMNS.NOTIFICATION) // only real columns, never select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE.NOTIFICATIONS); // newest 50 — older ones are not shown

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return [];
    }
  },

  // Create notification
  async createNotification(notification: Partial<Notification>): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select(COLUMNS.NOTIFICATION)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating notification:', err);
      return null;
    }
  },

  // Mark as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return false;
    }
  },

  // Mark all as read for user
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      return false;
    }
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting notification:', err);
      return false;
    }
  },

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // head: true → the database returns ONLY the number, no rows at all.
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error getting unread count:', err);
      return 0;
    }
  }
};
