
import React, { useEffect, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';

export const ChatList: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();

  useEffect(() => {
    actions.loadChats().catch(() => {
      showNotification('error', 'Failed to load chats');
    });
  }, []);

  const filteredChats = useMemo(() => {
    let filtered = state.chats;

    // Filter by search term
    if (state.searchTerm) {
      filtered = filtered.filter(chat =>
        chat.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(state.searchTerm.toLowerCase())
      );
    }

    // Filter by selected tags
    if (state.selectedTags.length > 0) {
      filtered = filtered.filter(chat =>
        state.selectedTags.some(tag => chat.tags.includes(tag))
      );
    }

    // Sort: waiting for response first, then by timestamp
    return filtered.sort((a, b) => {
      if (a.waitingForResponse && !b.waitingForResponse) return -1;
      if (!a.waitingForResponse && b.waitingForResponse) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [state.chats, state.searchTerm, state.selectedTags]);

  const handleChatSelect = async (chatId: string) => {
    try {
      await actions.selectChat(chatId);
    } catch (error) {
      showNotification('error', 'Failed to load chat');
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
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
            className={`chat-item ${
              chat.id === state.selectedChatId ? 'selected' : ''
            } ${chat.waitingForResponse ? 'waiting' : ''}`}
            onClick={() => handleChatSelect(chat.id)}
          >
            <div className="chat-header">
              <div className="chat-name">{chat.name}</div>
              <div className="chat-time">{formatTime(chat.timestamp)}</div>
            </div>
            <div className="chat-preview">{chat.lastMessage}</div>
            <div className="chat-meta">
              <div className="chat-tags">
                {chat.tags.map(tag => (
                  <span key={tag} className="chat-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="chat-indicators">
                {chat.aiEnabled && (
                  <div className="ai-indicator">AI</div>
                )}
                {chat.unreadCount > 0 && (
                  <div className="unread-badge">{chat.unreadCount}</div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
