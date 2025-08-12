
import React from 'react';
import { ChatProvider } from '../context/ChatContext';
import { NotificationProvider } from '../context/NotificationContext';
import { Sidebar } from '../components/Sidebar';
import { ChatView } from '../components/ChatView';
import { NotificationContainer } from '../components/NotificationContainer';
import '../styles/main.css';

const Index: React.FC = () => {
  return (
    <NotificationProvider>
      <ChatProvider>
        <div className="app">
          <Sidebar />
          <div className="main-content">
            <ChatView />
          </div>
          <NotificationContainer />
        </div>
      </ChatProvider>
    </NotificationProvider>
  );
};

export default Index;
