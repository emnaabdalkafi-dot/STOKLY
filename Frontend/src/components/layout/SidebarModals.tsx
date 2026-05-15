import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './layout.module.css';
import { notificationService, Notification } from '../../services/notificationService';

interface SidebarModalsProps {
  modalType: 'notifications' | 'activities' | 'alerts' | null;
  onClose: () => void;
}

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);

  if (diffInMins < 1) return "À l'instant";
  if (diffInMins < 60) return `Il y a ${diffInMins} min`;
  if (diffInHours < 24) return `Il y a ${diffInHours}h`;
  return date.toLocaleDateString();
};

const SidebarModals: React.FC<SidebarModalsProps> = ({ modalType, onClose }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (modalType === 'notifications') {
      notificationService.markAllAsRead().then(() => fetchNotifications());
    } else if (modalType === 'alerts') {
      fetchNotifications();
    } else if (modalType === 'activities') {
      fetchNotifications();
    }
  }, [modalType]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications();
      const rawData = res.data.data || [];
      const decodedData = rawData.map((n: any) => {
        let decoded = n.contenu_decoded;
        if (!decoded && typeof n.contenu === 'string' && n.contenu.startsWith('{')) {
          try {
            decoded = JSON.parse(n.contenu);
          } catch (e) {
            console.error("Parse error for notif", n.id_notification, e);
          }
        }
        return { ...n, contenu_decoded: decoded || n.contenu };
      });
      setNotifications(decodedData);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };


  if (!modalType) return null;

  const filteredNotifs = notifications.filter(n => {
    const action = n.type || n.action || n.contenu_decoded?.action || '';
    
    if (filter === 'all') return true;
    
    if (filter === 'notes') {
      return action === 'nouvelle note' || action === 'note_added' || action.includes('note');
    }
    if (filter === 'corrections') {
      return action === 'demande de correction' || action === 'correction_request' || action.includes('correction');
    }
    if (filter === 'unknown') {
      return action === 'article inconnu' || action === 'article_propose' || action.includes('inconnu');
    }
    return false;
  });

  const handleNotifClick = (notif: Notification) => {
    const action = notif.type || notif.action || notif.contenu_decoded?.action;
    const invId = notif.id_inventaire || notif.contenu_decoded?.id_inventaire || notif.contenu_decoded?.inventaire_id;
    const artId = notif.id_article || notif.contenu_decoded?.id_article || notif.contenu_decoded?.article_id;
    
    if (notif.statut === 'non lu') {
      notificationService.markAsRead(notif.id_notification).then(() => fetchNotifications());
    }

    if (action === 'agent actif' || action === 'agent_actif' || action === 'agent inactif' || action === 'agent_inactif') {
      return; // Do nothing
    }

    if ((action === 'article_propose' || action === 'article inconnu') && artId) {
      navigate(`/stock-actifs?action=details&id_article=${artId}`);
      onClose();
    } else if (action === 'inventaire depasse le date fin' || action === 'inventaire_depasse' || action === 'inventaire en cours') {
      navigate(`/inventaires?action=details&id_inventaire=${invId}`);
      onClose();
    } else if (action === 'nouvelle note' || action === 'demande de correction') {
      navigate(`/inventaires?action=notes&id_inventaire=${invId}`);
      onClose();
    } else if (invId) {
      navigate(`/inventaires?action=details&id_inventaire=${invId}`);
      onClose();
    }
  };

  const renderNotifications = () => (
    <div className={styles.detailsForm}>
      <h3 className={styles.modalTitle} ><i className="bi bi-bell text-warning" /> Notifications</h3>
      <div className={styles.detailsContainer}>
          <select className={styles.filter} value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">Toutes les notifications</option>
                <option value="notes">Notes des agents</option>
                <option value="corrections">Demandes de correction</option>
                <option value="unknown">Articles inconnus (Propositions)</option>
              </select>
        <div className={styles.scrollList}>
          {loading ? (
             <div className={styles.emptyMsg}>Chargement...</div>
          ) : filteredNotifs.length > 0 ? (
            filteredNotifs.map((notif) => (
              <div 
                key={notif.id_notification} 
                className={styles.displayItem} 
                style={{ cursor: 'pointer' }}
                onClick={() => handleNotifClick(notif)}
              >
                <div className={styles.notifTitleStrong}>
                  {notif.message || notif.contenu_decoded?.message || notif.contenu}
                </div>
                <div className={styles.notifDesc}>
                   {notif.id_article ? `ID Article: ${notif.id_article}` : (notif.contenu_decoded?.nom ? `Article: ${notif.contenu_decoded.nom}` : '')}
                </div>
                <div className={styles.notifTimeSmall}>{formatTimeAgo(notif.created_at)}</div>
              </div>
            ))
          ) : (
            <div className={styles.emptyMsg}>Aucune notification</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderActivities = () => {
    const activitiesFromNotifs = notifications.filter(n => {
      const action = n.type || n.action || n.contenu_decoded?.action;
      return action === 'agent actif' || action === 'inventaire en cours' || action === 'agent inactif';
    });
    
    return (
      <div className={styles.detailsForm}>
        <h3 className={styles.modalTitle} style={{ color: '#16a34a' }}><i className="bi bi-clock-history" /> Activités Récentes</h3>
        <div className={styles.detailsContainer}>
          <div className={styles.scrollList}>
            {loading ? (
               <div className={styles.emptyMsg}>Chargement...</div>
            ) : activitiesFromNotifs.length > 0 ? (
              activitiesFromNotifs.map((notif, idx) => (
                <div key={idx} className={`${styles.displayItem} ${styles.flexRowGap}`} onClick={() => handleNotifClick(notif)} style={{ cursor: 'pointer' }}>
                  <div className={styles.activityAvatarSmall} style={{ backgroundColor: '#f1f5f9' }}>
                    <i className={`bi ${ (notif.type || notif.action || notif.contenu_decoded?.action) === 'agent actif' ? 'bi-person-check text-success' : ((notif.type || notif.action || notif.contenu_decoded?.action) === 'agent inactif' ? 'bi-person-x text-muted' : 'bi-box-seam text-primary')}`} />
                  </div>
                  <div>
                    <div className={styles.notifTitleStrong}>{notif.message || notif.contenu_decoded?.message || notif.contenu}</div>
                    <div className={styles.notifTimeSmall}>{formatTimeAgo(notif.created_at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyMsg}>Aucune activité récente</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    const alerts = notifications.filter(n => {
      const action = n.type || n.action || n.contenu_decoded?.action;
      return action === 'article inconnu' || action === 'inventaire depasse le date fin';
    });
    return (
      <div className={styles.detailsForm}>
        <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}><i className="bi bi-exclamation-triangle" /> Alertes Critiques</h3>
        <div className={styles.detailsContainer}>
          <div className={styles.scrollList}>
            {loading ? (
              <div className={styles.emptyMsg}>Chargement...</div>
            ) : alerts.length > 0 ? (
              alerts.map((alert) => (
                <div 
                  key={alert.id_notification} 
                  className={`${styles.displayItem} ${ (alert.type || alert.action) === 'article inconnu' ? styles.alertDangerItem : styles.alertWarningItem}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleNotifClick(alert)}
                >
                  <div className={styles.alertTitleStrong}>{alert.message || alert.contenu_decoded?.message || alert.contenu}</div>
                  <div className={styles.notifTimeSmall}>{formatTimeAgo(alert.created_at)}</div>
                </div>
              ))
            ) : (
              <div className={styles.emptyMsg}>Aucune alerte critique</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalPanel}>
        <button className={styles.closeButton} onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
        <div className={styles.modalContent}>
        
          {modalType === 'notifications' && renderNotifications()}
          {modalType === 'activities' && renderActivities()}
          {modalType === 'alerts' && renderAlerts()}
        </div>
      </div>
    </div>
  );
};


export default SidebarModals;

