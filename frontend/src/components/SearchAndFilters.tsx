
import React from 'react';
import { useChat } from '../context/ChatContext';

interface SearchAndFiltersProps {
  availableTags: string[];
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({ availableTags }) => {
  const { state, actions } = useChat();

  const handleTagToggle = (tag: string) => {
    const newSelectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter(t => t !== tag)
      : [...state.selectedTags, tag];
    
    actions.setSelectedTags(newSelectedTags);
  };

  return (
    <div className="search-section">
      <input
        type="text"
        className="search-input"
        placeholder="Search chats..."
        value={state.searchTerm}
        onChange={(e) => actions.setSearchTerm(e.target.value)}
      />
      
      {availableTags.length > 0 && (
        <div className="tag-filters">
          {availableTags.map(tag => (
            <button
              key={tag}
              className={`tag-filter ${
                state.selectedTags.includes(tag) ? 'active' : ''
              }`}
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
