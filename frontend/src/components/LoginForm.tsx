import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 text-2xl">💬</div>
          <CardTitle className="text-2xl">Message Aggregator</CardTitle>
          <p className="text-sm text-muted-foreground">AI Chat Management Platform</p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" placeholder="Enter your username" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Enter your password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign In'}</Button>
              </form>
            </TabsContent>
            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input id="reg-username" placeholder="Choose a username" value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" placeholder="Enter your email" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" placeholder="Choose a password" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">Confirm Password</Label>
                  <Input id="reg-confirm" type="password" placeholder="Confirm your password" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Creating account...' : 'Create Account'}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;


