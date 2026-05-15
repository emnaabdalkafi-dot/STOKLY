import React, { useState, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import styles from './Parametres.module.css';
import layoutStyles from '../../../components/layout/layout.module.css';

const Parametres: React.FC = () => {
  const { user, updateUser } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [currency, setCurrency] = useState(localStorage.getItem('stokly_currency') || 'DT');
  const [form, setForm] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    tel: user?.tel || '',
    current_password: '',
    password: '',
    password_confirmation: ''
  });
  
  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.post(`/user/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        updateUser({ ...user!, avatar: res.data.data.avatar });
      }
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la mise à jour de l'avatar");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasChanged = 
      form.nom !== (user?.nom || '') ||
      form.prenom !== (user?.prenom || '') ||
      form.email !== (user?.email || '') ||
      form.tel !== (user?.tel || '') ||
      form.password !== '';

    if (!hasChanged) {
      setIsEditing(false);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const payload: any = {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        tel: form.tel,
      };

      if (form.password) {
        payload.current_password = form.current_password;
        payload.password = form.password;
        payload.password_confirmation = form.password_confirmation;
      }

      const res = await api.put(`/user/profile`, payload);
      if (res.data.success) {
        updateUser(res.data.data);
        setIsEditing(false);
        setForm({ ...form, current_password: '', password: '', password_confirmation: '' });
      }
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────
  //  render
  // ──────────────────────────────────────────

  return (
    <main className={styles.dashboardMain}>
      {isEditing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button
              className={styles.dashboardMenuToggle}
              onClick={() => setIsEditing(false)}
            >
              <i className="bi bi-x-lg" />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#102a43' }}>Modifier le profil</h3>
            
            <form className={styles.detailsForm} onSubmit={handleSubmit}>
              <div className={styles.avatarUpload} onClick={() => fileInputRef.current?.click()}>
              <div title="Cliquer pour changer d'avatar">
            {user?.avatar ? (
              <img 
                src={`http://localhost:8000${user.avatar}`} 
                alt="Avatar" 
              />
            ) : (
              <div >
                {user?.nom && user?.prenom 
                  ? `${user.nom.charAt(0).toUpperCase()}${user.prenom.charAt(0).toUpperCase()}` 
                  : '??'}
              </div>
            )}
          </div>
                <span style={{ fontSize: '0.7rem', color: '#D99A37', cursor: 'pointer', fontWeight: 600 }}>Changer la photo</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className={styles.fileInputHidden} 
                  onChange={handleAvatarChange} 
                  accept="image/*"
                />
              </div>

              <div className={styles.detailsGrid}>
                <div>
                  <label>Nom</label>
                  <div className={styles.InputGroup}>
                    <i className="bi bi-person" />
                    <input type="text" name="nom" value={form.nom} onChange={handleChange} required />
                  </div>
                  {errors.nom && <span className={styles.fieldError}>{errors.nom[0]}</span>}
                </div>
                <div>
                  <label>Prénom</label>
                  <div className={styles.InputGroup}>
                    <i className="bi bi-person" />
                    <input type="text" name="prenom" value={form.prenom} onChange={handleChange} required />
                  </div>
                  {errors.prenom && <span className={styles.fieldError}>{errors.prenom[0]}</span>}
                </div>
              </div>

              <div>
                <label>Téléphone</label>
                <div className={styles.InputGroup}>
                  <i className="bi bi-telephone" />
                  <input type="tel" name="tel" value={form.tel} onChange={handleChange} />
                </div>
                {errors.tel && <span className={styles.fieldError}>{errors.tel[0]}</span>}
              </div>

              <div>
                <label>Email</label>
                <div className={styles.InputGroup}>
                  <i className="bi bi-envelope" />
                  <input type="email" name="email" value={form.email} onChange={handleChange} required />
                </div>
                {errors.email && <span className={styles.fieldError}>{errors.email[0]}</span>}
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>Changer le mot de passe (optionnel)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div>
                      <div className={styles.InputGroup}>
                        <i className="bi bi-lock" />
                        <input type="password" name="current_password" placeholder="Mot de passe actuel" value={form.current_password} onChange={handleChange} />
                      </div>
                      {errors.current_password && <span className={styles.fieldError}>{errors.current_password[0]}</span>}
                  </div>
                  
                  <div>
                      <div className={styles.InputGroup}>
                        <i className="bi bi-shield-lock" />
                        <input type="password" name="password" placeholder="Nouveau mot de passe" value={form.password} onChange={handleChange} />
                      </div>
                      {errors.password && <span className={styles.fieldError}>{errors.password[0]}</span>}
                  </div>
                  
                  <div>
                      <div className={styles.InputGroup}>
                        <i className="bi bi-shield-check" />
                        <input type="password" name="password_confirmation" placeholder="Confirmer mot de passe" value={form.password_confirmation} onChange={handleChange} />
                      </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading} className={styles.Submit}>
                {loading ? <span className={layoutStyles.loadingDots}></span> : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <section className={styles.dashboardPanel}>
        <div className={styles.profileHeader}>
            <div title="Cliquer pour changer d'avatar">
            {user?.avatar ? (
              <img 
                src={`http://localhost:8000${user.avatar}`} 
                alt="Profile"
                className={styles.authLogoImage} 
              />
            ) : user ? (
              <div >
                {user?.nom && user?.prenom 
                  ? `${user.nom.charAt(0).toUpperCase()}${user.prenom.charAt(0).toUpperCase()}` 
                  : '??'}
              </div>
            ) : (
              <div className={styles.authLogoImage} >
                <span className={layoutStyles.loadingDots}></span>
              </div>
            )}
          </div>
          <div className={styles.profileInfo}>
            <h2>{user ? `${user.nom} ${user.prenom}` : <span className={layoutStyles.loadingDots}></span>}</h2>
            <p><i className="bi bi-envelope" /> {user ? user.email : <span className={layoutStyles.loadingDots}></span>}</p>
            <p><i className="bi bi-telephone" /> {user ? (user.tel || 'Non renseigné') : <span className={layoutStyles.loadingDots}></span>}</p>
            <button className={styles.editButton} disabled={!user} onClick={() => {
              if (user) {
                setForm({
                  nom: user.nom,
                  prenom: user.prenom,
                  email: user.email || '',
                  tel: user.tel || '',
                  current_password: '',
                  password: '',
                  password_confirmation: ''
                });
                setIsEditing(true);
              }
            }}>
              <i className="bi bi-pencil" /> Modifier profil
            </button>
          </div>
        </div>

        <div className={styles.ParametreBody}>
           <h3 className={styles.ParametreTitle}>Paramètres de l'application :</h3>
           
           <div className={styles.inputWrapper}>
             <label className={styles.inputLabel}>Symbole de la monnaie :</label>
             <div className={styles.InputGroup} >
                <i className="bi bi-cash-stack" />
                <input 
                  type="text"
                  className={styles.inputSymbol}
                  placeholder="Symbole (ex: DT, $, €)"
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') {
                    localStorage.setItem('stokly_currency', currency);
                    window.location.reload();
                  }}}
                />
                {currency !== (localStorage.getItem('stokly_currency') || 'DT') && (
                  <button 
                    className={styles.miniOkBtn}
                    onClick={() => {
                      localStorage.setItem('stokly_currency', currency);
                      window.location.reload();
                    }}
                  >
                    OK
                  </button>
                )}
             </div>
           </div>
           <p className={styles.description}>Appuyez sur OK ou Entrée pour appliquer le symbole.</p>
        </div>
      </section>
    </main>
  );
};

export default Parametres;
