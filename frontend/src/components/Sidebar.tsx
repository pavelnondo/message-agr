
import React, { useEffect, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';
import { ChatList } from './ChatList';
import { SearchAndFilters } from './SearchAndFilters';
import { StatsModal } from './StatsModal';
import { ThemeToggle } from './ThemeToggle';

export const Sidebar: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();
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
