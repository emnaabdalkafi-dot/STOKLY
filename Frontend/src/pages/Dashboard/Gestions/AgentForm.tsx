import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import styles from './Gestions.module.css';

interface Props {
  agent?: any;
  mode: 'add' | 'edit' | 'details';
  onClose: () => void;
  onSuccess: () => void;
}

const AgentForm: React.FC<Props> = ({ agent, mode, onClose, onSuccess }) => {
  const isDetails = mode === 'details';
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    tel: '',
  });

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [editSections, setEditSections] = useState({ info: false });

  // fill form if edit or details
  useEffect(() => {
    if (agent) {
      setForm({
        nom: agent.nom || '',
        prenom: agent.prenom || '',
        email: agent.email || '',
        tel: agent.tel || '',
      });
    }
  }, [agent]);

  // handle change
  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // validation
  const validate = () => {
    let newErrors: any = {};
    if (!form.nom) newErrors.nom = 'Nom requis';
    if (!form.prenom) newErrors.prenom = 'Prénom requis';
    if (!form.email) newErrors.email = 'Email requis';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email invalide';
    if (!form.tel) newErrors.tel = 'Téléphone requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // submit
  const handleSubmit = async (e: any) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit || (isDetails && editSections.info)) {
        await api.put(`/agents/${agent.id}`, form);
        setEditSections({ info: false });
        onSuccess();
        if (isEdit) onClose();
      } else {
        const res = await api.post('/agents', form);
        setGeneratedPassword(res.data.password);
      }
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString();
  };

  const statusClass = (status: string | undefined) => {
    if (status === 'actif') return styles.statusActif;
    if (status === 'inactif') return styles.statusInactif;
    return styles.statusWaiting;
  };

  if (isDetails && agent) {
    return (
      <div className={styles.modalContent}>
        <div className={styles.detailsForm}>
          <div className={styles.detailsContainer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
            <div className={styles.dashboardUserAvatar} style={{ width: '80px', height: '80px', fontSize: '1.5rem' }}>
              {agent.avatar ? (
                <img 
                  src={agent.avatar.startsWith('http') ? agent.avatar : `http://localhost:8000${agent.avatar}`} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                `${agent.nom?.charAt(0) ?? ''}${agent.prenom?.charAt(0) ?? ''}`.toUpperCase()
              )}
            </div>
            <h4 style={{ marginTop: '0.75rem', marginBottom: 0 }}>{agent.nom} {agent.prenom}</h4>
          </div>

          <div className={styles.detailsContainer}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Informations de base :</h4>
              <button className={styles.editMiniBtn} onClick={() => {
                if (editSections.info) {
                  // check if changed
                  const hasChanges = 
                    form.nom !== (agent.nom || '') ||
                    form.prenom !== (agent.prenom || '') ||
                    form.email !== (agent.email || '') ||
                    form.tel !== (agent.tel || '');

                  if (hasChanges) {
                    handleSubmit(null);
                  } else {
                    setEditSections({ ...editSections, info: false });
                  }
                } else {
                  setEditSections({ ...editSections, info: true });
                }
              }}>
                {editSections.info ? <i className="bi bi-check-lg" /> : <i className="bi bi-pencil" />}
              </button>
            </div>

            {!editSections.info ? (
              <div className={styles.displayList}>
                <div className={styles.displayItem}><strong>Email:</strong> {agent.email}</div>
                <div className={styles.displayItem}><strong>Tel:</strong> {agent.tel || '—'}</div>
              </div>
            ) : (
              <div className={styles.detailsGrid}>
                <div>
                  <label>Nom</label>
                  <div className={styles.InputGroup}>
                    <input type="text" name="nom" value={form.nom} onChange={handleChange} />
                  </div>
                  {errors.nom && <span className={styles.fieldError}>{errors.nom}</span>}
                </div>
                <div>
                  <label>Prénom</label>
                  <div className={styles.InputGroup}>
                    <input type="text" name="prenom" value={form.prenom} onChange={handleChange} />
                  </div>
                  {errors.prenom && <span className={styles.fieldError}>{errors.prenom}</span>}
                </div>
                <div>
                  <label>Email</label>
                  <div className={styles.InputGroup}>
                    <input type="email" name="email" value={form.email} onChange={handleChange} />
                  </div>
                  {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                </div>
                <div>
                  <label>Tel</label>
                  <div className={styles.InputGroup}>
                    <input type="text" name="tel" value={form.tel} onChange={handleChange} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.detailsContainer}>
            <h4 className={styles.sectionTitle}>Statistiques & Activité :</h4>
            <div className={styles.displayList}>
              <div className={styles.displayItem}>
                <strong>Statut actuel:</strong>
                <span className={statusClass(agent.statut)} style={{ marginLeft: '10px' }}>{agent.statut}</span>
              </div>
              <div className={styles.displayItem}>
                <strong>Dernier scan:</strong> {formatDate(agent.last_scan_at)}
              </div>
              {agent.statut === 'actif' && (
                <>
                  <div className={styles.displayItem}>
                    <strong>Inventaire en cours:</strong>
                    <span style={{ color: '#22c55e', fontWeight: '600', marginLeft: '5px' }}>
                      {agent.inventaire_actif_titre || 'Génération...'}
                    </span>
                  </div>
                  <div className={styles.displayItem}>
                    <strong>Total scans:</strong> <span className={styles.countBadge}>{agent.total_scans_count}</span>
                  </div>
                </>
              )}
              <div className={styles.displayItem}>
                <strong>Demandes de correction:</strong> <span className={styles.countBadge} style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{agent.corrections_count}</span>
              </div>
            </div>
          </div>

          <div className={styles.detailsContainer}>
            <h4 className={styles.sectionTitle}>Présence dans les inventaires :</h4>
            <div className={styles.List}>
              {agent.inventaires_details && agent.inventaires_details.length > 0 ? (
                agent.inventaires_details.map((inv: any) => {
                  const getStatusColor = (s: string) => {
                    const st = s.toLowerCase();
                    if (st.includes('cours')) return '#22c55e';
                    if (st.includes('termine')) return '#ef4444';
                    return '#f59e0b';
                  };
                  return (
                    <div key={inv.id} className={styles.Item}>
                      <div>
                        <span className={styles.statusDot} style={{ backgroundColor: getStatusColor(inv.statut) }} />
                        <strong>{inv.titre}</strong>
                        <span style={{ fontSize: '0.65rem', color: '#666', marginLeft: '5px' }}>({inv.participation})</span>
                      </div>
                      <span>Articles comptés: <strong>{inv.scans_count}</strong></span>
                    </div>
                  );
                })
              ) : (
                <p className={styles.emptyMsg}>Aucun inventaire effectué a cet agent.</p>
              )}
            </div>
          </div>

          <div className={styles.detailsContainer}>
            <h4 className={styles.sectionTitle}>Corrections demandées :</h4>
            <div className={styles.List}>
              {agent.corrections && agent.corrections.length > 0 ? (
                agent.corrections.map((correction: any) => (
                  <div key={correction.id} className={styles.Item}>
                    <div>
                      <strong>{correction.article?.nom || 'Article supprimé'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                      <span style={{ color: '#ef4444' }}>{correction.type_correction === 'ajout' ? '+' : '-'} {correction.quantite}</span>
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>({correction.statut})</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.emptyMsg}>Aucune correction demandée par cet agent.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className={`${styles.detailsForm} ${styles.modalContent}`} onSubmit={handleSubmit}>
      {isEdit &&
        <div className={styles.avatar}>
          {agent.avatar ? (
            <img alt="agent-image" className={styles.avatarImage} src={agent.avatar.startsWith('http') ? agent.avatar : `http://localhost:8000${agent.avatar}`} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {((agent.nom?.charAt(0) || '') + (agent.prenom?.charAt(0) || '')).toUpperCase()}
            </div>
          )}
        </div>
      }
      {generatedPassword ? (
        <div >
          <label>Mot de passe généré</label>
          <div className={styles.InputGroup}>
            <i className={`bi bi-lock ${styles.InputIcon}`} aria-hidden="true" />
            <input
              type="text"
              value={generatedPassword}
              readOnly
            />
            <button
              type="button"
              className={styles.dashboardMenuToggle}
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                setGeneratedPassword('');
                onSuccess();
                onClose();
                alert("Copié !");
              }}
            >
              <i className="bi bi-clipboard" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.detailsGrid}>
            <div>
              <label>Nom</label>
              <div className={styles.InputGroup}>
                <i className={`bi bi-person ${styles.InputIcon}`} aria-hidden="true" />
                <input
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleChange}
                  placeholder='Nom'
                  required
                />
              </div>
              {errors.nom && <span className={styles.fieldError}>{errors.nom}</span>}
            </div>
            <div>
              <label>Prénom</label>
              <div className={styles.InputGroup}>
                <i className={`bi bi-person ${styles.InputIcon}`} aria-hidden="true" />
                <input
                  type="text"
                  name="prenom"
                  value={form.prenom}
                  onChange={handleChange}
                  placeholder='Prénom'
                  required
                />
              </div>
              {errors.prenom && <span className={styles.fieldError}>{errors.prenom}</span>}
            </div>
          </div>
          <div>
            <label>Téléphone</label>
            <div className={styles.InputGroup}>
              <i className={`bi bi-telephone ${styles.InputIcon}`} aria-hidden="true" />
              <input
                type="tel"
                name="tel"
                value={form.tel}
                onChange={handleChange}
                placeholder='+21612345678' />
            </div>
            {errors.tel && <span className={styles.fieldError}>{errors.tel}</span>}
          </div>
          <div>
            <label>Email</label>
            <div className={styles.InputGroup}>
              <i className={`bi bi-envelope ${styles.InputIcon}`} aria-hidden="true" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder='Email @ exemple . com'
                required
              />
            </div>
            {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
          </div>

          <button type="submit" disabled={loading} className={styles.Submit}>
            {loading ? '...' : isEdit ? 'Modifier' : 'Ajouter'}
          </button>
        </>
      )}
    </form>
  );
};

export default AgentForm;