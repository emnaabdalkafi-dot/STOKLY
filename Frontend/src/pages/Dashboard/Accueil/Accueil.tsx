import React, { useEffect, useState, useCallback } from 'react';
import api, { BACKEND_URL } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import echo from '../../../services/echo';
import styles from './Accueil.module.css';
import layoutStyles from '../../../components/layout/layout.module.css';
import { formatCompactNumber } from '../../../utils/formatters';

const Accueil: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInventory, setSelectedInventory] = useState<number | 'all'>('all');

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const query = selectedInventory !== 'all' ? `?inv_id=${selectedInventory}` : '';
    api.get(`/dashboard${query}`)
      .then(res => {
        if (res.data.success) {
          setData(res.data.data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [selectedInventory]);

  useEffect(() => {
    const hasToken = localStorage.getItem('token');
    if (!hasToken) {
      navigate('/');
      return;
    }
    fetchData();
  }, [navigate, fetchData]);

  // WebSocket listener
  useEffect(() => {
    const channel = echo.private('admin');
    
    const refreshListener = () => {
      fetchData(true);
    };

    channel.listen('.scan.enregistre', refreshListener);
    channel.listen('.inventaire.status.updated', refreshListener);

    return () => {
      channel.stopListening('.scan.enregistre', refreshListener);
      channel.stopListening('.inventaire.status.updated', refreshListener);
    };
  }, [fetchData]);

  if (!user) return (
    <div className={layoutStyles.dashboardLoading}>
      <span className={layoutStyles.loadingDots}></span>
    </div>
  );

  const ecarts = data?.overview?.ecarts_detectes;
  const ecartsValue = ecarts ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#22c55e', fontSize: '0.9em' }}>+{ecarts.positif || 0}</span>
      <span style={{ color: '#64748b', fontSize: '0.9em' }}>/</span>
      <span style={{ color: '#ef4444', fontSize: '0.9em' }}>{ecarts.negatif || 0}</span>
    </div>
  ) : '0';

  const overviewCards = [
    { title: 'Inventaires en cours', value: loading ? <span className={layoutStyles.loadingDots}></span> : (data?.overview?.inventaires_actifs || '0'), icon: 'bi-box-seam' },
    { title: 'Personnel Actif', value: loading ? <span className={layoutStyles.loadingDots}></span> : (data?.overview?.personnel_actif || '0'), icon: 'bi-people' },
    { title: 'Avancement global', value: loading ? <span className={layoutStyles.loadingDots}></span> : (data?.overview?.avancement_global || '0'), icon: 'bi-graph-up' },
    { title: 'Écarts détectés', value: loading ? <span className={layoutStyles.loadingDots}></span> : ecartsValue, icon: 'bi-exclamation-circle' },
  ];

  const getStatusClass = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'inactif') return layoutStyles.statusRed;
    return layoutStyles.statusGreen;
  };

  const agents = data?.performance_agents || [];
  const ecartsList = data?.ecarts_list || [];

  const sansecart = data?.analyse_ecarts?.sans_ecart || 0;
  const ecartPositif = data?.analyse_ecarts?.ecartPositif || 0;
  const ecartNegatif = data?.analyse_ecarts?.ecartNegatif || 0;
  const total = data?.analyse_ecarts?.total || 1;

  const getInitials = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const percentage = total > 0 ? Math.round((sansecart / total) * 100) : 0;

  // Cumulative angles for conic-gradient (0 to 180deg)
  const a1 = (sansecart / total) * 180;
  const a2 = a1 + (ecartPositif / total) * 180;
  const a3 = a2 + (ecartNegatif / total) * 180;

  return (
    <div className={layoutStyles.dashboardContainer}>

      {/* Main Content Area */}
      <div className={styles.mainContent}>

        {/* Row 1: Overview Cards */}
        <div className={layoutStyles.overviewGrid}>
          {overviewCards.map((card, i) => (
            <div key={i} className={layoutStyles.statCard}>
              <div className={layoutStyles.cardIcon}>
                <i className={`bi ${card.icon}`} />
              </div>
              <div className={styles.cardInfo}>
                <h3 className={layoutStyles.dashboardCardTitle}>{card.title}</h3>
                <div className={layoutStyles.cardValue}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.inventoryFilterBar}>
          <div
            className={`${styles.inventoryTab} ${selectedInventory === 'all' ? styles.activeTab : ''}`}
            onClick={() => setSelectedInventory('all')}
          >
            Tous
          </div>
          {data?.inventories_list?.map((inv: any) => (
            <div
            title={inv.name}
              key={inv.id}
              className={`${styles.inventoryTab} ${selectedInventory === inv.id ? styles.activeTab : ''}`}
              onClick={() => setSelectedInventory(inv.id)}
            >
              {inv.name.length > 30 ? inv.name.substring(0, 30) + '...' : inv.name}
            </div>
          ))}

        </div>
        {/* Row 3: Resume & Suivi */}
        <div className={styles.panelGridRow}>

          <div className={layoutStyles.panel}>
            <div className={layoutStyles.panelHeader}>
              <h3 className={layoutStyles.panelTitle}><i className="bi bi-file-text" /> Résumé rapide</h3>
            </div>
            <div className={styles.chartContainer} style={{ flexDirection: 'column', gap: '20px' }}>
              <div className={styles.circleChart} style={{ background: `conic-gradient(#1e3a8a 0% ${data?.resume_rapide?.taux || 0}%, #f59e0b ${data?.resume_rapide?.taux || 0}% 100%)` }}>
                <div className={styles.circleInner}>
                  <h4>{loading ? <span className={layoutStyles.loadingDots}></span> : `${data?.resume_rapide?.taux || 0}%`}</h4>
                  <p>Taux<br />réalisation</p>
                </div>
              </div>
              <div className={styles.legendList} style={{ width: '100%', marginLeft: 0 }}>
                <div className={styles.legendItem} style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className={styles.dot} style={{ background: '#1e3a8a' }}></div> Articles comptés</div>
                  <strong>{loading ? <span className={layoutStyles.loadingDots}></span> : formatCompactNumber(data?.resume_rapide?.comptes || 0)}</strong>
                </div>
                <div className={styles.legendItem} style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className={styles.dot} style={{ background: '#f59e0b' }}></div> Articles restants</div>
                  <strong>{loading ? <span className={layoutStyles.loadingDots}></span> : formatCompactNumber(data?.resume_rapide?.restants || 0)}</strong>
                </div>
                <div className={styles.legendItem} style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className={styles.dot} style={{ background: '#22c55e' }}></div> Total articles</div>
                  <strong>{loading ? <span className={layoutStyles.loadingDots}></span> : formatCompactNumber(data?.resume_rapide?.total || 0)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className={layoutStyles.panel}>
            <div className={layoutStyles.panelHeader}>
              <h3 className={layoutStyles.panelTitle}><i className="bi bi-pie-chart" /> Analyse des écarts</h3>
            </div>
            <div className={styles.chartContainer} >
              <div className={styles.gaugeContainer}>
                <div
                  className={styles.gaugeArc}
                  style={{
                    background: `conic-gradient(
                      #22c55e 0deg ${a1}deg, 
                      #eab308 ${a1}deg ${a2}deg, 
                      #ef4444 ${a2}deg ${a3}deg,
                      #e2e8f0 ${a3}deg 180deg,
                      transparent 180deg
                    )`
                  }}
                ></div>

                <div className={styles.gaugeText}>
                  <h3 className={styles.gaugePercent}>{loading ? <span className={layoutStyles.loadingDots}></span> : `${percentage}%`}</h3>
                  <p className={styles.gaugeSub}>Sans écart</p>
                </div>

              </div>
              <div className={styles.legendList}>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#22c55e' }}></div>
                  <span>Sans écart : {loading ? <span className={layoutStyles.loadingDots}></span> : (sansecart || 0)} articles</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#eab308' }}></div>
                  <span>Écart positif : {loading ? <span className={layoutStyles.loadingDots}></span> : (ecartPositif || 0)} articles</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.dot} style={{ background: '#ef4444' }}></div>
                  <span>Écart négatif : {loading ? <span className={layoutStyles.loadingDots}></span> : (ecartNegatif || 0)} articles</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Performance Agents & Ecarts */}
        <div className={styles.panelGridRow}>
          <div className={layoutStyles.panel}>
          <div className={layoutStyles.panelHeader}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 className={layoutStyles.panelTitle}>Performance Agents</h3>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Surveillance de la productivité et statut de connexion</span>
            </div>
          </div>
          <div className={layoutStyles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Agents</th>
                  <th>{selectedInventory === 'all' ? 'Inventaires assignés' : 'Dernier Scan'}</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}><span className={layoutStyles.loadingDots}></span></td></tr>
                ) : (
                  <>
                    {agents.map((ag: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <div className={styles.userCard}>
                            {ag.avatar ? (
                              <img
                                src={ag.avatar.startsWith('http') ? ag.avatar : `${BACKEND_URL}${ag.avatar}`}
                                alt="avatar"
                              />
                            ) : (
                              <div >
                                {getInitials(ag.nom)}
                              </div>
                            )}
                            {ag.nom}
                          </div>
                        </td>
                        <td className={styles.expandableTd}>
                          {selectedInventory === 'all' ? (
                            <div className={styles.invInfoWrap}>
                              <span className={layoutStyles.countBadge} title={ag.inventaires_list?.join('\n')}>
                                {formatCompactNumber(ag.inventaires_count || 0)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              ({ag.last_scan || 'Jamais'})
                            </span>
                          )}
                        </td>
                        <td><span className={`${layoutStyles.statusBadge} ${getStatusClass(ag.status)}`}>{ag.status=='Inactif' ? 'Inactif':'Actif'}</span></td>
                      </tr>
                    ))}
                    {agents.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>Aucune donnée</td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table Ecarts */}
        <div className={layoutStyles.panel}>
          <div className={layoutStyles.panelHeader}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 className={layoutStyles.panelTitle}>Détails des Écarts</h3>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Liste des articles présentant un écart</span>
            </div>
          </div>
          <div className={layoutStyles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  {selectedInventory === 'all' && <th>Inventaire</th>}
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={selectedInventory === 'all' ? 4 : 3} style={{ textAlign: 'center', color: '#64748b' }}><span className={layoutStyles.loadingDots}></span></td></tr>
                ) : (
                  <>
                    {ecartsList.map((ecartItem: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{ecartItem.article}</span>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{ecartItem.code_barres}</span>
                          </div>
                        </td>
                        {selectedInventory === 'all' && (
                          <td>{ecartItem.inventaire}</td>
                        )}
                        <td style={{ color: ecartItem.ecart_positif ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{ecartItem.ecart_positif ? `+${ecartItem.ecart_positif}` : `${ecartItem.ecart_negatif}`}</td>
                      </tr>
                    ))}
                    {ecartsList.length === 0 && (
                      <tr><td colSpan={selectedInventory === 'all' ? 4 : 3} style={{ textAlign: 'center', color: '#64748b' }}>Aucun écart détecté</td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        </div>

      </div>


    </div>
  );
};

export default Accueil;

