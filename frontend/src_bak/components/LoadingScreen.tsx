import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{
          fontSize: '24px',
          marginBottom: '10px'
        }}>
          Loading...
        </div>
        <div style={{
          fontSize: '14px',
          color: '#666'
        }}>
          Please wait while the application initializes
        </div>
      </div>
    </div>
  );
}; 