
import React from 'react';
import { useNotification } from '../context/NotificationContext';

export const NotificationContainer: React.FC = () => {
  const { state, removeNotification } = useNotification();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="notifications-container">
      {state.notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <div className="notification-icon">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="notification-message">
            {notification.message}
          </div>
        </div>
      ))}
    </div>
  );
};
