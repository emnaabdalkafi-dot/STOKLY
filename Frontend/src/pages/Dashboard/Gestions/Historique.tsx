import React, { useState, useEffect } from 'react';
import styles from './Gestions.module.css';
import layoutStyles from '../../../components/layout/layout.module.css';
import api from '../../../services/api';
import { formatCompactNumber} from '../../../utils/formatters';

const Historique: React.FC = () => {
  const [rapports, setRapports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRapports = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/rapports');
      if (res.data.success) {
        setRapports(res.data.data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'historique", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRapports();
  }, []);

  const filteredRapports = rapports.filter(r => 
    r.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.site?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className={styles.dashboardMain}>
      <div className={layoutStyles.overviewGrid}>
        <div className={layoutStyles.statCard}>
          <div className={styles.dashboardCardIcon}><i className="bi bi-journal-check" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Total Rapports</p>
            <p className={layoutStyles.cardValue}>{loading ? <span className={layoutStyles.loadingDots}></span> : rapports.length}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={`${styles.dashboardCardIcon} ${styles.cardIconGold}`}><i className="bi bi-file-earmark-pdf" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Dernière Clôture</p>
            <p className={layoutStyles.cardValue} style={{ fontSize: '1rem' }}>
              {rapports.length > 0 ? new Date(rapports[0].created_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      </div>

      <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
        <div className={styles.dashboardPanelHeader}>
          <h3>Historique des Inventaires ({filteredRapports.length})</h3>
          <div className={styles.dashboardPanelActions}>
            <div className={styles.searchAgents}>
              <i className="bi bi-search" />
              <input 
                type="text" 
                placeholder="Recherche (Titre, Site...)" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className={styles.searchInput} 
              />
            </div>
          </div>
        </div>

        <div className={layoutStyles.tableWrap}>
          <table className={styles.dashboardTable}>
            <thead>
              <tr>
                <th><i className="bi bi-calendar-check" /> Date de clôture</th>
                <th><i className="bi bi-tag-fill" /> Titre</th>
                <th><i className="bi bi-geo-alt-fill" /> Site</th>
                <th><i className="bi bi-layers-fill" /> Type</th>
                <th><i className="bi bi-box-seam" /> Articles</th>
                <th><i className="bi bi-people-fill" /> Agents</th>
                <th><i className="bi bi-exclamation-triangle-fill" /> Taux d'Écart (-)</th>
                <th></th>
              </tr>
            </thead>
            {loading ? (
              <tbody><tr><td colSpan={7} className={styles.tableEmptyMsg}><span className={layoutStyles.loadingDots}></span></td></tr></tbody>
            ) : filteredRapports.length === 0 ? (
              <tbody><tr><td colSpan={7} className={styles.tableEmptyMsg}>Aucun rapport archivé</td></tr></tbody>
            ) : (
              <tbody>
                {filteredRapports.map((r) => (
                  <tr key={r.id_rapport}>
                    <td>
                      <p className={styles.dashboardUserName}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td><span style={{ fontWeight: '600', color: '#1e293b' }}>{r.titre}</span></td>
                    <td>{r.site || '—'}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {r.type_source === 'tous' ? 'Tous' : 
                         r.type_source === 'entrepot' ? 'Entrepôt' : 
                         r.type_source === 'article' ? 'Sélection' : '—'}
                      </span>
                    </td>
                    <td>{formatCompactNumber(r.total_articles)} articles</td>
                    <td>
                      <div className={styles.agentTagList} style={{ flexWrap: 'nowrap' }}>
                        <span className={styles.countBadge}>
                          {Array.isArray(r.agents_details) ? formatCompactNumber(r.agents_details.length) : 0}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '60px', 
                          height: '6px', 
                          backgroundColor: '#e2e8f0', 
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${(r.ecarts_negatifs / r.total_articles) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#ef4444',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontWeight: '600', color: '#ef4444', fontSize: '0.8rem' }}>
                          {((r.ecarts_negatifs / r.total_articles) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <button 
                        className={styles.ActionButton}
                        onClick={() => window.open(`http://localhost:8000${r.fichier_path}`, '_blank')}
                        title="Voir le PDF"
                      >
                        <i className="bi bi-file-earmark-pdf-fill" style={{ color: '#ef4444' }} /> Rapport PDF
                      </button>
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

export default Historique;
