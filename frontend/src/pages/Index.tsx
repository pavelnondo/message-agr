
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatView } from '../components/ChatView';
import { useChat } from '../context/ChatContext';
import { useNotification } from '../context/NotificationContext';
import { StatsModal } from '../components/StatsModal';

const Index: React.FC = () => {
  const { state, actions } = useChat();
  const { showNotification } = useNotification();
  const [showStatsModal, setShowStatsModal] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    // Load initial data
    actions.loadChats().catch(() => {
      showNotification('error', 'Failed to load chats');
    });
    
    actions.loadStats().catch(() => {
      showNotification('error', 'Failed to load stats');
    });
  }, []);

  // Filter chats based on search and tags
  const filteredChats = state.chats.filter(chat => {
    const matchesSearch = chat.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chat.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => chat.tags?.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        availableTags={availableTags}
      />
      
      <div className="flex-1 flex flex-col">
        {/* Header with AI Settings button */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-foreground">Chats</h2>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={() => setShowStatsModal(true)}
          >
            ⚙️ AI Settings
          </button>
        </div>
        
        {/* Main chat area */}
        <div className="flex-1 overflow-hidden">
          <ChatView chats={filteredChats} />
        </div>
      </div>

      {showStatsModal && (
        <StatsModal onClose={() => setShowStatsModal(false)} />
      )}
    </div>
  );
};

export default Index;
