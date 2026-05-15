import api from './api';

export interface Notification {
  id_notification: number;
  type: string;
  id_type: number;
  action?: string;
  id_inventaire?: number;
  id_article?: number;
  id_agent?: number;
  message?: string;
  contenu: string;
  contenu_decoded?: any;
  statut: 'lu' | 'non lu';
  created_at: string;
  updated_at: string;
}

export const notificationService = {
  getNotifications: async () => {
    return api.get('/notifications');
  },
  getUnreadCount: async () => {
    return api.get('/notifications/unread-count');
  },
  markAsRead: async (id: number) => {
    return api.put(`/notifications/${id}/read`);
  },
  markAllAsRead: async () => {
    return api.put('/notifications/mark-all-read');
  }
};
