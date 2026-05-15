import React, { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import echo from '../../../services/echo';
import styles from './Gestions.module.css';
import layoutStyles from '../../../components/layout/layout.module.css';
import AgentForm from './AgentForm';
import { formatCompactNumber } from '../../../utils/formatters';

const Agents: React.FC = () => {
  const { user } = useAuth();

  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventaires, setInventaires] = useState<any[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [invFilter, setInvFilter] = useState('');

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // modal
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | 'details' | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);


  const fetchStats = useCallback(() => {
    api.get(`/agents/stats`)
      .then(res => setStats(res.data.data))
      .catch(console.error);
  }, []);


  const fetchAgents = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.get(`/agents`, {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        inventaire_id: invFilter || undefined,
      },
    })
      .then(res => {
        const data: any[] = res.data.data;
        setAgents(data);

        // construire la liste unique d'inventaires pour le filtre
        const seen = new Set<number>();
        const invList: any[] = [];
        data.forEach(a =>
          a.affectations?.forEach((aff: any) => {
            if (aff.inventaire && !seen.has(aff.inventaire.id_inventaire)) {
              seen.add(aff.inventaire.id_inventaire);
              invList.push(aff.inventaire);
            }
          })
        );
        setInventaires(invList);
      })
      .catch(console.error)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [search, statusFilter, invFilter]);

  useEffect(() => {
    setGeneralError(null);
  }, [modalType]);



  useEffect(() => {
    const hasToken = localStorage.getItem('token');
    if (!hasToken) return;
    fetchStats();
    fetchAgents();
  }, [search, statusFilter, invFilter, fetchAgents, fetchStats]);

  // WebSocket listener — runs only once on mount
  useEffect(() => {
    const channel = echo.private('admin');
    
    channel.listen('.scan.enregistre', () => {
      // Instead of full fetch, we just refresh stats as scans affect counts
      fetchStats();
      // Optionally update agent's specific scan count if it was tracked in 'agents' list
    });
    
    channel.listen('.inventaire.status.updated', (event: any) => {
      fetchStats();
      setAgents(prevAgents => prevAgents.map(agent => {
        // Look for this agent in the event's affectations
        const updatedAffectation = event.affectations?.find((aff: any) => aff.id_agent === agent.id);
        
        if (updatedAffectation) {
          // If the agent is part of this inventory, update their affectations list
          const existingAffIndex = agent.affectations?.findIndex((a: any) => a.id_inventaire === event.id_inventaire);
          
          let newAffectations = [...(agent.affectations || [])];
          if (existingAffIndex !== undefined && existingAffIndex >= 0) {
             // Update existing affectation status
             newAffectations[existingAffIndex] = {
               ...newAffectations[existingAffIndex],
               statut_participation: updatedAffectation.statut_participation,
               inventaire: {
                 ...newAffectations[existingAffIndex].inventaire,
                 statut: event.statut
               }
             };
          } else {
             // Add new affectation if not present
             newAffectations.push({
               id_inventaire: event.id_inventaire,
               id_agent: agent.id,
               statut_participation: updatedAffectation.statut_participation,
               inventaire: {
                 id_inventaire: event.id_inventaire,
                 titre: event.titre,
                 statut: event.statut,
                 site: event.site
               }
             });
          }
          return { ...agent, affectations: newAffectations };
        }
        
        // Also update any existing affectations if the inventory status changed but participation didn't
        const hasInventory = agent.affectations?.some((a: any) => a.id_inventaire === event.id_inventaire);
        if (hasInventory) {
          return {
            ...agent,
            affectations: agent.affectations.map((a: any) => 
              a.id_inventaire === event.id_inventaire 
                ? { ...a, inventaire: { ...a.inventaire, statut: event.statut } }
                : a
            )
          };
        }
        
        return agent;
      }));
    });

    channel.listen('.agent.status.updated', (event: any) => {
      setAgents(prevAgents => prevAgents.map(agent => {
        if (agent.id === event.agent_id) {
          return {
            ...agent,
            statut: event.status,
            inventaire_actif_titre: event.status === 'actif' ? event.titre : null
          };
        }
        return agent;
      }));
      fetchStats();
    });



    return () => {
      channel.stopListening('.scan.enregistre');
      channel.stopListening('.inventaire.status.updated');
      channel.stopListening('.agent.status.updated');
      echo.leave('admin');
    };
  }, [fetchStats]);

  // Update selected agent when list updates (to keep modal fresh)
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find((a: any) => a.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      }
    }
  }, [agents]);

  const filteredAgents = agents.filter(a => {
    if (!statusFilter) return true;
    const status = a.statut || 'inactif';
    return status.toLowerCase() === statusFilter;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAgents.length) setSelectedIds([]);
    else setSelectedIds(filteredAgents.map(a => a.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const bulkDeleteAgents = async () => {
    if (!window.confirm(`Supprimer ${selectedIds.length} agent(s) sélectionné(s) ?`)) return;
    setGeneralError(null);
    try {
      await api.post(`/agents/bulk-delete`, { ids: selectedIds });
      setSelectedIds([]);
      fetchAgents(true);
      fetchStats();
    } catch (err: any) {
      setGeneralError(err.response?.data?.message || "Erreur de suppression");
    }
  };

  const statusClass = (s: string) =>
    s === 'actif'
      ? `${styles.statusBadge} ${styles.statusActif}`
      : `${styles.statusBadge} ${styles.statusInactif}`;

  const initials = (agent: any) =>
    `${agent.nom?.charAt(0) ?? ''}${agent.prenom?.charAt(0) ?? ''}`.toUpperCase();


  if (!user) return <div className={styles.dashboardLoading}>Chargement...</div>;

  return (
    <main className={styles.dashboardMain}>
      {modalType && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalPanel}>
            <div style={{ textAlign: 'right' }}>
              <button className={styles.dashboardMenuToggle} onClick={() => { setModalType(null); setSelectedAgent(null); }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {(modalType === 'add' || modalType === 'edit' || modalType === 'details') && (
              <AgentForm
                mode={modalType}
                agent={selectedAgent}
                onClose={() => { setModalType(null); setSelectedAgent(null); }}
                onSuccess={() => { fetchAgents(true); fetchStats(); }}
              />
            )}

            {modalType === 'delete' && (
              <div className={styles.textAlignCenter}>
                {generalError && <div className={styles.authAlert} style={{ marginBottom: '1rem' }}>{generalError}</div>}
                <p>Etes-vous sure de vouloir supprimer <strong>{selectedAgent?.nom} {selectedAgent?.prenom}</strong> ?</p>
                <div className={styles.modalFooterCenter}>
                  <button className={styles.Submit} onClick={() => {
                    setGeneralError(null);
                      api.delete(`/agents/${selectedAgent.id}`)
                        .then(() => { fetchAgents(true); fetchStats(); setModalType(null); })
                      .catch(err => setGeneralError(err.response?.data?.message || "Erreur de suppression"));
                  }}>Supprimer</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={layoutStyles.overviewGrid}>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-people-fill" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Total agents</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.total_agents) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-person-check-fill" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Agents assignés</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.agents_assignes) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={`${layoutStyles.cardIcon} ${layoutStyles.cardIconGold}`}><i className="bi bi-trophy-fill" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Meilleur agent</p>
            <p className={layoutStyles.cardValue}>{stats ? (stats.meilleur_agent ? `${stats.meilleur_agent.nom} ${stats.meilleur_agent.prenom}` : '—') : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
        <div className={layoutStyles.statCard}>
          <div className={layoutStyles.cardIcon}><i className="bi bi-activity" /></div>
          <div className={styles.dashboardCardInfo}>
            <p className={layoutStyles.dashboardCardTitle}>Agents actifs</p>
            <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.agents_actifs) : <span className={layoutStyles.loadingDots}></span>}</p>
          </div>
        </div>
      </div>

      <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
        <div className={styles.dashboardPanelHeader}>
          <h3>Liste des agents ({formatCompactNumber(filteredAgents.length)})</h3>
          <div className={styles.dashboardPanelActions}>
            <div className={styles.searchAgents}>
              <i className="bi bi-search" />
              <input type="text" placeholder="Nom / Email" value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
            </div>
            <button className={styles.addButton} onClick={() => { setSelectedAgent(null); setModalType('add'); }}>
              <i className="bi bi-plus-lg" /> Ajouter agent
            </button>
          </div>
        </div>

        <div className={styles.filterStrip}>
          <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <select className={styles.filterSelect} value={invFilter} onChange={e => setInvFilter(e.target.value)}>
            <option value="">Tous les inventaires</option>
            {inventaires.map(inv => <option key={inv.id_inventaire} value={inv.id_inventaire}>{inv.site || `Inventaire #${inv.id_inventaire}`}</option>)}
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className={styles.bulkActionBar}>
            <p className={styles.bulkActionText}>{selectedIds.length} agent(s) sélectionné(s)</p>
            <div>
              <button className={styles.bulkDeleteBtn} onClick={bulkDeleteAgents}><i className="bi bi-trash" /> Supprimer la sélection</button>
              <button className={styles.ActionButton} onClick={() => setSelectedIds([])}>Annuler</button>
            </div></div>
        )}

        <div className={styles.dashboardTableWrap}>
          <table className={styles.dashboardTable}>
            <thead>
              <tr>
                <th><input type="checkbox" className={styles.checkbox} checked={filteredAgents.length > 0 && selectedIds.length === filteredAgents.length} onChange={toggleSelectAll} /></th>
                <th><i className="bi bi-person-fill" /> Agent </th>
                <th><i className="bi bi-telephone-fill" /> Téléphone</th>
                <th><i className="bi bi-box-seam-fill" /> Inventaires assignés</th>
                <th><i className="bi bi-play-circle-fill" /> Inventaire en cours</th>
                <th><i className="bi bi-check-square-fill" /> Statut</th>
                <th></th>
              </tr>
            </thead>
            {loading ? (
              <tbody><tr><td colSpan={7} className={styles.tableEmptyMsg}><span className={styles.loadingDots}></span></td></tr></tbody>
            ) : filteredAgents.length === 0 ? (
              <tbody><tr><td colSpan={7} className={styles.tableEmptyMsg}>Aucun agent trouvé</td></tr></tbody>
            ) : (
              <tbody>
                {filteredAgents.map((agent: any) => (
                  <tr key={agent.id}>
                    <td><input type="checkbox" className={styles.checkbox} checked={selectedIds.includes(agent.id)} onChange={() => toggleSelect(agent.id)} /></td>
                    <td>
                      <div className={styles.dashboardUserCard}>
                        <div className={styles.dashboardUserAvatar}>
                          {agent.avatar ? (
                            <img 
                              src={agent.avatar.startsWith('http') ? agent.avatar : `http://localhost:8000${agent.avatar}`} 
                              alt="Avatar" 
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                            />
                          ) : (
                            initials(agent)
                          )}
                        </div>
                        <div className={styles.dashboardUserInfo}>
                          <p className={styles.dashboardUserName}>{agent.nom} {agent.prenom}</p>
                          <p className={styles.dashboardUserEmail} title={agent.email}>{agent.email.length > 15 ? agent.email.substring(0, 15) + '...' : agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{agent.tel || '—'}</td>
                    <td><span className={styles.countBadge} title={agent.inventaires_list?.join('\n')}>{formatCompactNumber(agent.inventaires_count ?? 0)}</span></td>
                    <td>
                      {agent.statut === 'actif' ? (
                        <span className={styles.activeInvTag}>
                          <i className="bi bi-broadcast" style={{ marginRight: '5px' }} />
                          {agent.inventaire_actif_titre || 'En cours...'}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span className={statusClass(agent.statut ?? 'inactif')}>{agent.statut ?? 'inactif'}</span></td>
                    <td>
                      <button className={styles.ActionButton} onClick={() => { setSelectedAgent(agent); setModalType('details'); }}>Détails</button>
                      <button className={`${styles.ActionButton} ${styles.deleteButton}`} onClick={() => { setSelectedAgent(agent); setModalType('delete'); }}>Supprimer</button>
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

export default Agents;
