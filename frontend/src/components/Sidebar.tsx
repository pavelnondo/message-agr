
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

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    state.chats.forEach(chat => {
      chat.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [state.chats]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="stats-dashboard">
          <div className="stat-card">
            <span className="stat-number">{state.stats.totalChats}</span>
            <span className="stat-label">Total Chats</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{state.stats.waitingForResponse}</span>
            <span className="stat-label">Waiting</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{state.stats.aiChats}</span>
            <span className="stat-label">AI Enabled</span>
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
