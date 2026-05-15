import React, { useState, useEffect } from 'react';
import styles from './Gestions.module.css';
import { inventaireService } from '../../../services/inventaireService';
import api from '../../../services/api';
import echo from '../../../services/echo';
import layoutStyles from '../../../components/layout/layout.module.css';
import { formatCompactNumber, formatCurrency, getCurrencySymbol } from '../../../utils/formatters';

interface InventaireModalsProps {
  modalType: 'add' | 'edit' | 'delete' | 'details' | 'terminate' | 'addNote' | 'notes' | 'correctionRequests' | null;
  selectedItem: any;
  onClose: () => void;
  onSuccess: (stayOpen?: boolean) => void;
}

const InventaireModals: React.FC<InventaireModalsProps> = ({ modalType, selectedItem, onClose, onSuccess }) => {
  const currency = getCurrencySymbol();
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [formData, setFormData] = useState({
    titre: '',
    site: '',
    date_debut: '',
    date_fin: '',
    statut: 'en attente',
    type_source: 'tous',
    id_entrepot: '',
    remarque: '',
    agents: [] as number[],
    articles: [] as number[]
  });
  const [fieldErrors, setFieldErrors] = useState<any>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Data for options
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [entrepotsList, setEntrepotsList] = useState<any[]>([]);
  const [articlesList, setArticlesList] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [inventairesList, setInventairesList] = useState<any[]>([]);
  const [selectedInventaireId, setSelectedInventaireId] = useState<number | ''>('');
  const [updateStock, setUpdateStock] = useState(false);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [rejectionMotif, setRejectionMotif] = useState('');

  useEffect(() => {
    if (modalType === 'add' || modalType === 'details' || modalType === 'addNote') {
      fetchOptions();
    }
    
    if (modalType === 'addNote') {
       fetchInventaires();
    }

    if (modalType === 'notes' && selectedItem) {
      fetchNotes(selectedItem.id_inventaire);
    }

    if (modalType === 'correctionRequests') {
      fetchCorrections();
    }

    if (modalType === 'terminate' && selectedItem) {
      fetchSummary();
    }

    if ((modalType === 'details') && selectedItem) {
      setFormData({
        titre: selectedItem.titre || '',
        site: selectedItem.site || '',
        date_debut: selectedItem.date_debut?.split('T')[0] || '',
        date_fin: selectedItem.date_fin?.split('T')[0] || '',
        statut: selectedItem.statut || 'en attente',
        type_source: selectedItem.type_source || 'tous',
        id_entrepot: selectedItem.id_entrepot || '',
        remarque: selectedItem.remarque || '',
        agents: selectedItem.affectations?.map((a: any) => a.id_agent) || [],
        articles: selectedItem.lignes?.map((l: any) => l.id_article) || []
      });
    } else if (modalType === 'add') {
      setFormData({
        titre: '',
        site: '',
        date_debut: '',
        date_fin: '',
        statut: 'en attente',
        type_source: 'tous',
        id_entrepot: '',
        remarque: '',
        agents: [],
        articles: []
      });
    }
  }, [modalType, selectedItem]);

  // WebSocket refresh for summary
  useEffect(() => {
    if (!selectedItem) return;

    const channel = echo.private('admin');
    
    const onUpdate = () => {
      if (modalType === 'terminate') {
        fetchSummary();
      }
    };

    const onNoteChange = () => {
      if (modalType === 'notes' && selectedItem) {
        fetchNotes(selectedItem.id_inventaire);
      }
    };

    channel.listen('.scan.enregistre', onUpdate);
    channel.listen('.inventaire.status.updated', onUpdate);
    channel.listen('.note.added', onNoteChange);
    channel.listen('.note.updated', onNoteChange);
    channel.listen('.note.deleted', onNoteChange);
    channel.listen('.correction_request', () => {
      if (modalType === 'correctionRequests') fetchCorrections();
    });

    return () => {
      channel.stopListening('.scan.enregistre', onUpdate);
      channel.stopListening('.inventaire.status.updated', onUpdate);
      channel.stopListening('.note.added', onNoteChange);
      channel.stopListening('.note.updated', onNoteChange);
      channel.stopListening('.note.deleted', onNoteChange);
    };
  }, [modalType, selectedItem]);

  const fetchSummary = async () => {
    setLoadingSummary(true);
    setGeneralError(null);
    try {
      const res = await api.get(`/inventaires/${selectedItem.id_inventaire}/summary`);
      setSummary(res.data.data);
    } catch (err: any) {
      setGeneralError(err.response?.data?.message || "Erreur lors de la récupération du résumé.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const [loadingNotes, setLoadingNotes] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [activeNoteMenu, setActiveNoteMenu] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  const fetchNotes = async (id: number) => {
    setLoadingNotes(true);
    try {
      const res = await api.get(`/inventaires/${id}/notes`);
      setNotes(res.data.data || []);
      
      // Mark as read
      res.data.data?.forEach((n: any) => {
        if (!n.lu) api.put(`/inventaires/notes/${n.id_note}/read`);
      });
    } catch (err) { console.error(err); }
    finally { setLoadingNotes(false); }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClick = () => setActiveNoteMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const fetchInventaires = async () => {
    try {
      const res = await api.get('/inventaires');
      setInventairesList(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleNoteSubmit = async (id?: number) => {
    const invId = id || selectedInventaireId;
    if (!invId || !noteContent.trim()) return;

    setSubmittingNote(true);
    try {
      await api.post(`/inventaires/${invId}/notes`, { contenu: noteContent });
      setNoteContent('');
      if (modalType === 'notes') fetchNotes(invId as number);
      else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setGeneralError(err.response?.data?.message || "Erreur lors de l'envoi de la note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleNoteUpdate = async (noteId: number) => {
    if (!editNoteContent.trim()) return;
    setSubmittingNote(true);
    try {
      await api.put(`/inventaires/notes/${noteId}`, { contenu: editNoteContent });
      setEditingNoteId(null);
      setEditNoteContent('');
      fetchNotes(selectedItem.id_inventaire);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const fetchCorrections = async () => {
    setLoadingCorrections(true);
    try {
      const res = await api.get('/corrections');
      setCorrections(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingCorrections(false); }
  };

  const handleCorrectionAction = async (id: number, statut: 'valide' | 'refuse') => {
    setSubmittingNote(true);
    try {
      await api.put(`/corrections/${id}/validate`, { statut });
      fetchCorrections();
      onSuccess(true);
    } catch (err) { console.error(err); }
    finally { setSubmittingNote(false); }
  };

  const handleNoteDelete = async (noteId: number) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    setSubmittingNote(true);
    try {
      await api.delete(`/inventaires/notes/${noteId}`);
      fetchNotes(selectedItem.id_inventaire);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  };


  const handleTerminate = async () => {
    setLoadingSummary(true);
    setGeneralError(null);
    try {
       const payload = {
        update_stock: updateStock,
        lignes: summary.lignes.map((l: any) => ({
          id_ligne: l.id_ligne,
          quantite_comptee: l.quantite_comptee
        }))
      };

      const res = await api.post(`/inventaires/${selectedItem.id_inventaire}/terminate`, payload);
      if (res.data.success) {
        if (res.data.report_url) {
          window.open(`http://localhost:8000${res.data.report_url}`, '_blank');
        }
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setGeneralError(err.response?.data?.message || "Erreur lors de la clôture.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const [agentsRes, entrepotsRes, articlesRes] = await Promise.all([
        api.get('/agents'),
        api.get('/stock/entrepots'),
        api.get('/stock/articles')
      ]);
      setAgentsList(agentsRes.data.data || []);
      setEntrepotsList(entrepotsRes.data.data || []);
      setArticlesList(articlesRes.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleAgentToggle = (id: number) => {
    setFormData(prev => {
      if (prev.agents.includes(id)) {
        return { ...prev, agents: prev.agents.filter(a => a !== id) };
      }
      return { ...prev, agents: [...prev.agents, id] };
    });
  };

  const handleArticleToggle = (id: number) => {
    setFormData(prev => {
      if (prev.articles.includes(id)) {
        return { ...prev, articles: prev.articles.filter(a => a !== id) };
      }
      return { ...prev, articles: [...prev.articles, id] };
    });
  };

  const handleSave = async () => {
    setFieldErrors({});
    setGeneralError(null);

    // Validation de la date (uniquement à la création)
    const today = new Date().toISOString().split('T')[0];
    if (modalType === 'add' && formData.date_debut < today) {
      setGeneralError("La date de début doit être aujourd'hui ou après.");
      return;
    }

    try {
      const payload = {
        ...formData,
        id_entrepot: formData.type_source === 'entrepot' ? (formData.id_entrepot || null) : null,
        articles: formData.type_source === 'article' ? formData.articles : [],
        agents: formData.agents
      };
      
      if (modalType === 'add') {
        await inventaireService.createInventaire(payload);
        onSuccess();
      } else {
        await inventaireService.updateInventaire(selectedItem.id_inventaire, payload);
        onSuccess(true);
        setEditSections({ info: false, source: false, agents: false, remarque: false });
      }
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        const firstErr = Object.values(err.response.data.errors)[0] as string[];
        setGeneralError(firstErr[0]);
      } else {
        setGeneralError(err.response?.data?.message || "Erreur de sauvegarde");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await inventaireService.deleteInventaire(selectedItem.id_inventaire);
      onSuccess();
    } catch (err: any) {
      setGeneralError(err.response?.data?.message || "Erreur de suppression");
    }
  };

  const [editSections, setEditSections] = useState({
    info: false,
    source: false,
    agents: false,
    remarque: false
  });

  const getStatusColor = (s: string) => {
    if (s === 'en cours') return '#22c55e';
    if (s === 'termine' || s === 'terminé') return '#ef4444';
    return '#f59e0b'; // en attente
  };

  if (!modalType) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalPanel} ${modalType === 'details' ? styles.modalContentExtraWide : ''}`}>
        <button className={styles.dashboardMenuToggle} onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
        <div className={styles.modalContent}>

          {modalType === 'add' && (
            <div className={styles.detailsForm}>
              <h3 className={styles.modalTitle}>Créer un inventaire</h3>
              {generalError && <div className={styles.fieldError} >{generalError}</div>}

              <div className={styles.detailsContainer} >
                <div className={styles.detailsGrid}>
                  <div>
                    <label>Titre de l'inventaire
                      <div className={styles.InputGroup}>
                        <i className="bi bi-tag-fill" />
                        <input
                          type="text"
                          value={formData.titre}
                          placeholder="Nom de l'inventaire"
                          onChange={e => setFormData({ ...formData, titre: e.target.value })}
                        />
                      </div>
                    </label>
                    {fieldErrors.titre && <span className={styles.fieldError}>{fieldErrors.titre[0]}</span>}
                  </div>
                  <div>
                    <label>Site
                      <div className={styles.InputGroup}>
                        <i className="bi bi-signpost" />
                        <input
                          type="text"
                          value={formData.site}
                          placeholder="Site"
                          onChange={e => setFormData({ ...formData, site: e.target.value })}
                        />
                      </div>
                    </label>
                    {fieldErrors.site && <span className={styles.fieldError}>{fieldErrors.site[0]}</span>}
                  </div>
                </div>

                <div className={styles.detailsGrid}>
                  <div>
                    <label>Date Début
                      <div className={styles.InputGroup}>
                        <input
                          type="date"
                          className={styles.filterDate}
                          value={formData.date_debut}
                          onChange={e => setFormData({ ...formData, date_debut: e.target.value })}
                        />
                      </div>
                    </label>
                    {fieldErrors.date_debut && <span className={styles.fieldError}>{fieldErrors.date_debut[0]}</span>}
                  </div>
                  <div>
                    <label>Date Fin
                      <div className={styles.InputGroup}>
                        <input
                          type="date"
                          className={styles.filterDate}
                          value={formData.date_fin}
                          onChange={e => setFormData({ ...formData, date_fin: e.target.value })}
                        />
                      </div>
                    </label>
                    {fieldErrors.date_fin && <span className={styles.fieldError}>{fieldErrors.date_fin[0]}</span>}
                  </div>
                </div>

              </div>

              <div className={styles.detailsContainer}>
                <h4 className={styles.sectionTitle}>2. Affectation Articles</h4>
                <div >
                  <div className={styles.radioGroup}>
                    <label className={styles.radioCard}>
                      <input
                        type="radio"
                        name="type_source"
                        value="tous"
                        checked={formData.type_source === 'tous'}
                        onChange={() => setFormData({ ...formData, type_source: 'tous' })}
                      />
                      Tous les articles
                    </label>
                    <label className={styles.radioCard}>
                      <input
                        type="radio"
                        name="type_source"
                        value="entrepot"
                        checked={formData.type_source === 'entrepot'}
                        onChange={() => setFormData({ ...formData, type_source: 'entrepot' })}
                      />
                      Par entrepôt
                    </label>
                    <label className={styles.radioCard}>
                      <input
                        type="radio"
                        name="type_source"
                        value="article"
                        checked={formData.type_source === 'article'}
                        onChange={() => setFormData({ ...formData, type_source: 'article' })}
                      />
                      Par article
                    </label>
                  </div>
                </div>

                {formData.type_source === 'entrepot' && (
                  <div className={styles.marginT1}>
                    <label>Sélectionner un entrepôt</label>
                    <select
                      className={styles.filterSelect}
                      value={formData.id_entrepot}
                      onChange={e => setFormData({ ...formData, id_entrepot: e.target.value })}
                    >
                      <option value="">Sélectionner un entrepôt...</option>
                      {entrepotsList.filter(e => (e.articles_count || 0) > 0).map(e => (
                        <option key={e.id_entrepot} value={e.id_entrepot}>{e.nom} ({e.articles_count} articles)</option>
                      ))}
                    </select>
                    {fieldErrors.id_entrepot && <span className={styles.fieldError}>{fieldErrors.id_entrepot[0]}</span>}
                  </div>
                )}

                {formData.type_source === 'article' && (
                  <div className={styles.marginT1}>
                    <label>Sélectionner des articles</label>
                    <div className={`${styles.list} ${styles.scrollList} ${styles.marginB1}`} style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {loadingOptions ? <p>Chargement...</p> : articlesList.length === 0 ? <p>Aucun article trouvé.</p> : null}
                      {articlesList.map(article => (
                        <label key={article.id_article} className={styles.checkboxLabel}>
                          <input
                            className={styles.checkbox}
                            type="checkbox"
                            checked={formData.articles.includes(article.id_article)}
                            onChange={() => handleArticleToggle(article.id_article)}
                          />
                          {article.nom} (Code: {article.code_barres})
                        </label>
                      ))}
                    </div>
                    {fieldErrors.articles && <span className={styles.fieldError}>{fieldErrors.articles[0]}</span>}
                  </div>
                )}
              </div>

              <div className={styles.detailsContainer}>
                <h4 className={styles.sectionTitle}>3. Affectation Agents</h4>
                <div className={`${styles.list} ${styles.scrollList} ${styles.marginB1}`} >
                  {loadingOptions ? <p>Chargement...</p> : agentsList.length === 0 ? <p>Aucun agent trouvé.</p> : null}
                  {agentsList.map(agent => (
                    <label key={agent.id} className={styles.checkboxLabel}>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={formData.agents.includes(agent.id)}
                        onChange={() => handleAgentToggle(agent.id)}
                      />
                      {agent.nom} {agent.prenom}
                    </label>
                  ))}
                </div>
                {fieldErrors.agents && <span className={styles.fieldError}>{fieldErrors.agents[0]}</span>}
              </div>

              <div className={styles.detailsContainer}>
                <h4 className={styles.sectionTitle}>4. Notes (optionnel)</h4>
                <textarea
                  className={styles.textareaInput}
                  placeholder="Instructions pour les agents..."
                  value={formData.remarque}
                  onChange={e => setFormData({ ...formData, remarque: e.target.value })}
                />
              </div>

              <button className={styles.Submit} onClick={handleSave}>
                Enregistrer
              </button>
            </div>
          )}

          {modalType === 'details' && (
            <div className={styles.detailsForm}>
              {loadingOptions && <div className={styles.tableEmptyMsg}>Chargement...</div>}
              {generalError && <div className={styles.fieldError}>{generalError}</div>}
              
              <div className={styles.sectionHeader}>
                <h3 className={styles.modalTitle}>
                  <span>Details de </span>
                   {formData.titre || formData.site}
                  <span className={styles.statusDot} style={{ backgroundColor: getStatusColor(formData.statut) }} />
                 
                </h3>
              </div>

              <div className={styles.detailsContainer}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>Informations Générales :</h4>
                  <button className={styles.editMiniBtn} onClick={() => {
                    if (editSections.info) {
                      const hasChanged = 
                        formData.titre !== (selectedItem.titre || '') ||
                        formData.site !== (selectedItem.site || '') ||
                        formData.date_debut !== (selectedItem.date_debut?.split('T')[0] || '') ||
                        formData.date_fin !== (selectedItem.date_fin?.split('T')[0] || '');
                      
                      if (hasChanged) handleSave();
                      else setEditSections({...editSections, info: false});
                    } else {
                      setEditSections({...editSections, info: true});
                    }
                  }}>
                    {editSections.info ? <i className="bi bi-check-lg"></i> : <i className="bi bi-pencil"></i>}
                  </button>
                </div>

                {!editSections.info ? (
                  <div className={styles.displayList}>
                    <div className={styles.displayItem}><strong>Site:</strong> {formData.site}</div>
                    <div className={styles.displayItem}><strong>Début:</strong> {formData.date_debut}</div>
                    <div className={styles.displayItem}><strong>Fin:</strong> {formData.date_fin}</div>
                    <div className={styles.displayItem}><strong>Statut:</strong> {formData.statut}</div>
                  </div>
                ) : (
                  <div className={styles.detailsGrid}>
                    <div>
                      <label>Titre</label>
                      <div className={styles.InputGroup}>
                        <input type="text" value={formData.titre} onChange={e => setFormData({ ...formData, titre: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label>Site</label>
                      <div className={styles.InputGroup}>
                        <input type="text" value={formData.site} onChange={e => setFormData({ ...formData, site: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label>Date Début</label>
                      <div className={styles.InputGroup}>
                        <input type="date" className={styles.filterDate} value={formData.date_debut} onChange={e => setFormData({ ...formData, date_debut: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label>Date Fin</label>
                      <div className={styles.InputGroup}>
                        <input type="date" className={styles.filterDate} value={formData.date_fin} onChange={e => setFormData({ ...formData, date_fin: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.detailsContainer}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>Source des articles :</h4>
                  <button className={styles.editMiniBtn} onClick={() => {
                    if (editSections.source) {
                      const origArticles = selectedItem.lignes?.map((l: any) => l.id_article) || [];
                      const hasChanged = 
                        formData.type_source !== (selectedItem.type_source || 'tous') ||
                        formData.id_entrepot !== (selectedItem.id_entrepot || '') ||
                        JSON.stringify(formData.articles.sort()) !== JSON.stringify(origArticles.sort());

                      if (hasChanged) handleSave();
                      else setEditSections({...editSections, source: false});
                    } else {
                      setEditSections({...editSections, source: true});
                    }
                  }}>
                    {editSections.source ? <i className="bi bi-check-lg"></i> : <i className="bi bi-pencil"></i>}
                  </button>
                </div>

                {!editSections.source ? (
                  <div className={styles.displayList}>
                    <div className={styles.displayItem}>
                      <strong>Type:</strong> {formData.type_source === 'tous' ? 'Tous les articles' : formData.type_source === 'entrepot' ? 'Par entrepôt' : 'Par article'}
                    </div>
                    {formData.type_source === 'entrepot' && formData.id_entrepot && (
                      <div className={styles.displayItem}>
                        <strong>Entrepôt:</strong> {entrepotsList.find(e => e.id_entrepot === parseInt(formData.id_entrepot))?.nom || formData.id_entrepot}
                      </div>
                    )}
                    {formData.type_source === 'article' && (
                      <div className={styles.displayItem}>
                        <strong>Articles:</strong> {formData.articles.length} sélectionnés
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {formData.type_source === 'entrepot' && (
                      <select className={styles.filterSelect } value={formData.id_entrepot} onChange={e => setFormData({ ...formData, id_entrepot: e.target.value })}>
                        <option value="">Sélectionner...</option>
                        {entrepotsList.filter(e => (e.articles_count || 0) > 0).map(e => <option key={e.id_entrepot} value={e.id_entrepot}>{e.nom}</option>)}
                      </select>
                    )}

                    {formData.type_source === 'article' && (
                      <div className={`${styles.list} ${styles.scrollList}`} style={{ maxHeight: '120px' }}>
                        {articlesList.map(a => (
                          <label key={a.id_article} className={styles.checkboxLabel}>
                            <input type="checkbox" className={styles.checkbox} checked={formData.articles.includes(a.id_article)} onChange={() => handleArticleToggle(a.id_article)} />
                            {a.nom}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.detailsContainer}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>Agents assignés :</h4>
                  <button className={styles.editMiniBtn} onClick={() => {
                    if (editSections.agents) {
                      const origAgents = selectedItem.affectations?.map((a: any) => a.id_agent) || [];
                      const hasChanged = JSON.stringify(formData.agents.sort()) !== JSON.stringify(origAgents.sort());

                      if (hasChanged) handleSave();
                      else setEditSections({...editSections, agents: false});
                    } else {
                      setEditSections({...editSections, agents: true});
                    }
                  }}>
                    {editSections.agents ? <i className="bi bi-check-lg"></i> : <i className="bi bi-pencil"></i>}
                  </button>
                </div>

                {!editSections.agents ? (
                  <div className={styles.displayList}>
                    {formData.agents.length === 0 ? (
                      <p style={{fontSize: '0.75rem', color: '#94a3b8'}}>Aucun agent assigné.</p>
                    ) : (
                      formData.agents.map(agentId => {
                        const agent = agentsList.find(a => a.id === agentId);
                        const affectation = selectedItem.affectations?.find((a: any) => a.id_agent === agentId);
                        const status = affectation?.statut_participation || 'inactif';
                        
                        return (
                          <div key={agentId} className={styles.displayItem}>
                            <span className={styles.statusDot} style={{ backgroundColor: status === 'actif' ? '#22c55e' : '#94a3b8', width: '8px', height: '8px' }} />
                            {agent ? `${agent.nom} ${agent.prenom}` : `....`}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className={`${styles.list} ${styles.scrollList}`} style={{ maxHeight: '120px' }}>
                    {agentsList.map(agent => (
                      <label key={agent.id} className={styles.checkboxLabel}>
                        <input type="checkbox" className={styles.checkbox} checked={formData.agents.includes(agent.id)} onChange={() => handleAgentToggle(agent.id)} />
                        {agent.nom} {agent.prenom}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.detailsContainer}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}> Notes :</h4>
                  <button className={styles.editMiniBtn} onClick={() => {
                    if (editSections.remarque) {
                      const hasChanged = formData.remarque !== (selectedItem.remarque || '');
                      if (hasChanged) handleSave();
                      else setEditSections({...editSections, remarque: false});
                    } else {
                      setEditSections({...editSections, remarque: true});
                    }
                  }}>
                    {editSections.remarque ? <i className="bi bi-check-lg"></i> : <i className="bi bi-pencil"></i>}
                  </button>
                </div>
                
                {!editSections.remarque ? (
                  <div className={styles.premiumNoteBox}>
                    {formData.remarque || <span style={{color: '#94a3b8'}}>Aucune note pour cet inventaire.</span>}
                  </div>
                ) : (
                  <textarea className={styles.textareaInput} placeholder="Instructions..." value={formData.remarque} onChange={e => setFormData({ ...formData, remarque: e.target.value })} />
                )}
              </div>
            </div>
          )}

          {modalType === 'delete' && (
            <div className={styles.textAlignCenter}>
              {generalError && <div className={styles.authAlert} style={{ marginBottom: '1rem' }}>{generalError}</div>}
              <h3 className={styles.modalTitle}><i className="bi bi-exclamation-circle" /> Confirmation</h3>
              <p className={styles.marginB2} style={{ marginTop: '1rem' }}>Supprimer l'inventaire <strong>{selectedItem?.site}</strong> ?</p>
              <div className={styles.modalFooterCenter}>
                <button className={styles.ActionButton} onClick={onClose}>Annuler</button>
                <button className={styles.Submit} style={{ width: 'auto', marginTop: 0 }} onClick={handleDelete}>Supprimer</button>
              </div>
            </div>
          )}
          {modalType === 'terminate' && (
            <div className={styles.detailsForm}>
              <h3 className={styles.modalTitle}>
                <i className={summary?.statut === 'termine' ? "bi bi-file-earmark-bar-graph" : "bi bi-file-earmark-check"} /> 
                {summary?.statut === 'termine' ? 'Rapport d\'inventaire' : 'Clôture d\'inventaire'}
              </h3>
              {generalError && <div className={styles.authAlert} style={{ marginBottom: '1rem' }}>{generalError}</div>}
              
              {loadingSummary ? (
                <div className={styles.tableEmptyMsg}><span className={styles.loadingDots}></span></div>
              ) : summary ? (
                <>
                  <div className={styles.detailsContainer}>
                    <h4 className={styles.sectionTitle}>Résumé Global : {summary.titre}</h4>
                    <div className={styles.displayList}>
                      <div className={styles.displayItem}><strong>Articles sans écart :</strong> {formatCompactNumber(summary.sans_ecart_count)}</div>
                      <div className={styles.displayItem}>
                        <strong>Écarts Positifs (+) :</strong> {formatCompactNumber(summary.ecart_positif_count)} 
                        <span style={{ color: '#22c55e', marginLeft: '10px' }}>({formatCurrency(summary.ecart_positif_price || 0, currency, true)})</span>
                      </div>
                      <div className={styles.displayItem}>
                        <strong>Écarts Négatifs (-) :</strong> {formatCompactNumber(summary.ecart_negatif_count)}
                        <span style={{ color: '#ef4444', marginLeft: '10px' }}>({formatCurrency(summary.ecart_negatif_price || 0, currency, true)})</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailsContainer}>
                    <h4 className={styles.sectionTitle}>Détail des lignes :</h4>
                    <div className={layoutStyles.tableWrap} style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table className={styles.dashboardTable}>
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Théorique</th>
                            <th>Comptée</th>
                            <th>Écart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.lignes?.map((l: any) => (
                            <tr key={l.id_ligne}>
                              <td>
                                <div style={{ fontWeight: '500' }}>{l.nom}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{l.code_barres}</div>
                              </td>
                              <td>{l.quantite_theorique}</td>
                              <td>{l.quantite_comptee ?? 0}</td>
                              <td style={{ color: l.ecart > 0 ? '#22c55e' : l.ecart < 0 ? '#ef4444' : 'inherit' }}>
                                {l.ecart > 0 ? '+' : ''}{l.ecart}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.detailsContainer}>
                    <h4 className={styles.sectionTitle}>Agents participants :</h4>
                    <div className={styles.agentTagList} style={{ marginBottom: '1rem' }}>
                      {summary.agent_names?.map((name: string, idx: number) => (
                        <span key={idx} className={styles.countBadge} style={{ marginRight: '8px', marginBottom: '8px' }}>
                          {name}
                        </span>
                      ))}
                    </div>

                    <h4 className={styles.sectionTitle} style={{ fontSize: '0.9rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>Détails des Contributions par Article :</h4>
                    <div className={styles.scrollList} style={{ maxHeight: '200px' }}>
                       {summary.lignes?.filter((l:any) => l.agents_contrib).map((l: any) => (
                         <div key={l.id_ligne} className={styles.displayItem} style={{ padding: '8px', borderBottom: '1px solid #f8fafc' }}>
                            <strong>{l.nom} :</strong> <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{l.agents_contrib}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  {summary.statut !== 'termine' && (
                    <>
                      <div className={styles.alertsimple}>
                        <i className="bi bi-exclamation-triangle" style={{ marginRight: '10px' }} />
                        <strong>Attention :</strong> La validation générera le rapport final et supprimera définitivement les données temporaires.
                      </div>

                      <div className={styles.detailsContainer} style={{ marginTop: '1rem', border: '1px dashed #cbd5e1', padding: '1rem', backgroundColor: '#f8fafc' }}>
                        <label className={styles.checkboxLabel} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: '600' }}>
                          <input 
                            type="checkbox" 
                            className={styles.checkbox} 
                            checked={updateStock} 
                            onChange={e => setUpdateStock(e.target.checked)} 
                            style={{ width: '18px', height: '18px' }}
                          />
                          Mettre à jour les stocks réels (Articles & Entrepôts)
                        </label>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '5px', marginLeft: '28px' }}>
                          Une sauvegarde Excel des anciennes quantités sera générée automatiquement avant la mise à jour.
                        </p>
                      </div>

                      <div className={styles.modalFooterCenter}>
                        <button className={styles.ActionButton} onClick={onClose} disabled={loadingSummary}>Annuler</button>
                        <button 
                          className={styles.Submit} 
                          onClick={handleTerminate}
                          disabled={loadingSummary}
                        >
                          {loadingSummary ? 'Clôture en cours...' : 'Valider et Générer le Rapport'}
                        </button>
                      </div>
                    </>
                  )}

                  {summary.statut === 'termine' && (
                    <div className={styles.modalFooterCenter} style={{ gap: '1rem' }}>
                       <button className={styles.ActionButton} onClick={onClose}>Fermer</button>
                       <button 
                        className={styles.ActionButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444', width: 'auto' }}
                        onClick={() => window.open(`http://localhost:8000${summary.fichier_path}`, '_blank')}
                        title="Voir le PDF"
                      >
                        <i className="bi bi-file-earmark-pdf-fill" /> Rapport PDF
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p>Impossible de charger le résumé.</p>
              )}
            </div>
          )}
          {modalType === 'addNote' && (
            <div className={styles.detailsForm}>
              <h3 className={styles.modalTitle}><i className="bi bi-pencil-square" /> Ajouter une note</h3>
              {generalError && <div className={styles.fieldError}>{generalError}</div>}
              
              <div className={styles.detailsContainer}>
                <label>Sélectionner l'inventaire</label>
                <select 
                  className={styles.filterSelect} 
                  value={selectedInventaireId} 
                  onChange={e => setSelectedInventaireId(e.target.value ? parseInt(e.target.value) : '')}
                >
                  <option value="">Choisir un inventaire...</option>
                  {inventairesList.filter(inv => inv.statut !== 'termine').map(inv => (
                    <option key={inv.id_inventaire} value={inv.id_inventaire}>{inv.titre || inv.site}</option>
                  ))}
                </select>
              </div>

              <div className={styles.detailsContainer}>
                <label>Contenu de la note</label>
                <textarea 
                  className={styles.noteContent} 
                  placeholder="Écrivez votre message ici..."
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                />
              </div>

              <button 
                className={styles.Submit} 
                onClick={() => handleNoteSubmit()}
                disabled={submittingNote || !noteContent.trim() || !selectedInventaireId}
              >
                {submittingNote ? (
                  <>Envoi <span className={styles.loadingDots}></span></>
                ) : 'Envoyer la note'}
              </button>
            </div>
          )}

          {modalType === 'notes' && (
            <div className={styles.detailsForm}>
              <h3 className={styles.modalTitle}>
                 Notes : {selectedItem?.titre || selectedItem?.site}
              </h3>
                <div className={styles.noteThread}>
                  {loadingNotes ? (
                    <div className={styles.tableEmptyMsg}><span className={styles.loadingDots}></span></div>
                  ) : notes.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>Aucune note pour le moment.</p>
                  ) : (
                    notes.map(note => {
                      const user = JSON.parse(localStorage.getItem('user') || '{}');
                      const isMine = String(note.user?.id) === String(user.id);
                      const isAdmin = note.user?.role === 'admin';
                      const canManage = isMine || user.role === 'admin';
                      
                      return (
                        <div 
                          key={note.id_note} 
                          className={`${styles.noteBubble} ${isMine ? styles.noteBubbleMine : ''} ${isAdmin ? styles.noteAdmin : ''}`}
                        >
                          <div className={styles.noteUser}>
                            {note.user?.nom} {note.user?.prenom}
                            {isAdmin && <span className={styles.adminBadge}>Admin</span>}
                            
                            <div style={{ position: 'relative', marginLeft: 'auto' }}>
                               {canManage && editingNoteId !== note.id_note && (
                                  <div 
                                    className={styles.noteMenuButton} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveNoteMenu(activeNoteMenu === note.id_note ? null : note.id_note);
                                    }}
                                  >
                                    <i className="bi bi-three-dots-vertical" />
                                  </div>
                               )}

                               {activeNoteMenu === note.id_note && (
                                  <div className={styles.noteMenu} onClick={e => e.stopPropagation()}>
                                    <div className={styles.noteMenuItem} onClick={() => {
                                      setEditingNoteId(note.id_note);
                                      setEditNoteContent(note.contenu);
                                      setActiveNoteMenu(null);
                                    }}>
                                      <i className="bi bi-pencil" /> Modifier
                                    </div>
                                    <div className={`${styles.noteMenuItem} ${styles.deleteItem}`} onClick={() => {
                                      handleNoteDelete(note.id_note);
                                      setActiveNoteMenu(null);
                                    }}>
                                      <i className="bi bi-trash" /> Supprimer
                                    </div>
                                  </div>
                               )}
                            </div>
                          </div>
                          
                          {editingNoteId === note.id_note ? (
                            <div style={{ width: '100%' }}>
                              <textarea 
                                className={styles.textareaInput} 
                                style={{ minHeight: '50px', fontSize: '0.75rem', padding: '5px' }}
                                value={editNoteContent} 
                                onChange={e => setEditNoteContent(e.target.value)} 
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                <button className={styles.addButton} style={{ padding: '2px 8px', fontSize: '0.65rem' }} onClick={() => handleNoteUpdate(note.id_note)} disabled={submittingNote}>Valider</button>
                                <button className={styles.ActionButton} style={{ padding: '2px 8px', fontSize: '0.65rem' }} onClick={() => setEditingNoteId(null)}>Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '0.75rem', color: isMine ? '#0c4a6e' : '#1e293b', whiteSpace: 'pre-wrap' }}>{note.contenu}</p>
                          )}

                          <div className={styles.noteTime}>
                            {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isMine && <i className={`bi bi-check2-all ${note.lu ? 'text-primary' : 'text-primary'}`} style={{ color: note.lu ? '#3b82f6' : '#94a3b8' }} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedItem.statut !== 'termine' ? (
                  <div className={styles.marginT1} style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <label style={{ fontSize: '0.7rem' }}>Nouvelle note</label>
                    <textarea 
                        className={styles.noteContent}
                        placeholder="Ajouter une réponse ou instruction..."
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        disabled={submittingNote}
                    />
                    <button 
                      className={styles.Submit} 
                      style={{ marginTop: '0.5rem' }} 
                      onClick={() => handleNoteSubmit(selectedItem.id_inventaire)}
                      disabled={submittingNote || !noteContent.trim()}
                    >
                      {submittingNote ? (
                        <>Envoi <span className={styles.loadingDots}></span></>
                      ) : 'Ajouter'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.noteLocked}>
                    <i className="bi bi-lock-fill" /> Cet inventaire est terminé. Les notes sont en lecture seule.
                  </div>
                )}
              </div>
     
          )}

          {modalType === 'correctionRequests' && (
            <div className={styles.detailsForm}>
              <h3 className={styles.modalTitle} >
                <i className="bi bi-patch-check" /> Demandes de Correction
              </h3>
              
              <div className={styles.detailsContainer}>
                {loadingCorrections ? (
                  <div className={styles.tableEmptyMsg}><span className={styles.loadingDots}></span></div>
                ) : (corrections && corrections.length === 0) ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune demande en attente.</p>
                ) : (
                  <div className={styles.scrollList} style={{ maxHeight: '500px' }}>
                    {corrections.map((corr) => (
                      <div key={corr.id_corr} className={styles.correctionCard}>
                        <div className={styles.sectionHeader}>
                          <h4 style={{ margin: 0, color: '#1e293b' }}>
                            {corr.ligne?.article?.nom} 
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '10px' }}>({corr.ligne?.article?.code_barres})</span>
                          </h4>
                          <span className={styles.statusBadge} style={{ 
                            backgroundColor: corr.statut_validation === 'valide' ? '#dcfce7' : (corr.statut_validation === 'refuse' ? '#fee2e2' : '#fef9c3'),
                            color: corr.statut_validation === 'valide' ? '#166534' : (corr.statut_validation === 'refuse' ? '#991b1b' : '#854d0e')
                          }}>
                            {corr.statut_validation}
                          </span>
                        </div>

                        <div className={styles.detailsGrid} style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                          <div><strong>Inventaire:</strong> {corr.ligne?.inventaire?.titre || corr.ligne?.inventaire?.site}</div>
                          <div><strong>Agent:</strong> {corr.agent?.nom} {corr.agent?.prenom}</div>
                          <div><strong>Ancienne Qte:</strong> {corr.ligne?.quantite_comptee}</div>
                          <div className={styles.correctionQtyHighlight}><strong>Nouvelle Qte:</strong> {corr.qte}</div>
                        </div>

                        <div className={styles.correctionMotifBox}>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'inherit' }}><strong>Motif Agent:</strong> {corr.description}</p>
                        </div>

                        {corr.statut_validation === 'en attente' && (
                          <div style={{ marginTop: '15px' }}>
                            <textarea 
                              className={styles.textareaInput}
                              style={{ minHeight: '50px', fontSize: '0.8rem', marginBottom: '10px' }}
                              placeholder="Motif de rejet (obligatoire si refusé)..."
                              value={rejectionMotif}
                              onChange={e => setRejectionMotif(e.target.value)}
                            />
                            <div className={styles.flexRowCenter} style={{ gap: '10px' }}>
                              <button 
                                className={styles.addButton} 
                                style={{ background: '#22c55e', border: 'none' }}
                                onClick={() => handleCorrectionAction(corr.id_corr, 'valide')}
                                disabled={submittingNote}
                              >
                                <i className="bi bi-check-lg" /> Approuver
                              </button>
                              <button 
                                className={styles.Submit} 
                                style={{ background: '#ef4444', border: 'none', width: 'auto', marginTop: 0 }}
                                onClick={() => handleCorrectionAction(corr.id_corr, 'refuse')}
                                disabled={submittingNote}
                              >
                                <i className="bi bi-x-lg" /> Refuser
                              </button>
                            </div>
                          </div>
                        )}


                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventaireModals;
