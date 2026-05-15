import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import styles from './Gestions.module.css';
import layoutStyles from '../../../components/layout/layout.module.css';
import InventaireModals from './InventaireModals';
import { inventaireService, InventaireFilterParams } from '../../../services/inventaireService';
import api from '../../../services/api';
import echo from '../../../services/echo';
import { formatCompactNumber } from '../../../utils/formatters';

const Inventaires: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [inventaires, setInventaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Auto-open modal if action is in URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      setModalType('add');
      setSelectedItem(null);
    } else if (action === 'addNote') {
      setModalType('addNote');
      setSelectedItem(null);
      fetchFilterOptions(); // Need inventory list for this modal
    }
    
    if (action) {
      // Clean up URL
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  // Filters state
  const [filters, setFilters] = useState<InventaireFilterParams>({
    statut: 'tous',
    month: '',
    year: '',
    id_entrepot: '',
    id_agent: '',
    page: 1
  });
  
  // Debounced search
  const [searchSite, setSearchSite] = useState('');

  // Dropdown options for filters
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [entrepotsList, setEntrepotsList] = useState<any[]>([]);

  // modal state
  const [modalType, setModalType] = useState<'add' | 'delete' | 'details' | 'terminate' | 'addNote' | 'notes' | 'correctionRequests' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      setFilters(prev => ({ ...prev, site: searchSite, page: 1 }));
    }, 500);
    return () => clearTimeout(delay);
  }, [searchSite]);

  const fetchInventaires = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await inventaireService.getInventaires(filters);
      setInventaires(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  const fetchStats = async () => {
    try {
      const res = await inventaireService.getStats();
      setStats(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [agentsRes, entrepotsRes] = await Promise.all([
        api.get('/agents'),
        api.get('/stock/entrepots')
      ]);
      setAgentsList(agentsRes.data.data || []);
      setEntrepotsList(entrepotsRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const hasToken = localStorage.getItem('token');
    if (!hasToken) { navigate('/'); return; }
    fetchFilterOptions();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      const updatedItem = inventaires.find((item: any) => item.id_inventaire === selectedItem.id_inventaire);
      if (updatedItem) {
        setSelectedItem(updatedItem);
      }
    }
  }, [inventaires]);

  useEffect(() => {
    fetchInventaires();
  }, [fetchInventaires]);

  // WebSocket listener — runs only once on mount
  useEffect(() => {
    const channel = echo.private('admin');

    channel.listen('.inventaire.status.updated', (event: any) => {
      setInventaires(prev => prev.map((item: any) => 
        item.id_inventaire === event.id_inventaire ? { ...item, ...event } : item
      ));
      fetchStats();
    });

    channel.listen('.scan.enregistre', (event: any) => {
      setInventaires(prev => prev.map((item: any) => {
        if (item.id_inventaire === event.id_inventaire) {
          const updatedLignes = (item.lignes || []).map((l: any) => {
            if (l.id_article === event.article.id_article) {
              return { ...l, quantite_comptee: event.quantite_comptee, ecart: event.ecart };
            }
            return l;
          });
          return { ...item, lignes: updatedLignes };
        }
        return item;
      }));
      fetchStats();
    });

    return () => {
      channel.stopListening('.inventaire.status.updated');
      channel.stopListening('.scan.enregistre');
      echo.leave('admin');
    };
  }, []); // empty deps = mount/unmount only

  // Auto-open modal if action=notes is in URL
  useEffect(() => {
    const action = searchParams.get('action');
    const invId = searchParams.get('id_inventaire');
    
    if (action === 'notes' && invId) {
      setSelectedItem({ id_inventaire: parseInt(invId) });
      setModalType('notes');
      
      searchParams.delete('action');
      searchParams.delete('id_inventaire');
      setSearchParams(searchParams);
    } else if (action === 'details' && invId) {
      setSelectedItem({ id_inventaire: parseInt(invId) });
      setModalType('details');
      
      searchParams.delete('action');
      searchParams.delete('id_inventaire');
      setSearchParams(searchParams);
    }
  }, [searchParams, inventaires]);

  const handleFilterChange = (key: keyof InventaireFilterParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(inventaires.map(inv => inv.id_inventaire));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer les ${selectedIds.length} inventaires sélectionnés ?`)) return;
    
    setIsDeletingBulk(true);
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/inventaires/${id}`)));
      setSelectedIds([]);
      fetchInventaires();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression groupée.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleModalSuccess = (stayOpen = false) => {
    if (!stayOpen) setModalType(null);
    fetchInventaires(true);
    fetchStats();
  };

  const statusClass = (s: string) => {
    if (s === 'en cours') return `${styles.statusBadge} ${styles.statusActif}`;
    if (s === 'termine' || s === 'terminé') return `${styles.statusBadge} ${styles.statusInactif}`;
    if (s === 'en attente') return `${styles.statusBadge} ${styles.statusWaiting}`;
    return `${styles.statusBadge}`;
  };

  if (!user) return <div className={layoutStyles.dashboardLoading}><span className={layoutStyles.loadingDots}></span></div>;

  return (
    <main className={styles.dashboardMain}>
      {modalType && (
        <InventaireModals
          modalType={modalType}
          selectedItem={selectedItem}
          onClose={() => setModalType(null)}
          onSuccess={handleModalSuccess}
        />
      )}

     <div className={layoutStyles.overviewGrid}>
                <div className={layoutStyles.statCard}>
                    <div className={styles.dashboardCardIcon}><i className="bi bi-box-seam" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Total Inventaires</p>
                        <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.total) : <span className={layoutStyles.loadingDots}></span>} </p>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={styles.dashboardCardIcon}><i className="bi bi-hourglass-split" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>En attente</p>
                        <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.en_attente) : <span className={layoutStyles.loadingDots}></span>}</p>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={styles.dashboardCardIcon}><i className="bi bi-arrow-repeat" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>En cours</p>
                        <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.en_cours) : <span className={layoutStyles.loadingDots}></span>}</p>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={`${styles.dashboardCardIcon} ${styles.cardIconGold}`}><i className="bi bi-check-all" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Terminés</p>
                        <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.termines) : <span className={layoutStyles.loadingDots}></span>}</p>
                    </div>
                </div>
            </div>
      <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
        <div className={styles.dashboardPanelHeader}>
          <h3>Liste des inventaires ({formatCompactNumber(inventaires.length)})</h3>
          <div className={styles.dashboardPanelActions}>
            <div className={styles.searchAgents}>
            <i className="bi bi-search" />
            <input type="text" placeholder="Recherche..." value={searchSite} onChange={e => setSearchSite(e.target.value)} className={styles.searchInput} />
          </div>
            <button className={styles.ActionButton} onClick={() => setModalType('correctionRequests')}>
              <i className="bi bi-patch-check" /> Corrections
            </button>
            <button className={styles.addButton} onClick={() => { setSelectedItem(null); setModalType('add'); }}>
              <i className="bi bi-plus-lg" />
              Créer Inventaire
            </button>
          </div>
        </div>

        {/* 2. Barre de recherche / filtres */}
        <div className={styles.filterStrip}>
          
          <select 
            className={styles.filterSelect} 
            value={filters.statut}
            onChange={e => handleFilterChange('statut', e.target.value)}
          >
            <option value="tous">Tous les statuts</option>
            <option value="en attente">En attente</option>
            <option value="en cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>

          <select 
            className={styles.filterSelect} 
            value={filters.id_entrepot}
            onChange={e => handleFilterChange('id_entrepot', e.target.value)}
          >
            <option value="">Tous les entrepôts</option>
            {entrepotsList.map(e => <option key={e.id_entrepot} value={e.id_entrepot}>{e.nom}</option>)}
          </select>

          <select 
           className={styles.filterSelect} 
            value={filters.id_agent}
            onChange={e => handleFilterChange('id_agent', e.target.value)}
          >
            <option value="">Tous les agents</option>
            {agentsList.map(a => <option key={a.id} value={a.id}>{a.nom} {a.prenom}</option>)}
          </select>
          <select 
            className={styles.filterSelect} 
            value={filters.month}
            onChange={e => handleFilterChange('month', e.target.value)}
          >
            <option value="">Tous les mois</option>
            <option value="1">Janvier</option>
            <option value="2">Février</option>
            <option value="3">Mars</option>
            <option value="4">Avril</option>
            <option value="5">Mai</option>
            <option value="6">Juin</option>
            <option value="7">Juillet</option>
            <option value="8">Août</option>
            <option value="9">Septembre</option>
            <option value="10">Octobre</option>
            <option value="11">Novembre</option>
            <option value="12">Décembre</option>
          </select>

          <select 
            className={styles.filterSelect} 
            value={filters.year}
            onChange={e => handleFilterChange('year', e.target.value)}
          >
            <option value="">Toutes les années</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>


        {selectedIds.length > 0 && (
          <div className={styles.bulkActions}>
            <div className={styles.selectionInfo}>
              <i className="bi bi-check2-circle" style={{ marginRight: '8px', color: '#102a43' }} />
              {selectedIds.length} inventaire(s) sélectionné(s)
            </div>
            <div style={{ flex: 1 }} />
            <button 
              className={styles.ActionButton} 
              style={{ color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? <span className={layoutStyles.loadingDots} /> : <><i className="bi bi-trash" /> Supprimer la sélection</>}
            </button>
            <button className={styles.ActionButton} onClick={() => setSelectedIds([])}>
              Annuler
            </button>
          </div>
        )}

        <div className={layoutStyles.tableWrap}>
          <table className={styles.dashboardTable}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox} 
                    checked={selectedIds.length > 0 && selectedIds.length === inventaires.length} 
                    onChange={handleSelectAll} 
                  />
                </th>
                <th><i className="bi bi-tag-fill" /> Titre</th>
                <th><i className="bi bi-geo-alt-fill" /> Site</th>
                <th><i className="bi bi-layers-fill" /> Type</th>
                <th><i className="bi bi-calendar" /> Date Début</th>
                <th><i className="bi bi-calendar" /> Date Fin</th>
                <th><i className="bi bi-info-circle-fill" /> Statut</th>
                <th><i className="bi bi-chat-left-text-fill" /> Notes</th>
                <th></th>
              </tr>
            </thead>
            {loading ? (
              <tbody><tr><td colSpan={8} className={styles.tableEmptyMsg}><span className={layoutStyles.loadingDots}></span></td></tr></tbody>
            ) : inventaires.length === 0 ? (
              <tbody><tr><td colSpan={8} className={styles.tableEmptyMsg}>Aucun inventaire trouvé</td></tr></tbody>
            ) : (
              <tbody>
                {inventaires.map((item: any) => (
                  <tr key={item.id_inventaire} className={selectedIds.includes(item.id_inventaire) ? styles.rowSelected : ''}>
                    <td>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox} 
                        checked={selectedIds.includes(item.id_inventaire)} 
                        onChange={() => handleSelectOne(item.id_inventaire)} 
                      />
                    </td>
                    <td><p className={styles.dashboardUserName}>{item.titre || '—'}</p></td>
                    <td>{item.site || '—'}</td>
                    <td>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {item.type_source === 'tous' ? 'Tous' : 
                         item.type_source === 'entrepot' ? `Entrepôt (${item.entrepot?.nom || '—'})` : 
                         `Articles (${item.lignes?.length || 0})`}
                      </span>
                    </td>
                    <td>{item.date_debut?.split('T')[0] || '—'}</td>
                    <td>{item.date_fin?.split('T')[0] || '—'}</td>
                    <td><span className={statusClass(item.statut)}>{item.statut}</span></td>
                    <td>
                      <button 
                        className={styles.ActionButton} 
                        style={{ position: 'relative' }}
                        onClick={() => { setSelectedItem(item); setModalType('notes'); }}
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {item.statut !== 'termine' &&

                          <button className={styles.ActionButton} onClick={() => { setSelectedItem(item); setModalType('details'); }} title="Détails">
                            Details
                          </button>
                        
                        }
                        {item.statut !== 'termine' ? (
                          <button 
                            className={styles.ActionButton} 
                            style={{ borderColor: '#00ac3fff', color: '#00ac3fff' }} 
                            onClick={() => { setSelectedItem(item); setModalType('terminate'); }}
                            title="Voir le résumé"
                          >
                            Terminer
                          </button>
                        ) : (
                          <button 
                            className={styles.ActionButton} 
                            style={{ borderColor: '#3b82f6', color: '#3b82f6' }} 
                            onClick={() => { setSelectedItem(item); setModalType('terminate'); }}
                            title="Voir le Rapport"
                          >
                            Rapport
                          </button>
                        )}
                        <button className={`${styles.ActionButton} ${styles.deleteButton}`} onClick={() => { setSelectedItem(item); setModalType('delete'); }} title="Supprimer">
                          Supprimer 
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        

      </section>
    </main>
  );
};

export default Inventaires;
