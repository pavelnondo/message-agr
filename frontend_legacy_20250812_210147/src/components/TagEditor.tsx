
import React, { useState } from 'react';

interface TagEditorProps {
  initialTags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}

export const TagEditor: React.FC<TagEditorProps> = ({ initialTags, onSave, onClose }) => {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    onSave(tags);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Edit Tags</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="form-group">
            <label className="form-label">Current Tags</label>
            <div className="tag-filters">
              {tags.map(tag => (
                <div key={tag} className="tag-filter active">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{ marginLeft: '4px', background: 'none', border: 'none', color: 'inherit' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Add New Tag</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Enter tag name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                className="modal-button secondary"
                onClick={handleAddTag}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="modal-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button primary" onClick={handleSave}>
            Save Tags
          </button>
        </div>
      </div>
    </div>
  );
};
