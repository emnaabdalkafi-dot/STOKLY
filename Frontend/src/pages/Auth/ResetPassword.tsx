import React, { useState } from 'react';
import api from '../../services/api';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import styles from './Auth.module.css';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const logoImage = new URL('../../assets/Logo image.png', import.meta.url).href;
    const logoText = new URL('../../assets/logo text.png', import.meta.url).href;

    const [showPassword, setShowPassword] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== passwordConfirmation) {
            setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await api.post('/reset-password', {
                token,
                email,
                password,
                password_confirmation: passwordConfirmation
            });

            setMessage({ type: 'success', text: response.data.message });
            setTimeout(() => navigate('/'), 3000);
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || "Une erreur est survenue lors de la réinitialisation."
            });
        } finally {
            setLoading(false);
        }
    };

    if (!token || !email) {
        return (
            <div className={styles.authPage} >
                <div className={styles.authAlert}>Lien de réinitialisation invalide ou expiré.</div>
            </div>
        );
    }

    return (
        <div className={styles.authPage} style={{display:'block'}}>
            <div className={styles.resetForm}>
                <div className={styles.authBrand}>
                    <img src={logoImage} alt="STOKLY logo" className={styles.authLogoImage} />
                    <img src={logoText} alt="STOKLY" className={styles.authLogoText} />
                    <p>Définissez votre nouveau mot de passe.</p>
                </div>

                {message && (
                    <div className={message.type === 'success' ? styles.messageSuccess : styles.authAlert} >
                        {message.text}
                    </div>
                )}

                <form className={styles.authForm} onSubmit={handleSubmit} style={{ gap: '1.2rem' }}>
                    <label>
                        Nouveau mot de passe
                        <div className={styles.authInputGroup}>
                            <i className={`bi bi-lock ${styles.authInputIcon}`} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder=" Nouveau mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className={styles.authPasswordToggle}
                                onClick={() => setShowPassword((value) => !value)}
                                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            >
                                <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true" />
                            </button>
                        </div>
                    </label>

                    <label>
                        Confirmer le mot de passe
                        <div className={styles.authInputGroup}>
                            <i className={`bi bi-shield-lock ${styles.authInputIcon}`} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Confirmer le mot de passe "
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className={styles.authPasswordToggle}
                                onClick={() => setShowPassword((value) => !value)}
                                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            >
                                <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} aria-hidden="true" />
                            </button>
                        </div>
                    </label>

                    <button type="submit" className={styles.authSubmit} disabled={loading}>
                        {loading ?  <span className={styles.loading} >Réinitialisation </span>  : 'Changer le mot de passe'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
