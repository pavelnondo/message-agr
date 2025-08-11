
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Building2 } from 'lucide-react';

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  availableTags: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  searchQuery,
  onSearchChange,
  selectedTags,
  onTagToggle,
  availableTags,
}) => {
  const { user, logout } = useAuth();
  const [showUserInfo, setShowUserInfo] = useState(false);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="w-64 bg-background border-r border-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Message Aggregator</h1>
        <p className="text-sm text-muted-foreground">AI Chat Management</p>
      </div>

      {/* User Info Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{user?.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUserInfo(!showUserInfo)}
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
        
        {showUserInfo && (
          <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
            <div className="flex items-center space-x-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Organization:</span>
              <Badge variant="secondary" className="text-xs">
                {user?.tenant_id}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {user?.email}
            </div>
            {user?.is_admin && (
              <Badge variant="default" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="p-4">
        <Input
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Tags */}
      <div className="p-4 flex-1">
        <h3 className="text-sm font-medium text-foreground mb-3">Filter by Tags</h3>
        <div className="space-y-2">
          {availableTags.map((tag) => (
            <div key={tag} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={tag}
                checked={selectedTags.includes(tag)}
                onChange={() => onTagToggle(tag)}
                className="rounded border-gray-300"
              />
              <label htmlFor={tag} className="text-sm text-foreground cursor-pointer">
                {tag}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};
