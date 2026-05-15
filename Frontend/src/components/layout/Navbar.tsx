import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './layout.module.css';

interface NavbarProps {
  breadcrumb: string;
  sidebarOpen: boolean;
  sidebarRightOpen: boolean;
  onToggleSidebar: () => void;
  onToggleSidebarRight: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  breadcrumb,
  sidebarOpen,
  sidebarRightOpen,
  onToggleSidebar,
  onToggleSidebarRight,
  isDarkMode,
  onToggleTheme,
}) => {
  const navigate = useNavigate();

  return (
    <div className={styles.dashboardNavbar}>
     
      <div className={styles.dashboardNavbarLeft}>
        
          <button
            type="button"
            className={styles.dashboardMenuToggle}
            onClick={onToggleSidebar}
            aria-label="Close sidebar"
          >
             {sidebarOpen ?(
            <i className="bi bi-layout-sidebar-inset" />):(
            <i className="bi bi-layout-sidebar" /> )}
          </button>
              
        <div className={styles.dashboardBreadcrumb}>
          <span>{breadcrumb}</span>
        </div>
      </div>

      <div className={styles.dashboardNavbarRight}>
        <button
          className={styles.dashboardThemeToggle}
          onClick={onToggleTheme}
          aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          <i className={isDarkMode ? 'bi bi-moon' : 'bi bi-sun'} />
        </button>

       

        <div className={styles.dashboardNavbarActions}>
            <button 
              className={ styles.dashboardButtonSecondary} 
              onClick={() => navigate('/inventaires?action=add')}
            >
              <i className="bi bi-plus-circle"/> 
               <span>Nouvel Inventaire</span>
            </button>
             <button 
               className={ styles.dashboardButtonPrimary}
               onClick={() => navigate('/inventaires?action=addNote')}
             >
               <i className="bi bi-pencil-square" />
                <span>Ajouter Note</span>
             </button>
        </div>
 <button
          className={styles.dashboardMenuToggle}
          onClick={onToggleSidebarRight}
          aria-label="Toggle right sidebar"
        >
          {sidebarRightOpen ? (
            <i className="bi bi-layout-sidebar-inset-reverse" />
          ) : (
            <i className="bi bi-layout-sidebar-reverse" />
          )}
        </button>
        
      </div>
    </div>
  );
};

export default Navbar;
