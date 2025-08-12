import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { toast } = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/login', loginData);
      const { access_token, user } = response.data;
      login(access_token, user);
      toast({ title: 'Login successful', description: `Welcome back, ${user.username}!` });
      navigate('/', { replace: true });
    } catch (error: any) {
      toast({ title: 'Login failed', description: error.response?.data?.detail || 'Invalid credentials', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (registerData.password !== registerData.confirmPassword) {
      toast({ title: 'Registration failed', description: 'Passwords do not match', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    try {
      const response = await api.post('/api/auth/register', {
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
      });
      const { access_token, user } = response.data;
      login(access_token, user);
      toast({ title: 'Registration successful', description: `Welcome to ${user.tenant_id}, ${user.username}!` });
      navigate('/', { replace: true });
    } catch (error: any) {
      toast({ title: 'Registration failed', description: error.response?.data?.detail || 'Registration failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 440, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', border: '1px solid var(--border-primary)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, #00b894, #00a085)', borderRadius: 20, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'white' }}>💬</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>Message Aggregator</h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 400 }}>AI Chat Management Platform</p>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-accent)', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid var(--border-primary)' }}>
          <button type="button" onClick={() => setActiveTab('login')} style={{ flex: 1, padding: '12px 16px', background: activeTab === 'login' ? 'var(--border-focus)' : 'transparent', color: activeTab === 'login' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }}>Sign In</button>
          <button type="button" onClick={() => setActiveTab('register')} style={{ flex: 1, padding: '12px 16px', background: activeTab === 'register' ? 'var(--border-focus)' : 'transparent', color: activeTab === 'register' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }}>Register</button>
        </div>

        {activeTab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-input" placeholder="Enter your username" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Enter your password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '14px 20px', background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #00b894, #00a085)', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxShadow: isLoading ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.1)' }}>{isLoading ? 'Signing in...' : 'Sign In'}</button>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-input" placeholder="Choose a username" value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="Enter your email" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Choose a password" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" placeholder="Confirm your password" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} required style={{ fontSize: 16 }} />
            </div>
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '14px 20px', background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #00b894, #00a085)', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxShadow: isLoading ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.1)' }}>{isLoading ? 'Creating account...' : 'Create Account'}</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginForm;


