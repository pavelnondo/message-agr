import { useMemo, useState } from "react";
import { Send, Paperclip, MoreVertical, Archive, Trash2, X, Menu, Bot, BotOff, Check, CheckCheck, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlatformIcon } from "./PlatformIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { Chat } from "./MessengerApp";
import { sendMessage as sendMessageApi } from "@/api/api";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  isRead: boolean;
  platform: 'whatsapp' | 'telegram' | 'vk' | 'instagram';
}

interface MessageViewProps {
  selectedChat: Chat | null;
  onToggleChatList: () => void;
  isChatListOpen: boolean;
  onUpdateTags: (chatId: string, tags: string[]) => void;
  onArchiveChat: (chatId: string) => void;
  onUnarchiveChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onCloseChat: () => void;
  onBlockChat: (chatId: string) => void;
  onUnblockChat: (chatId: string) => void;
  onToggleChatStatus: (chatId: string) => void;
  messages?: Message[];
  onMessageSent?: (chatId: string, message: Message) => void;
}


// Mock messages - fallback when API not available
const mockMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      content: "Hey, are you available for a quick call?",
      timestamp: "14:32",
      isOutgoing: false,
      isRead: true,
      platform: "whatsapp"
    },
    {
      id: "m2", 
      content: "Sure! I'm available now. What would you like to discuss?",
      timestamp: "14:35",
      isOutgoing: true,
      isRead: true,
      platform: "whatsapp"
    },
    {
      id: "m3",
      content: "Great! I wanted to talk about the project timeline and get your thoughts on the next steps.",
      timestamp: "14:36",
      isOutgoing: false,
      isRead: false,
      platform: "whatsapp"
    }
  ],
  "2": [
    {
      id: "m4",
      content: "Thanks for the quick response! I'll get back to you with the details.",
      timestamp: "13:45",
      isOutgoing: false,
      isRead: true,
      platform: "telegram"
    },
    {
      id: "m5",
      content: "Perfect! Take your time. I'll be here when you're ready.",
      timestamp: "13:46",
      isOutgoing: true,
      isRead: true,
      platform: "telegram"
    }
  ]
};

export function MessageView({ selectedChat, onToggleChatList, isChatListOpen, onUpdateTags, onArchiveChat, onUnarchiveChat, onDeleteChat, onCloseChat, onBlockChat, onUnblockChat, onToggleChatStatus, messages: externalMessages, onMessageSent }: MessageViewProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [isAIEnabled, setIsAIEnabled] = useState(selectedChat?.isAI || false);
  const [newTag, setNewTag] = useState("");
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  // Debug log to check chat status
  console.log("Selected chat:", selectedChat?.contactName, "isOngoing:", selectedChat?.isOngoing);

  const messages = useMemo(() => {
    if (!selectedChat) return [] as Message[];
    if (externalMessages && externalMessages.length > 0) return externalMessages;
    return mockMessages[selectedChat.id] || [];
  }, [selectedChat, externalMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    try {
      const tenantId = user?.tenant_id || 'default';
      await sendMessageApi(selectedChat.id, messageText, 'answer', tenantId);
      const optimistic: Message = {
        id: `${Date.now()}`,
        content: messageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOutgoing: true,
        isRead: false,
        platform: selectedChat.platform,
      };
      onMessageSent && onMessageSent(selectedChat.id, optimistic);
    } finally {
      setMessageText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim() || !selectedChat) return;
    
    const updatedTags = [...selectedChat.tags, newTag.trim()];
    onUpdateTags(selectedChat.id, updatedTags);
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedChat) return;
    
    const updatedTags = selectedChat.tags.filter(tag => tag !== tagToRemove);
    onUpdateTags(selectedChat.id, updatedTags);
  };

  if (!selectedChat) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center px-4 bg-card">
          {!isChatListOpen && (
            <Button variant="ghost" size="sm" onClick={onToggleChatList} className="mr-2">
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 text-center text-muted-foreground">
            {t('select_conversation')}
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div className="max-w-md">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('no_conversation')}</h3>
            <p className="text-muted-foreground">
              {t('choose_conversation')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-3">
          {!isChatListOpen && (
            <Button variant="ghost" size="sm" onClick={onToggleChatList}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
          
          {/* Platform Avatar */}
          <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center bg-card">
            <PlatformIcon platform={selectedChat.platform} className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{selectedChat.contactName}</h2>
              {selectedChat.isAI && (
                <Bot className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-online" />
              <span>{t('online')}</span>
              <span className="text-xs">({selectedChat.isOngoing ? 'ongoing' : 'closed'})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Toggle - Only show for non-blocked chats */}
          {!selectedChat?.isBlocked && (
            <Button
              variant={isAIEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAIEnabled(!isAIEnabled)}
              className="gap-2"
            >
              {isAIEnabled ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
              {isAIEnabled ? t('ai_on') : t('ai_off')}
            </Button>
          )}

          {/* Action Buttons - Only show for non-blocked chats */}
          {!selectedChat?.isBlocked && (
            <>
              {selectedChat?.isArchived ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => selectedChat && onUnarchiveChat(selectedChat.id)}
                  title="Unarchive chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => selectedChat && onArchiveChat(selectedChat.id)}
                  title="Archive chat"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" title={t('delete_chat')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('delete_confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('delete_confirm_description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => selectedChat && onDeleteChat(selectedChat.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" onClick={onCloseChat} title={t('close_chat')}>
                <X className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" title="More options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setShowBlockConfirm(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    {t('block_chat')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => selectedChat && onToggleChatStatus(selectedChat.id)}
                  >
                    {selectedChat?.isOngoing ? t('close_chat') : t('activate_chat')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Unblock Button - Only show for blocked chats */}
          {selectedChat?.isBlocked && (
            <Button
              variant="default"
              size="sm"
              onClick={() => selectedChat && onUnblockChat(selectedChat.id)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <RotateCcw className="h-4 w-4" />
              {t('unblock_chat')}
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background to-muted/20">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.isOutgoing ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                message.isOutgoing
                  ? "bg-message-sent text-message-sent-foreground rounded-br-sm"
                  : "bg-message-received text-message-received-foreground rounded-bl-sm border"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div className={cn(
                "flex items-center gap-1 mt-1 text-xs",
                message.isOutgoing 
                  ? "text-message-sent-foreground/70 justify-end" 
                  : "text-message-received-foreground/70"
              )}>
                <span>{message.timestamp}</span>
                {message.isOutgoing && (
                  message.isRead ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        <div className="flex justify-start">
          <div className="bg-message-received text-message-received-foreground rounded-2xl rounded-bl-sm px-4 py-2 border">
            <div className="flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-muted-foreground ml-2">{t('typing')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-card">
        {/* Current Tags */}
        {selectedChat && selectedChat.tags.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {selectedChat.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
        )}
        
        {/* Tag Adder */}
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder={t('new_tag')}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" className="h-10">
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <div className="flex-1">
            <Textarea
              placeholder={t('message_placeholder')}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="min-h-[40px] max-h-32 resize-none"
            />
          </div>
          
          <Button 
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className="h-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Block Confirmation Dialog */}
      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('block_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('block_confirm_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (selectedChat) {
                  onBlockChat(selectedChat.id);
                  setShowBlockConfirm(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('block')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}