
import React, { useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';

export const ChatList: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();

  const filteredChats = useMemo(() => {
    let filtered = state.chats;

    // Filter by search term using available fields
    if (state.searchTerm) {
      const term = state.searchTerm.toLowerCase();
      filtered = filtered.filter(chat => {
        const name = (chat.user_id || '').toLowerCase();
        const preview = (chat.last_message?.message || '').toLowerCase();
        return name.includes(term) || preview.includes(term);
      });
    }

    // Sort by last message time if available, otherwise by updated_at
    return [...filtered].sort((a, b) => {
      const aTime = a.last_message?.created_at || a.updated_at || a.created_at;
      const bTime = b.last_message?.created_at || b.updated_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [state.chats, state.searchTerm]);

  const handleChatSelect = async (chatId: string) => {
    try {
      await actions.selectChat(chatId);
    } catch (error) {
      showNotification('error', 'Failed to load chat');
    }
  };

  const handleAIToggle = async (chatId: string, currentAIStatus: boolean) => {
    try {
      await actions.updateChat(chatId, { 
        ai_enabled: !currentAIStatus,
        is_awaiting_manager_confirmation: !currentAIStatus 
      });
      showNotification('success', `AI ${!currentAIStatus ? 'enabled' : 'disabled'} for this chat`);
    } catch (error) {
      showNotification('error', 'Failed to toggle AI status');
    }
  };

  const formatTime = (timestampIso: string) => {
    const ts = new Date(timestampIso);
    const now = new Date();
    const diff = now.getTime() - ts.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (state.loading && state.chats.length === 0) {
    return (
      <div className="loading">
        <div className="loading-spinner">⟳</div>
        Loading chats...
      </div>
    );
  }

  return (
    <div className="chat-list">
      {filteredChats.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-title">No chats found</div>
          <div className="empty-state-description">
            {state.searchTerm || state.selectedTags.length > 0
              ? 'Try adjusting your search or filters'
              : 'Chats will appear here when you receive messages'}
          </div>
        </div>
      ) : (
        filteredChats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === state.selectedChatId ? 'selected' : ''}`}
            onClick={() => handleChatSelect(chat.id)}
          >
            <div className="chat-header">
              <div className="chat-name">{(chat.user_id || '').split(' [')[0] || 'Unknown user'}</div>
              <div className="chat-time">{formatTime(chat.last_message?.created_at || chat.updated_at || chat.created_at)}</div>
            </div>
            <div className="chat-preview">{chat.last_message?.message || ''}</div>
            <div className="chat-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                {typeof (chat as any).message_count === 'number' ? (chat as any).message_count : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Show AI indicator only when AI is enabled */}
                {chat.ai_enabled && (
                  <div 
                    className="ai-indicator"
                    style={{ 
                      fontSize: '0.75rem', 
                      color: '#10b981',
                      backgroundColor: '#d1fae5',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    AI
                  </div>
                )}
                {/* Show waiting indicator when AI is disabled and waiting for manager */}
                {!chat.ai_enabled && chat.is_awaiting_manager_confirmation && (
                  <div 
                    className="waiting-indicator"
                    style={{ 
                      fontSize: '0.75rem', 
                      color: '#f59e0b',
                      backgroundColor: '#fef3c7',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    WAITING
                  </div>
                )}
                {/* AI Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAIToggle(chat.id, chat.ai_enabled);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    backgroundColor: chat.ai_enabled ? '#10b981' : '#6b7280',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {chat.ai_enabled ? 'AI ON' : 'AI OFF'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
