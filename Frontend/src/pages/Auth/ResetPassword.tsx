import React, { useState } from 'react';
import axios from 'axios';
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== passwordConfirmation) {
            setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await axios.post('http://localhost:8000/api/reset-password', {
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
            <div className={styles.authPage}>
                <div className={styles.authAlert}>Lien de réinitialisation invalide ou expiré.</div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className={styles.authFormPanel} style={{ width: '100%', maxWidth: '450px', height: 'auto' }}>
                    <div className={styles.authBrand}>
                        <img src={new URL('../../assets/Logo image.png', import.meta.url).href} alt="Logo" className={styles.authLogoImage} />
                        <h1>Réinitialisation</h1>
                        <p>Définissez votre nouveau mot de passe.</p>
                    </div>

                    {message && (
                        <div className={message.type === 'success' ? styles.statusBadge : styles.authAlert} 
                             style={message.type === 'success' ? { backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '5px', fontSize: '0.7rem' } : {}}>
                            {message.text}
                        </div>
                    )}

                    <form className={styles.authForm} onSubmit={handleSubmit} style={{ gap: '1.2rem' }}>
                        <label>
                            Nouveau mot de passe
                            <div className={styles.authInputGroup}>
                                <i className={`bi bi-lock ${styles.authInputIcon}`} />
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                />
                            </div>
                        </label>

                        <label>
                            Confirmer le mot de passe
                            <div className={styles.authInputGroup}>
                                <i className={`bi bi-shield-lock ${styles.authInputIcon}`} />
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    value={passwordConfirmation}
                                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                                    required 
                                />
                            </div>
                        </label>

                        <button type="submit" className={styles.authSubmit} disabled={loading}>
                            {loading ? 'Réinitialisation...' : 'Changer le mot de passe'}
                        </button>
                    </form>

                    <div className={styles.authFooter} style={{ textAlign: 'center' }}>
                        <Link to="/" className={styles.authLinkMuted}>Retour à la connexion</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
