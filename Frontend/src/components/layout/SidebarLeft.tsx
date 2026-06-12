import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './layout.module.css';
import { useAuth } from '../../context/AuthContext';
import { BACKEND_URL } from '../../services/api';
interface SidebarProps {
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const logoImage = new URL('../../assets/Logo image.png', import.meta.url).href;
const logoText = new URL('../../assets/logo text.png', import.meta.url).href;

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isOpen = true }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    logout();
    navigate('/');
  };

  return (
    <>
      <aside className={`${styles.dashboardSidebar} ${isOpen ? styles.open : styles.closed}`}>
        
        <div className={styles.dashboardBrand}>
          <img src={logoImage} alt="logo" className={styles.authLogoImage} />
          <img src={logoText} alt="text" className={styles.authLogoText} />
        </div>

        <p className={styles.dashboardDividerLabel}>Menu Principal</p>

        <nav className={styles.dashboardNav}>

          <NavLink
          title='accueil'
            to="/accueil"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-grid" />
            <span>Accueil</span>
          </NavLink>

          <NavLink
          title='inventaire'
            to="/inventaires"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-box-seam" />
            <span>Inventaires</span>
          </NavLink>

          <NavLink
            title='stocks actifs'
            to="/stock-actifs"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-archive" />
            <span>Stocks Actifs</span>
          </NavLink>

          <NavLink
            title='gestion des agents'
            to="/agents"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-people" />
            <span>Gestion des agents</span>
          </NavLink>

          <NavLink
          title='historique'
            to="/historique"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-clock-history" />
            <span>Historique</span>
          </NavLink>

        </nav>

        <p className={styles.dashboardDividerLabel}>Système</p>

        <nav className={styles.dashboardNavSecondary}>
          <NavLink
            title='parametres'
            to="/parametres"
            className={({ isActive }) =>
              isActive
                ? `${styles.dashboardNavLink} ${styles.active}`
                : styles.dashboardNavLink
            }
          >
            <i className="bi bi-gear" />
            <span>Paramètre</span>
          </NavLink>
        </nav>

        <div className={styles.dashboardUserCard}>
       <div className={styles.dashboardUserAvatar} onClick={() => navigate("/parametres")} >
  {user?.avatar ? (
    <img 
      src={`${BACKEND_URL}${user.avatar}`} 
      alt="Avatar" 
    />
  ) : (
    <div className={styles.avatarInitials}>
      {user?.nom && user?.prenom 
        ? `${user.nom.charAt(0).toUpperCase()}${user.prenom.charAt(0).toUpperCase()}` 
        : '??'}
    </div>
  )}
</div>

          <div className={styles.dashboardUserInfo}>
            <p className={styles.dashboardUserName}>
              {user ? `${user.nom} ${user.prenom}` : 'Utilisateur'}
            </p>
            <p className={styles.dashboardUserRole}>
              Administrateur Système
            </p>
          </div>
        </div>

        <button className={styles.dashboardLogout} onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
          <span> Déconnexion</span>
        </button>

      </aside>
    </>
  );
};

export default Sidebar;