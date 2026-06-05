import { useState, useEffect, useCallback } from 'react';
import styles from './layout.module.css';
import SidebarModals from './SidebarModals';
import { notificationService, Notification } from '../../services/notificationService';
import echo from '../../services/echo';

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

const getNotificationIcon = (action?: string) => {
  const type = (action || '').toLowerCase();
  if ( type.includes('article inconnu')) return 'bi-exclamation-triangle-fill';
  if (type.includes('demande de correction')) return 'bi-pencil-square';
  if (type.includes('nouvelle note')) return 'bi-chat-left-text';
  if (type.includes('inventaire depasse le date fin')) return 'bi-box-seam';
    if (type.includes('inventaire en cours')) return 'bi-box-seam';
  if (type.includes('agent actif')) return 'bi-person-check';
  if (type.includes('agent inactif')) return 'bi-person-x';
  return 'bi-bell-fill';
};

interface SidebarRightProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

import { useNavigate } from 'react-router-dom';

function SidebarRight({ isOpen = true, onToggle }: SidebarRightProps) {
  const navigate = useNavigate();
  const [modalType, setModalType] = useState<'notifications' | 'activities' | 'alerts' | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);



  const handleAlertClick = (notif: any) => {
    // Priority: Structured columns -> decoded JSON -> raw JSON
    const action = notif.type || notif.action || notif.contenu_decoded?.action;
    const invId = notif.id_inventaire || notif.contenu_decoded?.id_inventaire || notif.contenu_decoded?.inventaire_id;
    const artId = notif.id_article || notif.contenu_decoded?.id_article || notif.contenu_decoded?.article_id;

    if (notif.statut === 'non lu') {
      notificationService.markAsRead(notif.id_notification).then(() => fetchNotifications());
    }

    if (action === 'agent actif' || action === 'agent_actif' || action === 'agent inactif' || action === 'agent_inactif') {
      return; // Do nothing
    }

    if ((action === 'article' || action === 'article_propose' || action === 'article inconnu') && artId) {
      navigate(`/stock-actifs?action=details&id_article=${artId}`);
    } else if (action === 'inventaire depasse le date fin' || action === 'inventaire_depasse' || action === 'inventaire en cours') {
      navigate(`/inventaires?action=details&id_inventaire=${invId}`);
    } else if (action === 'demande de correction') {
      navigate(`/inventaires?action=correctionRequests`);
    } else if (action === 'nouvelle note') {
      navigate(`/inventaires?action=notes&id_inventaire=${invId}`);
    } else if (invId) {
      navigate(`/inventaires?action=details&id_inventaire=${invId}`);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount()
      ]);

      const rawNotifs = notifsRes.data.data || [];
      const decodedNotifs = rawNotifs.map((n: any) => {
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

      setNotifications(decodedNotifs);
      setUnreadCount(countRes.data.count);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Global notifications channel
    const globalChannel = echo.channel('notifications');
    globalChannel.listen('.notification.created', (e: any) => {
      const senderId = e.notification?.id_user;
      if (String(senderId) !== String(currentUser.id)) {
        fetchNotifications();
      }
    });

    // Admin-only private channel
    let adminChannel: any = null;
    if (currentUser.role === 'admin') {
      adminChannel = echo.private('admin');
      adminChannel.listen('.article.propose', () => fetchNotifications());
      adminChannel.listen('.note.added', () => fetchNotifications());
      adminChannel.listen('.agent.status.updated', () => fetchNotifications());
    }

    return () => {
      globalChannel.stopListening('.notification.created');
      if (adminChannel) {
        adminChannel.stopListening('.article.propose');
        adminChannel.stopListening('.note.added');
        adminChannel.stopListening('.agent.status.updated');
      }
    };
  }, [fetchNotifications]);


  return (
    <>
      <div className={`${styles.sidebarRight} ${isOpen ? styles.openRight : styles.closedRight}`}>
        <button
          type="button"
          className={styles.sidebarRightToggle}
          onClick={onToggle}
          aria-label="Close sidebar"
        >
          <i className={`bi bi-layout-sidebar${isOpen ? '-inset' : ''} `} />
        </button>
        <div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader} onClick={() => setModalType('notifications')} >
              <h4 className={styles.sidebarTitle} style={{ color: '#D99A37' }} >
                <i className="bi bi-bell text-warning" />
                <span  >Notifications</span>
                {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
              </h4>
              <button className={styles.notificationButton} ><i className="bi bi-chevron-right" /></button>
            </div>

            <div className={styles.Content}>
  {notifications
    .filter(n => {
      const action = (
        n.type ||
        n.action ||
        n.contenu_decoded?.action ||
        ''
      ).toLowerCase();

      return !(
        action.includes('agent actif') ||
        action.includes('agent inactif') 
      );
    }).length > 0 ? (

    notifications
      .filter(n => {
        const action = (
          n.type ||
          n.action ||
          n.contenu_decoded?.action ||
          ''
        ).toLowerCase();

        return !(
          action.includes('agent actif') ||
          action.includes('agent inactif')
        );
      })
      .slice(0, 20)
      .map((notif) => (
        <div
          key={notif.id_notification}
          className={styles.notificationItem}
          onClick={() => handleAlertClick(notif)}
        >
          <div className={styles.notifTitle} title={notif.contenu_decoded?.message || notif.contenu}>
            <i
              style={{ color: '#D99A37' }}
              className={`bi ${getNotificationIcon(
                notif.type ||
                notif.action ||
                notif.contenu_decoded?.action
              )}`}
            />

            {notif.contenu_decoded?.message?.length > 25
              ? notif.contenu_decoded.message.substring(0, 25) + '...'
              : notif.contenu}
          </div>

          <span className={styles.notifTime}>
            {formatTimeAgo(notif.created_at)}
          </span>
        </div>
      ))

  ) : (
    <div className={styles.notificationItem}>
      <div
        className={styles.notifTitle}
        style={{ color: '#94a3b8' }}
      >
        Aucune notification
      </div>
    </div>
  )}
</div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader} onClick={() => setModalType('activities')} >
              <h4 className={styles.sidebarTitle} style={{ color: '#16a34a' }}>
                <i className="bi bi-clock-history" />
                <span>Activités Récentes</span>
              </h4>
              <button className={styles.notificationButton} ><i className="bi bi-chevron-right" /></button>
            </div>
            <div className={styles.Content}>


              {notifications
                .filter(n => {
                  const action = n.type || n.action || n.contenu_decoded?.action || '';
                  return action.includes('agent actif') || 
                    action.includes('en cours')  ||
                    action.includes('agent inactif')  ;
                })
                .slice(0, 20)
                .map((notif, idx) => (
                  <div key={idx} className={styles.activityItem} onClick={() => handleAlertClick(notif)} style={{ cursor: 'pointer' }}>

                    <div>

                      <p className={styles.activityText} title={notif.contenu_decoded?.message || notif.contenu}>                      <i className={`bi ${getNotificationIcon(notif.type || notif.action || notif.contenu_decoded?.action)}`} style={{ color: '#16a34a' }} />
{notif.message && notif.message.length > 30 ? notif.message.substring(0, 30) + '...' : notif.message || (notif.contenu_decoded?.message && notif.contenu_decoded?.message.length > 20 ? notif.contenu_decoded?.message.substring(0, 20) + '...' : notif.contenu_decoded?.message) || notif.contenu.length > 30 ? notif.contenu.substring(0, 30) + '...' : notif.contenu}</p>
                      <span className={styles.notifTime}>{formatTimeAgo(notif.created_at)}</span>
                    </div>
                  </div>

                ))
              }
              {notifications.filter(n => {
                const action = n.type || n.action || n.contenu_decoded?.action || '';
                return action.includes('agent actif') || action.includes('agent_actif') ||
                  action.includes('en cours') || action.includes('en_cours') ||
                  action.includes('agent inactif') || action.includes('agent_inactif');
              }).length === 0 && (
                  <div className={styles.notifTitle} style={{ fontWeight: 400, color: '#94a3b8', padding: '10px' }}>Aucune activité récente</div>
                )}
            </div>
          </div>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarHeader} onClick={() => setModalType('alerts')}>
              <h4 className={styles.sidebarTitle} style={{ color: '#ef4444' }}>
                <i className="bi bi-exclamation-circle" />
                <span>Alertes critiques</span>
              </h4>
              <button className={styles.notificationButton} ><i className="bi bi-chevron-right" /></button>
            </div>
            <div className={styles.Content} >
              <div className={styles.notificationItem}>
                {notifications
                  .filter(n => {
                    const action = n.type || n.action || n.contenu_decoded?.action;
                    return action === 'article' || action === 'article inconnu' || action === 'inventaire depasse le date fin';
                  })
                  .slice(0, 20)
                  .map((notif, idx) => (
                    <div
                      className={styles.alertCritique}
                      key={idx}
                      onClick={() => handleAlertClick(notif)}
                    >
                      <p title={notif.contenu_decoded?.message || notif.contenu}> <i className={`bi ${getNotificationIcon(notif.type || notif.action || notif.contenu_decoded?.action)}`} style={{ color: '#ef4444' }} /> {notif.message && notif.message.length > 25 ? notif.message.substring(0, 25) + '...' : notif.message || (notif.contenu_decoded?.message && notif.contenu_decoded?.message.length > 25 ? notif.contenu_decoded?.message.substring(0, 25) + '...' : notif.contenu_decoded?.message) || notif.contenu.length > 25 ? notif.contenu.substring(0, 25) + '...' : notif.contenu}</p>
                      <span className={styles.notifTime}>{formatTimeAgo(notif.created_at)}</span>
                    </div>
                  ))
                }
                {notifications.filter(n => {
                  const action = n.type || n.action || '';
                  return action.includes('inconnu') || action.includes('propose') ||
                    action.includes('depasse');
                }).length === 0 && (
                    <div className={styles.notifTitle} style={{ fontWeight: 400, color: '#94a3b8', padding: '10px' }}>Aucune alerte critique</div>
                  )}
              </div>
            </div>
          </div>



        </div>
      </div>
      <SidebarModals modalType={modalType} onClose={() => setModalType(null)} />
    </>
  );
}


export default SidebarRight;
