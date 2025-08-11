import React, { useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { ChatList } from './ChatList';
import { SearchAndFilters } from './SearchAndFilters';
import { StatsModal } from './StatsModal';
import { ThemeToggle } from './ThemeToggle';

export const Sidebar: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();
  const { user, logout } = useAuth();
  const [showStatsModal, setShowStatsModal] = React.useState(false);

  useEffect(() => {
    // Load initial data
    actions.loadChats().catch(() => {
      showNotification('error', 'Failed to load chats');
    });
    
    actions.loadStats().catch(() => {
      showNotification('error', 'Failed to load stats');
    });
  }, []);

  // Tags are not part of the current backend schema; keep empty list
  const allTags: string[] = [];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        {/* User Info Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-accent)',
          borderBottom: '1px solid var(--border-primary)',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            fontWeight: '500'
          }}>
            <span style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #00b894, #00a085)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px'
            }}>
              {user?.username?.charAt(0).toUpperCase()}
            </span>
            <div>
              <div>{user?.username}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {user?.tenant_id} {user?.is_admin && '• Admin'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            🚪 Logout
          </button>
        </div>

        <div className="stats-dashboard">
          <div className="stat-card">
            <span className="stat-number">{state.stats.total_chats || 0}</span>
            <span className="stat-label">Total Chats</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{state.stats.total_messages || 0}</span>
            <span className="stat-label">Messages</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{state.stats.awaiting_manager_confirmation || 0}</span>
            <span className="stat-label">Awaiting Manager</span>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button
            className="settings-button"
            onClick={() => setShowStatsModal(true)}
          >
            ⚙️ AI Settings
          </button>
          <ThemeToggle />
        </div>
      </div>

      <SearchAndFilters availableTags={allTags} />
      <ChatList />

      {showStatsModal && (
        <StatsModal onClose={() => setShowStatsModal(false)} />
      )}
    </div>
  );
};