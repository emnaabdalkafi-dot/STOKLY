import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Auth.module.css';
import { reconnectEcho } from '../../services/echo';
import { useAuth } from '../../context/AuthContext';

const logoImage = new URL('../../assets/Logo image.png', import.meta.url).href;
const logoText = new URL('../../assets/logo text.png', import.meta.url).href;


const Auth: React.FC = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register states
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [tel, setTel] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [registerMessage, setRegisterMessage] = useState('');

  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await axios.post('http://localhost:8000/api/login', {
        email: loginEmail,
        password: loginPassword,
      });
      if (response.data.success) {
        localStorage.setItem('token', response.data.data.token);
        if (response.data.data.user) {
          login(response.data.data.user);
        }
        reconnectEcho(); // Refresh WebSocket connection with new token
        navigate('/accueil');
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Erreur de connexion');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterErrors({});
    setRegisterMessage('');

    if (registerPassword !== passwordConfirm) {
      setRegisterErrors({ passwordConfirm: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/api/register', {
        nom,
        prenom,
        email: registerEmail,
        password: registerPassword,
        tel,
      });

      if (response.data.success) {
        // Clear form fields
        setNom('');
        setPrenom('');
        setTel('');
        setRegisterEmail('');
        setRegisterPassword('');
        setPasswordConfirm('');
        setShowRegisterPassword(false);
        setRegisterErrors({});
        setRegisterMessage('');
        // Switch to login form
        setIsLogin(true);
      }
    } catch (err: any) {
      const apiData = err.response?.data;
      if (apiData?.errors) {
        const fieldErrors = Object.entries(apiData.errors).reduce(
          (acc: Record<string, string>, [key, value]) => ({
            ...acc,
            [key]: Array.isArray(value) ? value[0] : String(value),
          }),
          {}
        );
        setRegisterErrors(fieldErrors);
      } else {
        setRegisterMessage(apiData?.message || 'Erreur d\'inscription, réessayez.');
      }
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
             <div className={`${styles.authFormPanel} ${isLogin ? styles.active : styles.inactive}`} >
            <form onSubmit={handleLoginSubmit} className={styles.authForm}>
              <div className={styles.authBrand}>
                <img src={logoImage} alt="STOKLY logo" className={styles.authLogoImage} />
                <img src={logoText} alt="STOKLY" className={styles.authLogoText} />
              </div>
              {loginError && <div className={styles.authAlert}>{loginError}</div>}
              <div>
                <label>Email</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-envelope `} aria-hidden="true" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder='Email @ exemple . com'
                    required
                  />
                </div>
              </div>
              <div>
                <label>Mot de passe</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-lock `} aria-hidden="true" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder='Mot de passe'
                    required
                  />
                  <button
                    type="button"
                    className={styles.authPasswordToggle}
                    onClick={() => setShowLoginPassword((value) => !value)}
                    aria-label={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <i className={showLoginPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div >
                <Link to="/forgot-password" className={styles.authLinkMuted}>Mot de passe oublié ?</Link>
              </div>
              <button type="button" onClick={toggleForm} className={styles.authLink}>
                Vous n'avez pas de compte ?
              </button>
            <button type="submit" className={styles.authSubmit}>
              Se connecter
            </button>
            </form>
             </div>
             <div className={`${styles.authFormPanel} ${isLogin ? styles.inactive : styles.active}`} >
            <form onSubmit={handleRegisterSubmit} className={styles.authForm}>
              <div className={styles.authBrand}>
                <img src={logoImage} alt="STOKLY logo" className={styles.authLogoImage} />
                <img src={logoText} alt="STOKLY" className={styles.authLogoText} />
              </div>
              {registerMessage && <div className={styles.authAlert}>{registerMessage}</div>}
              <div >
                <div>
                  <label>Nom</label>
                  <div className={styles.authInputGroup}>
                    <i className={`bi bi-person `} aria-hidden="true" />
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder='Nom'
                      required
                    />
                  </div>
                  {registerErrors.nom && <span className={styles.fieldError}>{registerErrors.nom}</span>}
                </div>
                <div>
                  <label>Prénom</label>
                  <div className={styles.authInputGroup}>
                    <i className={`bi bi-person `} aria-hidden="true" />
                    <input
                      type="text"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      placeholder='Prénom'
                      required
                    />
                  </div>
                  {registerErrors.prenom && <span className={styles.fieldError}>{registerErrors.prenom}</span>}
                </div>
              </div>
              <div>
                <label>Téléphone</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-telephone `} aria-hidden="true" />
                  <input
                    type="tel"
                    maxLength={8}
                    minLength={8}
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder='12 345 678'
                  />
                </div>
                {registerErrors.tel && <span className={styles.fieldError}>{registerErrors.tel}</span>}
              </div>
              <div>
                <label>Email</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-envelope `} aria-hidden="true" />
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder='Email @ exemple . com'
                    required
                  />
                </div>
                {registerErrors.email && <span className={styles.fieldError}>{registerErrors.email}</span>}
              </div>
              <div>
                <label>Mot de passe</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-lock `} aria-hidden="true" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder='Mot de passe'
                    required
                  />
                  <button
                    type="button"
                    className={styles.authPasswordToggle}
                    onClick={() => setShowRegisterPassword((value) => !value)}
                    aria-label={showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <i className={showRegisterPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true" />
                  </button>
                </div>
                {registerErrors.password && <span className={styles.fieldError}>{registerErrors.password}</span>}
              </div>
              <div>
                <label>Confirmer mot de passe</label>
                <div className={styles.authInputGroup}>
                  <i className={`bi bi-lock `} aria-hidden="true" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder='Confirmer le mot de passe'
                    required
                  />
                  <button
                    type="button"
                    className={styles.authPasswordToggle}
                    onClick={() => setShowRegisterPassword((value) => !value)}
                    aria-label={showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <i className={showRegisterPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true" />
                  </button>
                </div>
                {registerErrors.passwordConfirm && <span className={styles.fieldError}>{registerErrors.passwordConfirm}</span>}
              </div>
            <button type="button" onClick={toggleForm} className={styles.authLink}>
                Vous avez déjà un compte ?
            </button>
            <button type="submit" className={styles.authSubmit}>
              S'inscrire
            </button>
            </form>
        </div>
              </div>
        <div className={styles.authImagePanel} style={{ left: isLogin ? '50.5%' : '2.5%' }}>
        </div>

    </div>
  );
};

export default Auth;