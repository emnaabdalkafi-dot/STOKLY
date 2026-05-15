import api from './api';

export interface Activity {
  user: string;
  action: string;
  time: string;
  type: 'agent' | 'inventaire' | 'alerte';
}

export const dashboardService = {
  getDashboardData: async (invId: string = 'all') => {
    return api.get(`/dashboard?inv_id=${invId}`);
  }
};
