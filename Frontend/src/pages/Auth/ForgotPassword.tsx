import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import styles from './Auth.module.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await axios.post('http://localhost:8000/api/forgot-password', { email });
            setMessage({ type: 'success', text: response.data.message });
        } catch (error: any) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.message || "Une erreur est survenue lors de l'envoi de l'email." 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className={styles.authFormPanel} style={{ width: '100%', maxWidth: '450px', height: 'auto' }}>
                    <div className={styles.authBrand}>
                        <img src={new URL('../../assets/Logo image.png', import.meta.url).href} alt="Logo" className={styles.authLogoImage} />
                        <h1>Mot de passe oublié</h1>
                        <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                    </div>

                    {message && (
                        <div className={message.type === 'success' ? styles.statusBadge : styles.authAlert} 
                             style={message.type === 'success' ? { backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '5px', fontSize: '0.7rem' } : {}}>
                            {message.text}
                        </div>
                    )}

                    <form className={styles.authForm} onSubmit={handleSubmit} style={{ gap: '1.5rem' }}>
                        <label>
                            Adresse Email
                            <div className={styles.authInputGroup}>
                                <i className={`bi bi-envelope ${styles.authInputIcon}`} />
                                <input 
                                    type="email" 
                                    placeholder="votre@email.com" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required 
                                />
                            </div>
                        </label>

                        <button type="submit" className={styles.authSubmit} disabled={loading}>
                            {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
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

export default ForgotPassword;
