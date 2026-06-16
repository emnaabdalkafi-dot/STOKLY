import React, { useState, useEffect, useMemo } from 'react';
import styles from '../Gestions.module.css';
import layoutStyles from '../../../../components/layout/layout.module.css';
import api, { BACKEND_URL } from '../../../../services/api';
import { formatCompactNumber } from '../../../../utils/formatters';
import InventaireModals from '../Inventaires/InventaireModals';

const Historique: React.FC = () => {
  const [inventaires, setInventaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds] = useState<number[]>([]);
  const [modalType, setModalType] = useState<'historique' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const fetchInventaires = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/inventaires', { params: { statut: 'cloture' } });
      if (res.data.success) {
        setInventaires(res.data.data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'historique", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventaires();
  }, []);

  const filteredInventaires = useMemo(() => {
    return inventaires.filter(inv => {
      const searchLower = searchTerm.toLowerCase();
      const dateStr = new Date(inv.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return (
        inv.titre.toLowerCase().includes(searchLower) ||
        (inv.site?.toLowerCase() || '').includes(searchLower) ||
        dateStr.includes(searchLower)
      );
    });
  }, [inventaires, searchTerm]);


  return (
    <main className={styles.dashboardMain}>
      <div className={layoutStyles.overviewGrid} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-journal-check" /></div>
          <div className={layoutStyles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Total Clôturés</p>
            <p className={layoutStyles.cardValue}>{loading ? <span className={layoutStyles.loadingDots}></span> : inventaires.length}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={`${layoutStyles.cardIcon} ${styles.cardIconGold}`}><i className="bi bi-file-earmark-pdf" /></div>
          <div className={layoutStyles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Dernière Clôture</p>
            <p className={layoutStyles.cardValue}>
              {inventaires.length > 0 ? new Date(inventaires[0].updated_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      </div>

      <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
        <div className={styles.dashboardPanelHeader}>
          <h3>Historique des Inventaires ({filteredInventaires.length})</h3>
          <div className={styles.dashboardPanelActions}>
            <div className={styles.search}>
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

      
        <div className={styles.dashboardTableWrap}>
          <table className={styles.dashboardTable}>
            <thead>
              <tr>

                <th><i className="bi bi-calendar-check" /> Date de clôture</th>
                <th><i className="bi bi-tag-fill" /> Titre</th>
                <th><i className="bi bi-geo-alt-fill" /> Site</th>
                <th><i className="bi bi-layers-fill" /> Type</th>
                <th><i className="bi bi-box-seam-fill" /> Articles</th>
                <th><i className="bi bi-people-fill" /> Agents</th>
                <th><i className="bi bi-exclamation-triangle-fill" /> Taux d'Écart (-)</th>
                <th></th>
              </tr>
            </thead>
            {loading ? (
<tbody>
                <tr >
                  {Array.from({ length: 9 }).map((_, index) => (
                    <td key={index} >
                      <span className={layoutStyles.loadingDots}></span>
                    </td>
                  ))}
                </tr>
                </tbody>            ) : filteredInventaires.length === 0 ? (
              <tbody><tr><td colSpan={9} className={styles.tableEmptyMsg}>Aucun historique archivé</td></tr></tbody>
            ) : (
              <tbody>
                {filteredInventaires.map((inv) => {
                  
                  // Calculate dynamic stats from lignes
                  let total_articles = 0;
                  let ecarts_negatifs = 0;
                  if (inv.lignes) {
                    const articlesSet = new Set();
                    inv.lignes.forEach((l: any) => {
                      if (!articlesSet.has(l.id_article)) {
                        articlesSet.add(l.id_article);
                        total_articles++;
                      }
                      if (l.ecart < 0) {
                        ecarts_negatifs++;
                      }
                    });
                  }

                  return (
                  <tr key={inv.id_inventaire} className={selectedIds.includes(inv.id_inventaire) ? styles.rowSelected : ''}>

                    <td>
                      <p className={styles.dashboardUserName}>
                        {new Date(inv.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <span className={styles.tableEmptyMsg} >
                        {new Date(inv.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td><span >{inv.titre}</span></td>
                    <td>{inv.site || '—'}</td>
                    <td>
                      <span >
                        {inv.type_source === 'tous' ? 'Tous les articles' : 
                         inv.type_source === 'entrepot' ? 'Par entrepôt' : 
                         inv.type_source === 'article' ? 'Par articles' : '—'}
                      </span>
                    </td>
                    <td>{formatCompactNumber(total_articles)} articles</td>
                    <td>
                   
                        <span className={styles.countBadge}>
                          {inv.affectations ? formatCompactNumber(inv.affectations.length) : 0}
                        </span>
                      
                    </td>
                    <td>
                      <div className={styles.ecartBarContainer}>
                        <div className={styles.ecartBar}>
                          <div style={{ 
                            width: `${total_articles > 0 ? (ecarts_negatifs / total_articles) * 100 : 0}%`
                          }} className={styles.ecartBarFill} />
                        </div>
                        <span className={styles.ecartBarText}>
                          {total_articles > 0 ? ((ecarts_negatifs / total_articles) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                    <td >
                        <button 
                          className={styles.ActionButton}
                          onClick={() => { setSelectedItem(inv); setModalType('historique'); }}
                        >
                          Détails
                        </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            )}
          </table>
        </div>
      </section>
      {modalType && (
        <InventaireModals
          modalType={modalType}
          selectedItem={selectedItem}
          onClose={() => setModalType(null)}
          onSuccess={() => {
            setModalType(null);
            fetchInventaires(true);
          }}
        />
      )}
    </main>
  );
};

export default Historique;

