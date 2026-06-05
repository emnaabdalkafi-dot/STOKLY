import SidebarLeft from './SidebarLeft'
import SidebarRight from './SidebarRight'
import styles from './layout.module.css'
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from './Navbar';
import { useTheme } from '../../hooks/useTheme';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import echo from '../../services/echo';

function MainLayout() {
  const [toast, setToast] = useState<{ message: string; type: string; inventoryId?: number; articleId?: number } | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const channel = echo.private('admin');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    channel.listen('.notification.created', (e: any) => {
      const notif = e.notification;
      if (!notif) return;
      
      const type = notif.type;
      
      // We only show alerts for specific types requested by the user
      const alertTypes = ['article', 'article inconnu', 'demande de correction', 'nouvelle note', 'inventaire en cours', 'inventaire depasse le date fin'];
      
      if (alertTypes.includes(type)) {
        // Exclude our own notes
        if (type === 'nouvelle note' && notif.note?.id_user === currentUser.id) return;
        
        let toastType = 'info';
        if (type === 'article' || type === 'article inconnu' || type === 'inventaire depasse le date fin') toastType = 'danger';
        else if (type === 'demande de correction') toastType = 'warning';
        else if (type === 'inventaire en cours') toastType = 'success';
        
        setToast({
          message: notif.contenu || type,
          type: toastType,
          inventoryId: notif.id_inventaire,
          articleId: notif.id_article
        });
      }
    });

    return () => {
      channel.stopListening('.notification.created');
    };
  }, []);

  const handleToastClick = () => {
    if ((toast?.type === 'danger' || toast?.type === 'article') && toast?.articleId) {
      navigate(`/stock-actifs?action=details&id_article=${toast.articleId}`);
      setToast(null);
    } else if (toast?.type === 'warning' && toast?.inventoryId) {
      navigate(`/inventaires?action=correctionRequests`);
      setToast(null);
    } else if (toast?.inventoryId) {
      navigate(`/inventaires?action=notes&id_inventaire=${toast.inventoryId}`);
      setToast(null);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 12000);  
      return () => clearTimeout(timer);
    }
  }, [toast]);

const location = useLocation()
const getBreadcrumb = () => {
  switch (location.pathname) {
    case '/accueil':
      return 'Accueil'
    case '/agents':
      return 'Gestion des agents'
       case '/stock-actifs':
      return 'Gestion des stocks'
       case '/inventaires':
      return 'Gestion des inventaires'
    case '/parametres':
      return 'Paramètres'
       case '/historique':
      return 'Historique'
    default:
      return 'Dashboard'
  }
}
  // Initialize from localStorage with fallback to true
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [sidebarRightOpen, setSidebarRightOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarRightOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const handleToggleSidebar = () => {
    setSidebarOpen((prev: boolean) => {
      const newState = !prev;
      localStorage.setItem('sidebarOpen', JSON.stringify(newState));
      return newState;
    });
  }

  const handleToggleSidebarRight = () => {
    setSidebarRightOpen((prev: boolean) => {
      const newState = !prev;
      localStorage.setItem('sidebarRightOpen', JSON.stringify(newState));
      return newState;
    });
  }

  const { darkMode, toggleTheme } = useTheme();
  return (
    <div className={styles.layout}>
      <SidebarLeft isOpen={sidebarOpen} />
      
      <div className={styles.mainContent}>
         <Navbar
          breadcrumb={`Dashboard / ${getBreadcrumb()}`}
          sidebarOpen={sidebarOpen}
          sidebarRightOpen={sidebarRightOpen}
          onToggleSidebar={handleToggleSidebar}
          onToggleSidebarRight={handleToggleSidebarRight}
          onToggleTheme={toggleTheme}
          isDarkMode={darkMode}
        />
        <div className={styles.pageContent}>
          <Outlet /> 
        </div>
      </div>

      <SidebarRight isOpen={sidebarRightOpen} onToggle={handleToggleSidebarRight} />

      {toast && (
          <div 
          className={`${styles.toastBox} ${toast.type === 'danger' ? styles.alertBoxRed : styles.alertBoxGreen}`} 
          
          onClick={handleToastClick}
        >
          <i className={`bi bi-x ${styles.alertClose}`} onClick={(e) => { e.stopPropagation(); setToast(null); }} />
          <div >
            <div className={styles.toastTitle}>
              <i className={`bi ${toast.type === 'danger' ? 'bi-exclamation-triangle' : 'bi-chat-dots'}`} style={{ color: 'white' }} />
               {toast.type === 'danger' ? 'Alerte Critique' : 'Nouvelle Communication'}

            </div>
            <div style={{ flex: 1 }}>
              <p className={styles.toastDesc}>{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MainLayout