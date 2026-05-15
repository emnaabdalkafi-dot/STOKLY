import api from './api';

export interface CorrectionRequest {
  id_corr: number;
  id_ligne_inventaire: number;
  id_agent: number;
  id_admin?: number;
  qte: number;
  description: string;
  statut_validation: 'en attente' | 'valide' | 'refuse';

  created_at: string;
  agent?: any;
  ligne?: {
    id_ligne: number;
    quantite_theorique: number;
    quantite_comptee: number;
    article: {
      nom: string;
      code_barres: string;
    };
    inventaire: {
      titre: string;
      site: string;
    };
  };
}

export const correctionService = {
  getCorrections: async (statut?: string) => {
    return api.get('/corrections', { params: { statut } });
  },
  requestCorrection: async (data: { id_ligne_inventaire: number; qte: number; description: string }) => {
    return api.post('/corrections', data);
  },
  validateCorrection: async (id: number, data: { statut: 'valide' | 'refuse' }) => {
    return api.put(`/corrections/${id}/validate`, data);
  }
};
