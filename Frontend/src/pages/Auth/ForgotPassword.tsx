import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import styles from './Auth.module.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const logoImage = new URL('../../assets/Logo image.png', import.meta.url).href;
    const logoText = new URL('../../assets/logo text.png', import.meta.url).href;

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
        <div className={styles.authPage} style={{ display: 'block' }}>
            <div className={styles.resetForm}>
                <div className={styles.authBrand}>

                    <img src={logoImage} alt="STOKLY logo" className={styles.authLogoImage} />
                    <img src={logoText} alt="STOKLY" className={styles.authLogoText} />
                    <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                {message && (
                    <div className={message.type === 'success' ? styles.messageSuccess : styles.authAlert}>
                        {message.text}
                    </div>
                )}

                <form className={styles.authForm} onSubmit={handleSubmit} >
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
                        {loading ? <span className={styles.loading} >Envoi en cours </span> : 'Envoyer le lien'}
                    </button>
                </form>
                <Link to="/" className={styles.authLink}>Retour à la connexion</Link>
            </div>
        </div>
    );
};

export default ForgotPassword;
