
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import * as api from '../api/api';

interface StatsModalProps {
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const { showNotification } = useNotification();
  const [systemMessage, setSystemMessage] = useState('');
  const [faqs, setFaqs] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const settings = await api.getAISettings();
      setSystemMessage((settings.system_message as string) || '');
      setFaqs((settings.faqs as string) || '');
    } catch (error) {
      showNotification('error', 'Failed to load AI settings');
      console.error('Error loading AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.saveAISettings({
        system_message: systemMessage,
        faqs: faqs
      });
      showNotification('success', 'AI settings saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save AI settings');
      console.error('Error saving AI settings:', error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title">AI Settings</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner">⟳</div>
              Loading...
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">System Message</label>
                <textarea
                  className="form-textarea"
                  value={systemMessage}
                  onChange={(e) => setSystemMessage(e.target.value)}
                  placeholder="Enter the system message for the AI assistant..."
                  rows={5}
                />
              </div>
              <div className="form-group">
                <label className="form-label">FAQs</label>
                <textarea
                  className="form-textarea"
                  value={faqs}
                  onChange={(e) => setFaqs(e.target.value)}
                  placeholder="Enter frequently asked questions (one per line, or markdown, etc.)"
                  rows={8}
                />
              </div>
              <button
                className="modal-button primary"
                onClick={handleSave}
              >
                Save
              </button>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="modal-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
