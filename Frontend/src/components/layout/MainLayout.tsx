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

    channel.listen('.article.propose', (e: any) => {
      if (e.id_agent === currentUser.id) return; // Skip self
      setToast({ 
        message: e.message || `Nouvel article proposé: ${e.nom}`, 
        type: 'article',
        inventoryId: e.inventaire_id,
        articleId: e.article_id
      });
    });

    channel.listen('.note.added', (e: any) => {
      if (e.user?.id === currentUser.id) return; // Skip self
      setToast({ 
        message: `Nouvelle note: ${e.contenu.substring(0, 50)}...`, 
        type: 'note',
        inventoryId: e.id_inventaire 
      });
    });

    channel.listen('.agent.status.updated', (e: any) => {
      setToast({ 
        message: `Alerte: Un agent est devenu inactif sur l'inventaire ${e.titre}`, 
        type: 'alert',
        inventoryId: e.inventaire_id 
      });
    });

    return () => {
      channel.stopListening('.article.propose');
      channel.stopListening('.note.added');
      channel.stopListening('.agent.status.updated');
    };
  }, []);

  const handleToastClick = () => {
    if (toast?.type === 'article' && toast.articleId) {
      navigate(`/stock-actifs?action=details&id_article=${toast.articleId}`);
      setToast(null);
    } else if (toast?.inventoryId) {
      navigate(`/inventaires?action=notes&id_inventaire=${toast.inventoryId}`);
      setToast(null);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 12000); // Increased to 12s
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
          className={`${styles.alertBox} ${toast.type === 'article' ? styles.alertBoxRed : styles.alertBoxGreen}`} 
          style={{ 
            position: 'fixed',
            top: '20px', 
            right: '20px', 
            bottom: 'auto', 
            left: 'auto',
            animation: 'slideInRight 0.5s ease-out forwards',
            zIndex: 9999,
            cursor: 'pointer',
            maxWidth: '350px'
          }}
          onClick={handleToastClick}
        >
          <i className={`bi bi-x ${styles.alertClose}`} onClick={(e) => { e.stopPropagation(); setToast(null); }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              backgroundColor: toast.type === 'article' ? '#ef4444' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <i className={`bi ${toast.type === 'article' ? 'bi-exclamation-triangle' : 'bi-chat-dots'}`} style={{ color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                {toast.type === 'article' ? 'Alerte Critique' : 'Nouvelle Communication'}
              </h5>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#4b5563' }}>{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MainLayout