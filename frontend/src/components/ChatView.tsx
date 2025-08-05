
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';
import { TagEditor } from './TagEditor';
import { ConfirmDialog } from './ConfirmDialog';

// Styles for sender tags
const senderTagStyles = `
  .sender-tag {
    display: inline-block;
    background: #3b82f6;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sender-tag:empty {
    display: none;
  }

  .message.ai .sender-tag {
    background: #10b981;
  }

  .message.operator .sender-tag {
    display: none;
  }

  .ai-control-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ai-auto-activation-status {
    font-size: 0.75rem;
    color: #f59e0b;
    background: #fef3c7;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }
`;

interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface ReplyMessage {
  id: string;
  content: string;
  sender: string;
}

export const ChatView: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();
  const [messageInput, setMessageInput] = useState('');
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedChat = state.chats.find(chat => chat.id === state.selectedChatId);
  
  const filteredMessages = state.messages.filter(message => {
    if (!message || !message.content) return false;
    return message.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Improved scroll behavior - DISABLED to prevent reloads
  // useEffect(() => {
  //   if (messagesEndRef.current) {
  //     messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  //   }
  // }, [state.messages]);

  // Auto-scroll to bottom when new messages arrive - DISABLED to prevent reloads
  // useEffect(() => {
  //   const container = messagesContainerRef.current;
  //   if (container) {
  //     const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
  //     if (isAtBottom) {
  //       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  //     }
  //   }
  // }, [filteredMessages]);

  // Handle scroll events to show/hide scroll button
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      setShowScrollButton(!isAtBottom);
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChat) return;

    try {
      await actions.sendMessage(messageInput.trim());
      setMessageInput('');
      setReplyTo(null);
      showNotification('success', 'Message sent');
    } catch (error) {
      showNotification('error', 'Failed to send message');
    }
  };

  const handleToggleAI = async () => {
    if (!selectedChat) return;
    
    try {
      await actions.toggleAI(selectedChat.id, !selectedChat.aiEnabled);
      showNotification('success', `AI Assistant ${selectedChat.aiEnabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      showNotification('error', 'Failed to toggle AI Assistant');
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    
    try {
      await actions.deleteChat(selectedChat.id);
      setShowDeleteConfirm(false);
      showNotification('success', 'Chat deleted successfully');
    } catch (error) {
      showNotification('error', 'Failed to delete chat');
    }
  };

  const handleTagsUpdate = async (tags: string[]) => {
    if (!selectedChat) return;
    
    try {
      await actions.updateChatTags(selectedChat.id, tags);
      setShowTagEditor(false);
      showNotification('success', 'Tags updated successfully');
    } catch (error) {
      showNotification('error', 'Failed to update tags');
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatTime(timestamp);
  };

  const getMessageSenderDisplay = (sender: string) => {
    if (!sender) return 'Unknown';
    switch (sender) {
      case 'user': return 'You';
      case 'ai': return 'AI Assistant';
      case 'operator': return 'Manager';
      case 'client': return 'Client'; // This will show the user's name from Telegram
      default: return sender.charAt(0).toUpperCase() + sender.slice(1);
    }
  };

  const getSenderIcon = (sender: string) => {
    switch (sender) {
      case 'user': return '👤';
      case 'ai': return '🤖';
      case 'operator': return '👨‍💼';
      case 'client': return '💬';
      default: return '��';
    }
  };

  // Get message sender tag for display - AI tag only shows for AI messages
  const getMessageSenderTag = (sender: string) => {
    switch (sender) {
      case 'ai': return 'AI';
      case 'operator': return ''; // No tag for manager messages
      case 'user': return ''; // No tag for user messages
      case 'client': return ''; // No tag for client messages - will show user name instead
      default: return '';
    }
  };

  // Fixed message alignment: client messages on left, all others on right
  const getMessageClass = (sender: string) => {
    switch (sender) {
      case 'client':
        return 'message client'; // Left side (Telegram messages)
      case 'user':
      case 'ai':
      case 'operator':
        return `message ${sender}`; // Right side (our responses)
      default:
        return 'message';
    }
  };

  // Message actions
  const handleReply = (message: any) => {
    setReplyTo({
      id: message.id,
      content: message.content,
      sender: message.sender
    });
    inputRef.current?.focus();
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    showNotification('success', 'Message copied to clipboard');
  };

  const handleReaction = (messageId: string, emoji: string) => {
    // TODO: Implement reaction logic
    showNotification('success', `Reacted with ${emoji}`);
  };

  const handleEditMessage = (messageId: string) => {
    // TODO: Implement edit functionality
    showNotification('info', 'Edit functionality coming soon');
  };

  const handleDeleteMessage = (messageId: string) => {
    // TODO: Implement delete functionality
    showNotification('info', 'Delete functionality coming soon');
  };

  const handlePinMessage = (messageId: string) => {
    setPinnedMessages(prev => 
      prev.includes(messageId) 
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
    showNotification('success', 'Message pinned');
  };

  const handleUnpinMessage = (messageId: string) => {
    setPinnedMessages(prev => prev.filter(id => id !== messageId));
    showNotification('success', 'Message unpinned');
  };

  const highlightSearchText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} className="search-highlight">{part}</mark> : part
    );
  };

  const emojiReactions = ['👍', '❤️', '😮', '😢', '😡', '🎉'];

  // Inject styles for sender tags
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = senderTagStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Auto-activation countdown timer - DISABLED to prevent reloads
  const [countdown, setCountdown] = useState<number>(0);
  
  // useEffect(() => {
  //   if (state.lastManagerMessageTime && !selectedChat?.aiEnabled) {
  //     const timer = setInterval(() => {
  //       const remaining = Math.max(0, Math.ceil((300000 - (Date.now() - state.lastManagerMessageTime!)) / 1000 / 60));
  //       setCountdown(remaining);
  //       
  //       if (remaining <= 0) {
  //           clearInterval(timer);
  //       }
  //     }, 1000);

  //     return () => clearInterval(timer);
  //   } else {
  //     setCountdown(0);
  //   }
  // }, [state.lastManagerMessageTime, selectedChat?.aiEnabled]);

  if (!selectedChat) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <div className="empty-state-title">Select a chat to start messaging</div>
        <div className="empty-state-description">
          Choose a conversation from the sidebar to view and send messages
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <div>
          <div className="chat-title">{selectedChat.name}</div>
          <div className="chat-tags">
            {selectedChat.tags.map(tag => (
              <span key={tag} className="chat-tag">
                {tag}
              </span>
            ))}
          </div>

        </div>
        <div className="chat-controls">
          <div className="ai-control-section">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={selectedChat.aiEnabled}
                onChange={handleToggleAI}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="text-sm">AI Assistant</span>
            {countdown > 0 && (
              <span className="ai-auto-activation-status">
                Auto-activating in {countdown}m
              </span>
            )}
          </div>
          <button
            className="control-button"
            onClick={() => setShowTagEditor(true)}
          >
            Edit Tags
          </button>
          <button
            className="control-button danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Chat
          </button>
        </div>
      </div>

      {state.messages.length > 0 && (
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {pinnedMessages.length > 0 && (
            <button
              className="pinned-messages-toggle"
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            >
              📌 Pinned Messages ({pinnedMessages.length})
            </button>
          )}
        </div>
      )}

      {/* Pinned messages display */}
      {showPinnedMessages && pinnedMessages.length > 0 && (
        <div className="pinned-messages">
          <div className="pinned-header">
            <span>📌 Pinned Messages</span>
            <button onClick={() => setShowPinnedMessages(false)}>×</button>
          </div>
          {filteredMessages
            .filter(message => pinnedMessages.includes(message.id))
            .map(message => (
              <div key={`pinned-${message.id}`} className="pinned-message">
                <div className="pinned-sender">{getMessageSenderDisplay(message.sender)}</div>
                <div className="pinned-content">{message.content}</div>
                <button 
                  className="unpin-button"
                  onClick={() => handleUnpinMessage(message.id)}
                >
                  📌
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {state.loading && state.messages.length === 0 ? (
          <div className="loading">
            <div className="loading-spinner">⟳</div>
            Loading messages...
          </div>
        ) : state.messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💭</div>
            <div className="empty-state-title">No messages yet</div>
            <div className="empty-state-description">
              Start the conversation by sending a message below
            </div>
          </div>
        ) : (
          filteredMessages.map(message => (
            <div key={message.id} className={getMessageClass(message.sender)}>
              <div className="message-header">
                <span className="message-sender">
                  <span className="sender-icon">{getSenderIcon(message.sender)}</span>
                  {getMessageSenderDisplay(message.sender)}
                  {getMessageSenderTag(message.sender) && (
                    <span className="sender-tag">{getMessageSenderTag(message.sender)}</span>
                  )}
                </span>
                <span className="message-time" title={formatTime(message.timestamp)}>
                  {formatRelativeTime(message.timestamp)}
                </span>
              </div>
              
              <div className="message-content">
                {message.type === 'image' && message.imageUrl ? (
                  <img src={message.imageUrl} alt="Message attachment" style={{ maxWidth: '100%', borderRadius: '6px' }} />
                ) : (
                  highlightSearchText(message.content, searchQuery)
                )}
                
                {/* Message status indicators */}
                <div className="message-status">
                  <span className="status-delivered">✓</span>
                  <span className="status-read">✓</span>
                </div>
              </div>

              {/* Message actions */}
              <div className="message-actions">
                <button 
                  className="action-button"
                  onClick={() => handleReply(message)}
                  title="Reply"
                >
                  ↺
                </button>
                <button 
                  className="action-button"
                  onClick={() => handleCopyMessage(message.content)}
                  title="Copy"
                >
                  📋
                </button>
                <button 
                  className={`action-button ${pinnedMessages.includes(message.id) ? 'pinned' : ''}`}
                  onClick={() => handlePinMessage(message.id)}
                  title={pinnedMessages.includes(message.id) ? 'Unpin' : 'Pin'}
                >
                  📌
                </button>
                <button 
                  className="action-button"
                  onClick={() => setSelectedMessage(selectedMessage === message.id ? null : message.id)}
                  title="More"
                >
                  ⋯
                </button>
              </div>

              {/* Expanded actions menu */}
              {selectedMessage === message.id && (
                <div className="message-actions-expanded">
                  <button onClick={() => handleEditMessage(message.id)}>Edit</button>
                  <button onClick={() => handleDeleteMessage(message.id)}>Delete</button>
                  <button onClick={() => setSelectedMessage(null)}>Cancel</button>
                </div>
              )}

              {/* Emoji reactions */}
              <div className="message-reactions">
                {emojiReactions.map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-button"
                    onClick={() => handleReaction(message.id, emoji)}
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          className="scroll-to-bottom-button"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}

      <div className="message-input-container">
        {/* Reply preview */}
        {replyTo && (
          <div className="reply-preview">
            <div className="reply-content">
              <span className="reply-label">Replying to {getMessageSenderDisplay(replyTo.sender)}:</span>
              <span className="reply-text">{replyTo.content}</span>
            </div>
            <button 
              className="reply-cancel"
              onClick={() => setReplyTo(null)}
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="message-input-form">
          <div className="input-actions">
            <button
              type="button"
              className="emoji-button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
            >
              😊
            </button>
            <button
              type="button"
              className="attachment-button"
              title="Attach file"
            >
              📎
            </button>

          </div>
          
          <textarea
            ref={inputRef}
            className="message-input"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your message..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          
          <button
            type="submit"
            className="send-button"
            disabled={!messageInput.trim()}
          >
            ➤
          </button>
        </form>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            {emojiReactions.map(emoji => (
              <button
                key={emoji}
                className="emoji-option"
                onClick={() => {
                  setMessageInput(prev => prev + emoji);
                  setShowEmojiPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {showTagEditor && (
        <TagEditor
          initialTags={selectedChat.tags}
          onSave={handleTagsUpdate}
          onClose={() => setShowTagEditor(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Chat"
          message={`Are you sure you want to delete the chat with "${selectedChat.name}"? This action cannot be undone.`}
          onConfirm={handleDeleteChat}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};
