import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import styles from './Gestions.module.css';
import { formatCurrency, getCurrencySymbol, formatCompactNumber } from '../../../utils/formatters';

/* ================= TYPES ================= */

type Category = {
  id_category: number;
  nom: string;
  description?: string;
};

type Entrepot = {
  id_entrepot: number;
  nom: string;
  location?: string;
};

type EntrepotQte = {
  id_entrepot: number;
  quantite: number;
};

type LigneInventaire = {
  id_ligne: number;
  id_inventaire: number;
  quantite_comptee: number;
  ecart: number;
};

type Article = {
  id_article?: number;
  code_barres: string;
  nom: string;
  prix: number;
  etat: string;
  quantite_total?: number;
  categories: Category[];
  entrepots: (Entrepot & { pivot?: { quantite: number } })[];
  lignes_inventaire?: LigneInventaire[];
};

/* ================= ARTICLE MODAL ================= */

type ArticleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  selectedArticle: Article | null;
  categories: Category[];
  entrepots: Entrepot[];
  onReloadSettings?: () => void;
};

export const ArticleFormModal: React.FC<ArticleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedArticle,
  categories,
  entrepots,
  onReloadSettings
}) => {
  const currency = getCurrencySymbol();
  const [form, setForm] = useState({
    code_barres: '',
    nom: '',
    prix: 0,
    etat: 'connu',
    categories: [] as number[],
    entrepots: [] as EntrepotQte[],
    quantite_total: 0
  });

  const [qteMode, setQteMode] = useState<'totale' | 'entrepot'>('totale');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [newCatName, setNewCatName] = useState('');
  const [newEntName, setNewEntName] = useState('');

  const addInlineCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await api.post(`/stock/categories`, { nom: newCatName });
      setNewCatName('');
      onReloadSettings?.();
    } catch { /* ignore */ }
  };

  const addInlineEntrepot = async () => {
    if (!newEntName.trim()) return;
    try {
      await api.post(`/stock/entrepots`, { nom: newEntName });
      setNewEntName('');
      onReloadSettings?.();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedArticle) {
      const hasEntrepots = selectedArticle.entrepots && selectedArticle.entrepots.length > 0;
      setQteMode(hasEntrepots ? 'entrepot' : 'totale');
      setForm({
        code_barres: selectedArticle.code_barres,
        nom: selectedArticle.nom,
        prix: selectedArticle.prix,
        etat: selectedArticle.etat,
        categories: selectedArticle.categories?.map(c => c.id_category) || [],
        entrepots: selectedArticle.entrepots?.map(e => ({
          id_entrepot: e.id_entrepot,
          quantite: e.pivot?.quantite || 0
        })) || [],
        quantite_total: selectedArticle.quantite_total || 0
      });
    } else {
      setQteMode('totale');
      setForm({
        code_barres: '',
        nom: '',
        prix: 0,
        etat: 'connu',
        categories: [],
        entrepots: [],
        quantite_total: 0
      });
    }
    setFieldErrors({});
  }, [selectedArticle, isOpen]);

  if (!isOpen) return null;

  const toggleEntrepot = (id: number) => {
    const exists = form.entrepots.find(e => e.id_entrepot === id);
    if (exists) {
      setForm({ ...form, entrepots: form.entrepots.filter(e => e.id_entrepot !== id) });
    } else {
      setForm({ ...form, entrepots: [...form.entrepots, { id_entrepot: id, quantite: 0 }] });
    }
  };

  const updateQte = (id: number, val: number) => {
    setForm({
      ...form,
      entrepots: form.entrepots.map(e => e.id_entrepot === id ? { ...e, quantite: val } : e)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlertMsg(null);
    setFieldErrors({});
    try {
      const payload = { ...form };
      if (qteMode === 'totale') {
        payload.entrepots = [];
        payload.quantite_total = form.quantite_total || 0;
      } else {
        payload.quantite_total = payload.entrepots.reduce((sum, e) => sum + e.quantite, 0);
      }
      await onSubmit(payload);
      setAlertMsg({ type: 'success', text: selectedArticle ? "Article modifié avec succès" : "Article ajouté avec succès" });
      setForm({ code_barres: '', nom: '', prix: 0, etat: 'connu', categories: [], entrepots: [], quantite_total: 0 });
      setQteMode('totale');
      setTimeout(() => {
        if (selectedArticle) onClose();
        setAlertMsg(null);
      }, 1500);
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setAlertMsg({ type: 'error', text: "Veuillez corriger les erreurs ci-dessous" });
      } else {
        setAlertMsg({ type: 'error', text: err.response?.data?.message || "Erreur lors de la sauvegarde" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalPanel} ${styles.modalContentWide}`}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>{selectedArticle ? 'Modifier' : 'Nouveau'} Article</h3>
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        {alertMsg && (
          <div className={`${styles.alertBox} ${alertMsg.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {alertMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className={`${styles.detailsForm} ${styles.modalContent}`}>
          <div className={styles.detailsGrid}>
            <label>
              Code-barres
              <div className={styles.InputGroup}>
                <i className="bi bi-qr-code-scan" />
                <input placeholder="EX: 12345678" value={form.code_barres} onChange={e => setForm({ ...form, code_barres: e.target.value })} required />
              </div>
              {fieldErrors.code_barres && <span className={styles.fieldError}>{fieldErrors.code_barres[0]}</span>}
            </label>
            <label>
              Nom de l'article
              <div className={styles.InputGroup}>
                <i className="bi bi-tag" />
                <input placeholder="EX: PC Portable" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required />
              </div>
              {fieldErrors.nom && <span className={styles.fieldError}>{fieldErrors.nom[0]}</span>}
            </label>
          </div>

          <div className={styles.detailsGrid}>
            <label>
              Prix ({currency})
              <div className={styles.InputGroup}>
                <i className="bi bi-cash-stack" />
                <input type="number" step="0.01" min={0} value={form.prix} onChange={e => setForm({ ...form, prix: parseFloat(e.target.value) || 0 })} />
              </div>
              {fieldErrors.prix && <span className={styles.fieldError}>{fieldErrors.prix[0]}</span>}
            </label>
            <label>
              État
              <div className={styles.InputGroup}>
                <i className="bi bi-info-circle" />
                <input type="text" readOnly value={form.etat} onChange={e => setForm({ ...form, etat: e.target.value })} />
              </div>
              {fieldErrors.etat && <span className={styles.fieldError}>{fieldErrors.etat[0]}</span>}
            </label>
          </div>

          <div className={styles.marginT1}>
            <p className={styles.sectionTitle}>Catégories</p>
            <div className={`${styles.list} ${styles.scrollList}`}>
              {categories.map(c => (
                <label key={c.id_category} className={`${styles.checkboxLabel} ${styles.marginB1} ${styles.marginB05}`}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={form.categories.includes(c.id_category)}
                    onChange={e => {
                      if (e.target.checked) {
                        setForm({ ...form, categories: [...form.categories, c.id_category] });
                      } else {
                        setForm({ ...form, categories: form.categories.filter(id => id !== c.id_category) });
                      }
                    }}
                  />
                  {c.nom}
                </label>
              ))}
            </div>
            <div className={styles.inlineAddRow}>
              <div className={`${styles.InputGroup} ${styles.flex1}`}>
                <i className="bi bi-plus" />
                <input placeholder="Nouvelle catégorie..." value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInlineCategory(); } }} />
              </div>
              <button type="button" className={styles.inlineAddBtn} onClick={addInlineCategory}>Ajouter</button>
            </div>
          </div>

          <div className={styles.marginT1}>
            <p className={styles.sectionTitle}>Gestion de la Quantité</p>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label className={styles.checkboxLabel}>
                <input type="radio" checked={qteMode === 'totale'} onChange={() => setQteMode('totale')} className={styles.checkbox} style={{ borderRadius: '50%' }} />
                Quantité Globale
              </label>
              <label className={styles.checkboxLabel}>
                <input type="radio" checked={qteMode === 'entrepot'} onChange={() => setQteMode('entrepot')} className={styles.checkbox} style={{ borderRadius: '50%' }} />
                Quantité par Entrepôt
              </label>
            </div>

            {qteMode === 'totale' ? (
              <div>
                <div className={styles.InputGroup}>
                  <i className="bi bi-calculator" />
                  <input type="number" min={0} value={form.quantite_total} onChange={e => setForm({ ...form, quantite_total: parseInt(e.target.value) || 0 })} placeholder="Quantité Totale" />
                </div>
              </div>
            ) : (
              <>
                <div className={`${styles.list} ${styles.scrollList}`}>
                  {entrepots.map(en => {
                    const selected = form.entrepots.find(e => e.id_entrepot === en.id_entrepot);
                    return (
                      <div key={en.id_entrepot} className={styles.entrepotRow}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={!!selected}
                            onChange={() => toggleEntrepot(en.id_entrepot)}
                          />
                          {en.nom}
                        </label>
                        {selected && (
                          <div className={`${styles.InputGroup} ${styles.qteInputWrap}`}>
                            <input
                              type="number"
                              min={0}
                              value={selected.quantite}
                              onChange={e => updateQte(en.id_entrepot, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={styles.inlineAddRow}>
                  <div className={`${styles.InputGroup} ${styles.flex1}`}>
                    <i className="bi bi-plus" />
                    <input placeholder="Nouvel entrepôt..." value={newEntName} onChange={e => setNewEntName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInlineEntrepot(); } }} />
                  </div>
                  <button type="button" className={styles.inlineAddBtn} onClick={addInlineEntrepot}>Ajouter</button>
                </div>
              </>
            )}
          </div>

          <button type="submit" className={`${styles.Submit} ${styles.marginT15}`} disabled={loading}>
            {loading ? 'Traitement...' : (selectedArticle ? 'Mettre à jour' : 'Créer l\'article')}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ================= ARTICLE DETAILS MODAL ================= */

type ArticleDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  categories: Category[];
  entrepots: Entrepot[];
  onUpdate: (form: any) => Promise<void>;
  onReloadSettings?: () => void;
};

export const ArticleDetailsModal: React.FC<ArticleDetailsModalProps> = ({
  isOpen,
  onClose,
  article,
  categories,
  entrepots,
  onUpdate,
}) => {
  const currency = getCurrencySymbol();
  const [editSections, setEditSections] = useState({ info: false, categories: false, stock: false });
  const [form, setForm] = useState<any>(null);
  const [qteDetailsMode, setQteDetailsMode] = useState<'totale' | 'entrepot'>('totale');

  useEffect(() => {
    if (article) {
      const hasEntrepots = article.entrepots && article.entrepots.length > 0;
      setQteDetailsMode(hasEntrepots ? 'entrepot' : 'totale');
      setForm({
        code_barres: article.code_barres,
        nom: article.nom,
        prix: article.prix,
        etat: article.etat,
        categories: article.categories?.map(c => c.id_category) || [],
        entrepots: article.entrepots?.map(e => ({
          id_entrepot: e.id_entrepot,
          quantite: e.pivot?.quantite || 0
        })) || [],
        quantite_total: article.quantite_total || 0
      });
      setEditSections({ info: false, categories: false, stock: false });
    }
  }, [article, isOpen]);

  if (!isOpen || !article || !form) return null;

  const handleSave = async () => {
    try {
      await onUpdate(form);
      setEditSections({ info: false, categories: false, stock: false });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalPanel} ${styles.modalContentWide}`}>
        <div className={styles.modalHeaderRow}>
          <div className={styles.sectionHeader} style={{ flex: 1 }}>
            <h3 className={styles.modalTitle}>
              <span>Détails de </span> {article.nom}
            </h3>
          </div>
          
          {article.etat === 'inconnu' && (
            <button 
              className={styles.validerBtn} 
              onClick={() => onUpdate({ ...form, etat: 'connu' })}
            >
              <i className="bi bi-check-circle"  />
              Marquer comme connu
            </button>
          )}
          
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

       

        <div className={styles.modalContent}>
        <div className={styles.detailsForm}>
           {article.etat === 'inconnu' && (
          <div className={styles.importInfoBox }>
             <i className="bi bi-info-circle-fill" />
             <div className={styles.importInfoText} >
               Cet article a été scanné par un agent mais n'existe pas dans la base. Veuillez vérifier ses informations avant de le valider.
             </div>
          </div>
        )}
          <div className={styles.detailsContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Informations de base :</h4>
              <button className={styles.editMiniBtn} onClick={() => {
                if (editSections.info) {
                  const hasChanged = 
                    form.code_barres !== (article.code_barres || '') ||
                    form.nom !== (article.nom || '') ||
                    form.prix !== (article.prix || 0);
                  
                  if (hasChanged) handleSave();
                  else setEditSections({ ...editSections, info: false });
                } else {
                  setEditSections({ ...editSections, info: true });
                }
              }}>
                {editSections.info ? <i className="bi bi-check-lg" /> : <i className="bi bi-pencil" />}
              </button>
            </div>

            {!editSections.info ? (
              <div className={styles.displayList}>
                <div className={styles.displayItem}><strong>Code-barres:</strong> {article.code_barres}</div>
                <div className={styles.displayItem}><strong>Nom:</strong> {article.nom}</div>
                <div className={styles.displayItem} title={String(article.prix)}><strong>Prix:</strong> {formatCurrency(article.prix, currency, true)}</div>
                <div className={styles.displayItem}><strong>État:</strong> {article.etat}</div>
              </div>
            ) : (
              <div className={styles.detailsGrid}>
                <div>
                    <label>Code-barres</label>
                    <div className={styles.InputGroup}>
                        <input type="text" value={form.code_barres} onChange={e => setForm({ ...form, code_barres: e.target.value })} />
                    </div>
                </div>
                <div>
                    <label>Nom</label>
                    <div className={styles.InputGroup}>
                        <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                    </div>
                </div>
                <div>
                    <label>Prix ({currency})</label>
                    <div className={styles.InputGroup}>
                        <input type="number" step="0.001" value={form.prix} onChange={e => setForm({ ...form, prix: parseFloat(e.target.value) || 0 })} />
                    </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.detailsContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Catégories :</h4>
              <button className={styles.editMiniBtn} onClick={() => {
                if (editSections.categories) {
                  const origCats = article.categories?.map(c => c.id_category) || [];
                  const hasChanged = JSON.stringify(form.categories.sort()) !== JSON.stringify(origCats.sort());
                  
                  if (hasChanged) handleSave();
                  else setEditSections({ ...editSections, categories: false });
                } else {
                  setEditSections({ ...editSections, categories: true });
                }
              }}>
                {editSections.categories ? <i className="bi bi-check-lg" /> : <i className="bi bi-pencil" />}
              </button>
            </div>
            {!editSections.categories ? (
              <div className={styles.displayList}>
                {article.categories?.length > 0 ? 
                  article.categories.map(c => <div key={c.id_category} className={styles.displayItem}>{c.nom}</div>) :
                  <p className={styles.emptyMsg}>Aucune catégorie</p>
                }
              </div>
            ) : (
              <div className={`${styles.list} ${styles.scrollList}`} style={{ maxHeight: '150px' }}>
                {categories.map(c => (
                  <label key={c.id_category} className={styles.checkboxLabel}>
                    <input type="checkbox" className={styles.checkbox} checked={form.categories.includes(c.id_category)} onChange={e => {
                      if (e.target.checked) setForm({ ...form, categories: [...form.categories, c.id_category] });
                      else setForm({ ...form, categories: form.categories.filter((id: number) => id !== c.id_category) });
                    }} /> {c.nom}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.detailsContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Stock & Emplacements :</h4>
              <button className={styles.editMiniBtn} onClick={() => {
                if (editSections.stock) {
                  const origEntrepots = article.entrepots?.map(e => ({
                    id_entrepot: e.id_entrepot,
                    quantite: e.pivot?.quantite || 0
                  })) || [];
                  
                  const hasChanged = 
                    form.quantite_total !== (article.quantite_total || 0) ||
                    JSON.stringify(form.entrepots.sort((a:any, b:any) => a.id_entrepot - b.id_entrepot)) !== 
                    JSON.stringify(origEntrepots.sort((a:any, b:any) => a.id_entrepot - b.id_entrepot));

                  if (hasChanged) handleSave();
                  else setEditSections({ ...editSections, stock: false });
                } else {
                  setEditSections({ ...editSections, stock: true });
                }
              }}>
                {editSections.stock ? <i className="bi bi-check-lg" /> : <i className="bi bi-pencil" />}
              </button>
            </div>
            {!editSections.stock ? (
              <div className={styles.displayList}>
                <div className={styles.displayItem} title={String(article.quantite_total || 0)}><strong>Quantité Totale:</strong> {formatCompactNumber(article.quantite_total || 0)}</div>
                {article.entrepots?.map(e => (
                  <div key={e.id_entrepot} className={styles.displayItem} title={String(e.pivot?.quantite || 0)}>
                    <strong>{e.nom}:</strong> {formatCompactNumber(e.pivot?.quantite || 0)}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.list}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label className={styles.checkboxLabel}>
                    <input type="radio" checked={qteDetailsMode === 'totale'} onChange={() => setQteDetailsMode('totale')} className={styles.checkbox} style={{ borderRadius: '50%' }} />
                    Quantité Globale
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="radio" checked={qteDetailsMode === 'entrepot'} onChange={() => setQteDetailsMode('entrepot')} className={styles.checkbox} style={{ borderRadius: '50%' }} />
                    Quantité par Entrepôt
                  </label>
                </div>

                {qteDetailsMode === 'totale' ? (
                  <div>
                    <label>Qté Totale</label>
                    <div className={styles.InputGroup}>
                        <input type="number" min={0} value={form.quantite_total} onChange={e => setForm({ ...form, quantite_total: parseInt(e.target.value) || 0, entrepots: [] })} />
                    </div>
                  </div>
                ) : (
                  <div className={styles.scrollList} style={{ maxHeight: '200px' }}>
                    {entrepots.map(en => {
                      const selected = form.entrepots.find((e: any) => e.id_entrepot === en.id_entrepot);
                      return (
                        <div key={en.id_entrepot} className={styles.entrepotRow} style={{ marginBottom: '10px' }}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={!!selected}
                              onChange={() => {
                                if (selected) {
                                  setForm({ ...form, entrepots: form.entrepots.filter((e: any) => e.id_entrepot !== en.id_entrepot) });
                                } else {
                                  setForm({ ...form, entrepots: [...form.entrepots, { id_entrepot: en.id_entrepot, quantite: 0 }] });
                                }
                              }}
                            />
                            {en.nom}
                          </label>
                          {selected && (
                            <div className={styles.InputGroup} style={{ width: '100px', marginLeft: 'auto' }}>
                              <input type="number" min={0} value={selected.quantite} 
                                  onChange={e => {
                                      const newEnts = form.entrepots.map((ent: any) => ent.id_entrepot === en.id_entrepot ? { ...ent, quantite: parseInt(e.target.value) || 0 } : ent);
                                      setForm({ ...form, entrepots: newEnts });
                                  }} 
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        

        </div>
          <div className={styles.detailsContainer}>
            <h4 className={styles.sectionTitle}>Présence dans les inventaires :</h4>
            <div className={styles.List}>
              {article.lignes_inventaire && article.lignes_inventaire.length > 0 ? (
                article.lignes_inventaire.map((l: any) => {
                  const inv = l.inventaire;
                  if (!inv) return null;
                  const getStatusColor = (s: string) => {
                    if (s === 'en cours') return '#22c55e';
                    if (s === 'termine' || s === 'terminé') return '#ef4444';
                    return '#f59e0b'; 
                  };
                  const ecartVal = l.ecart;
                  const compteVal = l.quantite_comptee;
                  
                  return (
                    <div key={l.id_ligne} className={styles.Item}>
                        <div >
                        <span className={styles.statusDot} style={{ backgroundColor: getStatusColor(inv.statut), width: '8px', height: '8px' }} />
                        <strong>{inv.titre || inv.site} </strong>
                        <span style={{ fontSize: '0.65rem', color: '#666' }}> ({inv.type_source})</span>
                        </div>
                       
                        <span >Écart: {compteVal === 0 ? (
                          <span style={{ color: '#888' }}>Non calculé</span>
                        ) : (
                          <span title={String(ecartVal)} style={{ color: ecartVal === 0 ? 'green' : (ecartVal > 0 ? '#f59e0b' : 'red') }}>
                            {formatCompactNumber(ecartVal > 0 ? `+${ecartVal}` : ecartVal)}
                          </span>
                        )}</span>
                      
                    </div>
                  );
                })
              ) : (
                <p className={styles.emptyMsg}>Aucun inventaire lié</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

/* ================= MANAGE SETTINGS MODAL ================= */

type ManageSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'categories' | 'entrepots';
  items: any[];
  onSave: (data: any) => void;
  onDelete: (id: number) => void;
};

export const ManageSettingsModal: React.FC<ManageSettingsModalProps> = ({
  isOpen,
  onClose,
  type,
  items,
  onSave,
  onDelete
}) => {
  const [editingItem, setEditingItem] = useState<any>(null);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');

  useEffect(() => {
    if (isOpen) {
        setName('');
        setExtra('');
        setEditingItem(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    const payload: any = { nom: name };
    if (editingItem) payload.id = editingItem.id_category || editingItem.id_entrepot;
    if (type === 'categories') payload.description = extra;
    else payload.location = extra;

    onSave(payload);
    setName('');
    setExtra('');
    setEditingItem(null);
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setName(item.nom);
    setExtra(type === 'categories' ? item.description|| '' : item.location|| '');
  };

  const handleDelete = async (item: any) => {
    const id = item.id_category || item.id_entrepot;
    if (type === 'entrepots') {
      try {
        const res = await api.get(`/stock/entrepots/${id}/check`);
        const count = res.data.article_count;
        if (count > 0) {
          if (!window.confirm(`Cet entrepôt contient ${count} article(s). Supprimer quand même ?`)) return;
        }
      } catch { /* proceed */ }
    }
    onDelete(id);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalPanel}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Gérer les {type === 'categories' ? 'Catégories' : 'Entrepôts'}</h3>
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className={`${styles.InputGroup} ${styles.marginB1}`}>
          <i className="bi bi-plus-circle" />
            <input
                placeholder={`Nom du nouveau ${type === 'categories' ? 'catégorie' : 'entrepôt'}...`}
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <input
                placeholder={type === 'categories' ? 'Description...' : 'Localisation...'}
                value={extra}
                onChange={e => setExtra(e.target.value)}
                style={{ marginLeft: '10px' }}
            />
            <button className={styles.inlineAddBtn} onClick={handleSave}>
                {editingItem ? 'OK' : 'Ajouter'}
            </button>
        </div>

        <div className={`${styles.list} ${styles.scrollList} ${styles.bgTransparent}`}>
          {items.map(item => (
            <div key={item.id_category || item.id_entrepot} className={styles.settingsItem}>
              <div className={styles.flexColumn}>
                <span className={styles.settingsItemName}>{item.nom}</span>
                <span className={styles.settingsItemSub}>{type === 'categories' ? item.description : item.location}</span>
              </div>
              <div className={styles.settingsItemActions}>
                <button className={styles.ActionButton} onClick={() => handleEditClick(item)}><i className="bi bi-pencil" /></button>
                <button className={styles.bulkDeleteBtn} onClick={() => handleDelete(item)}><i className="bi bi-trash" /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className={styles.emptyMsg}>Aucun élément</p>}
        </div>
      </div>
    </div>
  );
};

/* ================= IMPORT MODAL ================= */

type ImportProps = {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, any>[];
  onConfirmImport: (data: any[]) => void;
  generalError?: string | null;
};

export const ImportExcelWizard: React.FC<ImportProps> = ({
  isOpen,
  onClose,
  data,
  onConfirmImport,
  generalError
}) => {
  const [mapping, setMapping] = useState<Record<string, string>>({
    code_barres: '',
    nom: '',
    prix: '',
    categories: '',
    entrepots: '',
    quantite_total: ''
  });

  if (!isOpen || !data.length) return null;

  const headers = Object.keys(data[0]);

  const fields = [
    { id: 'code_barres', label: 'Code-barres', icon: 'bi-qr-code-scan', required: true },
    { id: 'nom', label: 'Nom Article', icon: 'bi-tag', required: true },
    { id: 'prix', label: 'Prix', icon: 'bi-currency-dollar', required: false },
    { id: 'categories', label: 'Catégories', icon: 'bi-grid', required: false },
    { id: 'entrepots', label: 'Entrepôts', icon: 'bi-house-gear', required: false },
    { id: 'quantite_total', label: 'Quantité Totale', icon: 'bi-calculator', required: true },
  ];

  const handleImport = () => {
    if (!mapping.code_barres || !mapping.nom || !mapping.quantite_total) {
      alert("Veuillez mapper les champs obligatoires (Code-barres, Nom, Quantité Totale)");
      return;
    }

    const transformed = data.map(row => ({
      code_barres: row[mapping.code_barres],
      nom: row[mapping.nom],
      prix: mapping.prix ? row[mapping.prix] : 0,
      categories: mapping.categories ? row[mapping.categories] : null,
      entrepots: mapping.entrepots ? row[mapping.entrepots] : null,
      quantite_total: row[mapping.quantite_total] ? Number(row[mapping.quantite_total]) : 0
    }));

    onConfirmImport(transformed);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalPanel} ${styles.modalContentExtraWide}`}>
        <div className={styles.modalHeaderRow}>
          <div className={styles.flex1}>
            <h3 className={styles.modalTitle}>Assistant d'Importation</h3>
            <p className={styles.importWizardSub}>Associez les colonnes de votre fichier Excel</p>
          </div>
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className={styles.modalContent}>

        

        {generalError && <div className={styles.authAlert} style={{ marginBottom: '1rem' }}>{generalError}</div>}

        <div className={styles.detailsForm}>
          {fields.map(field => (
            <div key={field.id} className={styles.importFieldRow}>
              <div className={styles.importFieldLabel}>
                <i className={`bi ${field.icon} ${styles.colorGold}`} />
                <span>{field.label} {field.required && <span className={styles.requiredStar}>*</span>}</span>
              </div>
              <div className={`${styles.InputGroup} ${styles.flex1}`}>
                <select className={styles.selectInputGhost} value={mapping[field.id]} onChange={e => setMapping({ ...mapping, [field.id]: e.target.value })}>
                  <option value="">-- Choisir colonne --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.importInfoBox}>
          <i className={`bi bi-info-circle-fill ${styles.colorGold}`} />
          <p className={styles.importInfoText}>
            Si "Entrepôts" n'est pas mappé, la quantité sera affectée directement au stock global. Si "Entrepôts" est mappé, les quantités seront affectées à l'entrepôt correspondant.<br />
            Les catégories et entrepôts inexistants seront créés automatiquement.
          </p>
        </div>

        <button className={`${styles.Submit} ${styles.marginT15} ${styles.flexRowCenter}`} onClick={handleImport}>
          <i className="bi bi-check-all" /> Finaliser l'importation ({data.length} articles)
        </button>
      </div>
      </div>
    </div>
  );
};

/* ================= BULK ACTIONS MODALS ================= */

type BulkCategoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  categories: any[];
  onConfirm: (categoryIds: number[]) => void;
};

export const BulkAddCategoryModal: React.FC<BulkCategoryModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  categories,
  onConfirm
}) => {
  const [selectedCats, setSelectedCats] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggle = (id: number) => {
    setSelectedCats(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalPanel}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Ajouter à catégorie</h3>
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <p className={styles.marginB1}>{selectedIds.length} articles sélectionnés</p>

        <div className={`${styles.list} ${styles.scrollList} ${styles.marginB1}`}>
          {categories.map((c: any) => (
            <label key={c.id_category} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selectedCats.includes(c.id_category)}
                onChange={() => toggle(c.id_category)}
              />
              {c.nom}
            </label>
          ))}
        </div>

       <button
  className={styles.Submit}
  onClick={() => {
    onConfirm(selectedCats);
    onClose(); 
  }}
  disabled={selectedCats.length === 0}
>
  Confirmer
</button>
      </div>
    </div>
  );
};

type BulkEntrepotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  entrepots: any[];
  onConfirm: (data: any[]) => void;
};

export const BulkAddEntrepotModal: React.FC<BulkEntrepotModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  entrepots,
  onConfirm
}) => {
  const [selected, setSelected] = useState<any[]>([]);

  if (!isOpen) return null;

  const toggle = (id: number) => {
    const exists = selected.find(e => e.id_entrepot === id);
    if (exists) {
      setSelected(selected.filter(e => e.id_entrepot !== id));
    } else {
      setSelected([...selected, { id_entrepot: id, quantite: 0 }]);
    }
  };


  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalPanel}>
        <div className={styles.modalHeaderRow}>
          <h3 className={styles.modalTitle}>Ajouter à entrepôt</h3>
          <button className={styles.dashboardMenuToggle} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <p className={styles.marginB1}>{selectedIds.length} articles sélectionnés</p>

        <div className={`${styles.list} ${styles.scrollList} ${styles.marginB1}`}>
          {entrepots.map((e: any) => {
            const selectedEntry = selected.find(s => s.id_entrepot === e.id_entrepot);
            return (
              <div key={e.id_entrepot} className={styles.entrepotRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={!!selectedEntry}
                    onChange={() => toggle(e.id_entrepot)}
                  />
                  {e.nom}
                </label>
              </div>
            );
          })}
        </div>

        <button
  className={styles.Submit}
  onClick={() => {
    onConfirm(selected);
    onClose(); 
  }}
  disabled={selected.length === 0}
>
  Confirmer
</button>
      </div>
    </div>
  );
};