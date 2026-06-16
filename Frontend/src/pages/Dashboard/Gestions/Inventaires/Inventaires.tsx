import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import styles from '../Gestions.module.css';
import layoutStyles from '../../../../components/layout/layout.module.css';
import InventaireModals from './InventaireModals';
import { inventaireService, InventaireFilterParams } from '../../../../services/inventaireService';
import api from '../../../../services/api';
import echo from '../../../../services/echo';
import { formatCompactNumber } from '../../../../utils/formatters';

const Inventaires: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [inventaires, setInventaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      setModalType('add');
      setSelectedItem(null);
    } else if (action === 'addNote') {
      setModalType('addNote');
      setSelectedItem(null);
      fetchFilterOptions(); 
    }

    if (action) {
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  // Filters state
  const [filters, setFilters] = useState<InventaireFilterParams>({
    statut: 'tous',
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
  const [modalType, setModalType] = useState<'add' | 'delete' | 'details' | 'terminate'|'rapport' | 'addNote' | 'notes' | 'correctionRequests' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

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
  }, []); 
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

  const filteredInventaires = useMemo(() => {
    return inventaires.filter((item: any) => {
      const searchLower = searchSite.toLowerCase();
      const dateDebutStr = item.date_debut ? new Date(item.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const dateFinStr = item.date_fin ? new Date(item.date_fin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

      return (
        item.titre?.toLowerCase().includes(searchLower) ||
        item.site?.toLowerCase().includes(searchLower) ||
        dateDebutStr.includes(searchLower) ||
        dateFinStr.includes(searchLower)
      );
    });
  }, [inventaires, searchSite]);

  const handleFilterChange = (key: keyof InventaireFilterParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };


  const handleModalSuccess = (stayOpen = false) => {
    if (!stayOpen) setModalType(null);
    fetchInventaires(true);
    fetchStats();
  };

  const statusClass = (s: string) => {
    if (s === 'en cours') return `${styles.statusActif}`;
    if (s === 'cloture' || s === 'cloturé') return `${styles.statusInactif}`;
    if (s === 'en attente') return `${styles.statusEnAttente}`;
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
          <div className={layoutStyles.cardIcon}><i className="bi bi-box-seam" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Total Inventaires</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.total) : <span className={layoutStyles.loadingDots}></span>} </p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-hourglass-split" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>En attente</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.en_attente) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-arrow-repeat" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>En cours</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.en_cours) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={`${layoutStyles.cardIcon} ${layoutStyles.cardIconGold}`}><i className="bi bi-check-all" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Cloturés</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.clotures) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
      </div>
      <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
        <div className={styles.dashboardPanelHeader}>
          <h3>Liste des inventaires ({formatCompactNumber(filteredInventaires.length)})</h3>
          <div className={styles.dashboardPanelActions}>
            <div className={styles.search}>
              <i className="bi bi-search" />
              <input type="text" placeholder="Recherche..." value={searchSite} onChange={e => setSearchSite(e.target.value)} className={styles.searchInput} />
            </div>
            <button className={styles.ActionButton} onClick={() => setModalType('correctionRequests')}>
              <i className="bi bi-patch-check" /> Corrections
            </button>
            <button className={styles.ActionButton} onClick={() => { setSelectedItem(null); setModalType('add'); }}>
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
            <option value="cloture">Cloturé</option>
          </select>

          <select
            className={styles.filterSelect}
            value={filters.id_entrepot}
            onChange={e => handleFilterChange('id_entrepot', e.target.value)}
          >
            <option value="">Tous les entrepôts</option>
            {entrepotsList.map(e => <option key={e.id_entrepot} value={e.id_entrepot}>{e.nom.length > 20 ? `${e.nom.substring(0, 20)}...` : e.nom}</option>)}
          </select>

          <select
            className={styles.filterSelect}
            value={filters.id_agent}
            onChange={e => handleFilterChange('id_agent', e.target.value)}
          >
            <option value="">Tous les agents</option>
            {agentsList.map(a => <option key={a.id} value={a.id}>
              {`${a.nom} ${a.prenom}`.length > 20
              ? `${a.nom} ${a.prenom}`.substring(0, 20) + '...'
              : `${a.nom} ${a.prenom}`
            } </option>)}
          </select>
        </div>

        <div className={styles.dashboardTableWrap}>
          <table className={styles.dashboardTable}>
            <thead>
              <tr>
                
                <th><i className="bi bi-tag-fill" /> Titre</th>
                <th><i className="bi bi-geo-alt-fill" /> Site</th>
                <th><i className="bi bi-layers-fill" /> Type</th>
                <th><i className="bi bi-calendar" /> Date Début</th>
                <th><i className="bi bi-calendar" /> Date Fin</th>
                <th><i className="bi bi-info-circle-fill" /> Statut</th>
                <th></th>
              </tr>
            </thead>
            {loading ? (
  <tbody>
                                <tr >
                                    {Array.from({ length: 7}).map((_, index) => (
                                        <td key={index} >
                                            <span className={layoutStyles.loadingDots}></span>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>            ) : filteredInventaires.length === 0 ? (
              <tbody><tr><td colSpan={8} className={styles.tableEmptyMsg}>Aucun inventaire trouvé</td></tr></tbody>
            ) : (
              <tbody>
                {filteredInventaires.map((item: any) => (
                  <tr key={item.id_inventaire}>
                    
                    <td><p className={styles.dashboardUserName}>{item.titre || '—'}</p></td>
                    <td>{item.site || '—'}</td>
                    <td>
                      <span >
                        {item.type_source === 'tous' ? 'Tous' :
                          item.type_source === 'entrepot' ? `Entrepôt (${item.entrepot?.nom || '—'})` :
                            `Articles (${Array.from(new Set((item.lignes || []).map((l: any) => l.id_article))).length})`}
                      </span>
                    </td>
                    <td>{item.date_debut?.split('T')[0] || '—'}</td>
                    <td>{item.date_fin?.split('T')[0] || '—'}</td>
                    <td><span className={statusClass(item.statut)}>{item.statut=="cloture"?"cloturé":item.statut}</span></td>

                    <td>
                      <div >
                        <button className={styles.ActionButton}
                          onClick={() => { setSelectedItem(item); setModalType('notes'); }}
                        >
                          Notes
                        </button>

                        {item.statut !== 'cloture' &&

                          <button className={styles.ActionButton} onClick={() => { setSelectedItem(item); setModalType('details'); }} title="Détails">
                            Details
                          </button>

                        }
                        {item.statut == 'en cours' && (
                          <button
                            className={styles.ActionButton}
                            style={{ borderColor: 'green', color: 'green' }}
                            onClick={() => { setSelectedItem(item); setModalType('terminate'); }}
                            title="Voir le résumé"
                          >
                            Cloturer
                          </button>
                        )}
                        {item.statut == 'cloture' && (
                          <button
                            className={styles.ActionButton}
                            style={{ borderColor: 'blue', color: 'blue' }}
                            onClick={() => { setSelectedItem(item); setModalType('rapport'); }}
                            title="Voir le Rapport"
                          >
                            Rapport
                          </button>
                        )}
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
