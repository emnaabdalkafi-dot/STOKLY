import api from './api';

export interface InventaireFilterParams {
  site?: string;
  statut?: string;
  month?: string;
  year?: string;
  id_entrepot?: string;
  id_agent?: string;
  page?: number;
  per_page?: number;
}

export const inventaireService = {
  getInventaires: async (params?: InventaireFilterParams) => {
    const response = await api.get('/inventaires', { params });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/inventaires/stats');
    return response.data;
  },

  createInventaire: async (data: any) => {
    const response = await api.post('/inventaires', data);
    return response.data;
  },

  updateInventaire: async (id: number, data: any) => {
    const response = await api.put(`/inventaires/${id}`, data);
    return response.data;
  },

  deleteInventaire: async (id: number) => {
    const response = await api.delete(`/inventaires/${id}`);
    return response.data;
  },

  assignAgent: async (inventaireId: number, agentId: number) => {
    const response = await api.post(`/inventaires/${inventaireId}/assign`, { id_agent: agentId });
    return response.data;
  },

  addLigne: async (inventaireId: number, data: any) => {
    const response = await api.post(`/inventaires/${inventaireId}/lignes`, data);
    return response.data;
  }
};
