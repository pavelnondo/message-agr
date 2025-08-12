import { useEffect, useMemo, useState } from "react";
import { ChatList } from "./ChatList";
import { MessageView } from "./MessageView";
import { ContextPanel } from "./ContextPanel";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";
import * as api from "@/api/api";
import { connectMessagesWebSocket, connectChatUpdatesWebSocket } from "@/api/api";

export interface Chat {
  id: string;
  platform: 'whatsapp' | 'telegram' | 'vk' | 'instagram';
  contactName: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isAI: boolean;
  isOngoing: boolean;
  isArchived: boolean;
  isBlocked: boolean;
  tags: string[];
  avatar?: string;
}

// Mock data - kept as placeholder; will be replaced by backend on load
const mockChats: Chat[] = [
  {
    id: "1",
    platform: "whatsapp",
    contactName: "John Smith",
    lastMessage: "Hey, are you available for a quick call?",
    timestamp: "2 min ago",
    unreadCount: 2,
    isAI: false,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["urgent", "call-scheduled"]
  },
  {
    id: "2", 
    platform: "telegram",
    contactName: "Sarah Johnson",
    lastMessage: "Thanks for the quick response! I'll get back to you with the details.",
    timestamp: "15 min ago",
    unreadCount: 0,
    isAI: true,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["follow-up"]
  },
  {
    id: "3",
    platform: "instagram",
    contactName: "Mike Wilson",
    lastMessage: "Could you send me the pricing information?",
    timestamp: "1 hour ago", 
    unreadCount: 1,
    isAI: false,
    isOngoing: false,
    isArchived: false,
    isBlocked: false,
    tags: ["sale", "pricing"]
  },
  {
    id: "4",
    platform: "vk",
    contactName: "Anna Petrov",
    lastMessage: "The project looks great! Let's schedule a meeting.",
    timestamp: "3 hours ago",
    unreadCount: 0,
    isAI: true,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["meeting", "project"]
  },
  {
    id: "5",
    platform: "whatsapp",
    contactName: "Old Client",
    lastMessage: "Thanks for the work!",
    timestamp: "2 days ago",
    unreadCount: 0,
    isAI: false,
    isOngoing: false,
    isArchived: true,
    isBlocked: false,
    tags: ["completed"]
  },
  {
    id: "6",
    platform: "whatsapp",
    contactName: "Maria Garcia",
    lastMessage: "Hi! I'm interested in your services. Can we discuss pricing?",
    timestamp: "5 min ago",
    unreadCount: 1,
    isAI: false,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["new-lead", "pricing"]
  },
  {
    id: "7",
    platform: "whatsapp",
    contactName: "David Chen",
    lastMessage: "The website looks amazing! When can we launch?",
    timestamp: "1 hour ago",
    unreadCount: 0,
    isAI: true,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["project", "launch"]
  },
  {
    id: "8",
    platform: "whatsapp",
    contactName: "Lisa Thompson",
    lastMessage: "I have some questions about the contract terms.",
    timestamp: "30 min ago",
    unreadCount: 3,
    isAI: false,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["contract", "urgent"]
  },
  {
    id: "9",
    platform: "whatsapp",
    contactName: "Robert Kim",
    lastMessage: "Thanks for the quick turnaround on the design!",
    timestamp: "4 hours ago",
    unreadCount: 0,
    isAI: false,
    isOngoing: false,
    isArchived: false,
    isBlocked: false,
    tags: ["design", "feedback"]
  },
  {
    id: "10",
    platform: "whatsapp",
    contactName: "Emma Wilson",
    lastMessage: "Can we reschedule our meeting to tomorrow?",
    timestamp: "2 hours ago",
    unreadCount: 0,
    isAI: true,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["meeting", "reschedule"]
  },
  {
    id: "11",
    platform: "whatsapp",
    contactName: "Alex Rodriguez",
    lastMessage: "The payment has been processed successfully.",
    timestamp: "1 day ago",
    unreadCount: 0,
    isAI: false,
    isOngoing: false,
    isArchived: true,
    isBlocked: false,
    tags: ["payment", "completed"]
  },
  {
    id: "12",
    platform: "whatsapp",
    contactName: "Sophie Martin",
    lastMessage: "I need help with the login system.",
    timestamp: "45 min ago",
    unreadCount: 2,
    isAI: false,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: ["support", "technical"]
  },
  {
    id: "13",
    platform: "whatsapp",
    contactName: "Blocked User",
    lastMessage: "This chat is blocked.",
    timestamp: "1 hour ago",
    unreadCount: 0,
    isAI: false,
    isOngoing: false,
    isArchived: false,
    isBlocked: true,
    tags: ["blocked"]
  }
];

export function MessengerApp() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isChatListOpen, setIsChatListOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Array<{ id: string; content: string; timestamp: string; isOutgoing: boolean; isRead: boolean; platform: Chat['platform'] }>>>({});

  const mapApiChatToUi = (c: api.Chat): Chat => ({
    id: c.id,
    platform: 'telegram',
    contactName: c.user_id || 'Unknown',
    lastMessage: c.last_message?.message || '',
    timestamp: c.last_message?.created_at || '',
    unreadCount: 0,
    isAI: typeof c.ai_enabled === 'boolean' ? c.ai_enabled : true,
    isOngoing: true,
    isArchived: false,
    isBlocked: false,
    tags: [],
  });

  // Load chats from backend
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getChats();
        const mapped: Chat[] = data.map(mapApiChatToUi);
        setChats(mapped);
      } catch {}
    })();
  }, []);

  // Load messages when selecting a chat
  useEffect(() => {
    if (!selectedChat) return;
    (async () => {
      try {
        const list = await api.getMessages(selectedChat.id);
        const mapped = list.map((m) => ({
          id: m.id,
          content: m.message,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOutgoing: m.message_type === 'answer',
          isRead: true,
          platform: selectedChat.platform,
        }));
        setMessagesByChat((prev) => ({ ...prev, [selectedChat.id]: mapped }));
      } catch {}
    })();
  }, [selectedChat?.id]);

  // WebSocket connections for live updates
  useEffect(() => {
    // Messages WS
    const wsMessages = connectMessagesWebSocket((msg) => {
      const uiMsg = {
        id: msg.id,
        content: msg.message,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOutgoing: msg.message_type === 'answer',
        isRead: true,
        platform: 'telegram' as Chat['platform'],
      };
      setMessagesByChat((prev) => ({
        ...prev,
        [msg.chat_id]: [...(prev[msg.chat_id] || []), uiMsg],
      }));
      setChats((prev) => prev.map(ch => ch.id === msg.chat_id ? { ...ch, lastMessage: msg.message, timestamp: msg.created_at, unreadCount: selectedChat?.id === msg.chat_id ? ch.unreadCount : (ch.unreadCount + (selectedChat?.id === msg.chat_id ? 0 : 1)) } : ch));
    });

    // Chat updates WS
    const wsUpdates = connectChatUpdatesWebSocket((chat) => {
      setChats((prev) => {
        const next = [...prev];
        const idx = next.findIndex(c => c.id === chat.id);
        const mapped = mapApiChatToUi(chat);
        if (idx >= 0) next[idx] = { ...next[idx], ...mapped } as Chat;
        return next;
      });
    });

    return () => {
      try { wsMessages && wsMessages.close(); } catch {}
      try { wsUpdates && wsUpdates.close(); } catch {}
    };
  }, [selectedChat?.id]);

  const handleToggleAI = (chatId: string) => {
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextEnabled = !target.isAI;
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isAI: nextEnabled } : c));
    // Persist to backend if supported
    api.updateChat(chatId, { ai_enabled: nextEnabled }).catch(() => {
      // rollback on failure
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, isAI: !nextEnabled } : c));
    });
  };

  const handleUpdateTags = (chatId: string, newTags: string[]) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, tags: newTags }
          : chat
      )
    );
  };

  const handleArchiveChat = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isArchived: true }
          : chat
      )
    );
    // Deselect chat if it was selected
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
  };

  const handleUnarchiveChat = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isArchived: false }
          : chat
      )
    );
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    // Deselect chat if it was selected
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
  };

  const handleCloseChat = () => {
    setSelectedChat(null);
  };

  const currentMessages = useMemo(() => {
    if (!selectedChat) return [];
    return messagesByChat[selectedChat.id] || [];
  }, [messagesByChat, selectedChat?.id]);

  const handleMessageSent = (chatId: string, optimistic: { id: string; content: string; timestamp: string; isOutgoing: boolean; isRead: boolean; platform: Chat['platform'] }) => {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), optimistic],
    }));
  };

  const handleBlockChat = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isBlocked: true }
          : chat
      )
    );
    // Deselect chat if it was selected
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
  };

  const handleUnblockChat = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isBlocked: false }
          : chat
      )
    );
    // Deselect chat if it was selected
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
  };

  const handleToggleChatStatus = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isOngoing: !chat.isOngoing }
          : chat
      )
    );
    // No direct server mapping for ongoing/closed; left as UI-only stub
  };

  // Filter chats based on archive and blocked status
  const filteredChats = chats.filter(chat => {
    if (showArchived) return chat.isArchived && !chat.isBlocked;
    if (showBlocked) return chat.isBlocked;
    return !chat.isArchived && !chat.isBlocked;
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LanguageProvider>
        <div className="h-screen flex bg-background">
          {/* Chat List Panel */}
          <div className={cn(
            "transition-all duration-300 border-r border-border bg-card",
            isChatListOpen ? "w-80" : "w-0"
          )}>
            {isChatListOpen && (
              <ChatList
                chats={filteredChats}
                selectedChat={selectedChat}
                onSelectChat={setSelectedChat}
                onToggleChatList={() => setIsChatListOpen(false)}
                onToggleContextPanel={() => setIsContextPanelOpen(!isContextPanelOpen)}
                onToggleAI={handleToggleAI}
                showArchived={showArchived}
                showBlocked={showBlocked}
                onToggleArchived={() => setShowArchived(!showArchived)}
                onToggleBlocked={() => setShowBlocked(!showBlocked)}
                onUnarchiveChat={handleUnarchiveChat}
                onUnblockChat={handleUnblockChat}
                onDeleteChat={handleDeleteChat}
              />
            )}
          </div>

          {/* Message View Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            <MessageView
              selectedChat={selectedChat}
              onToggleChatList={() => setIsChatListOpen(!isChatListOpen)}
              isChatListOpen={isChatListOpen}
              onUpdateTags={handleUpdateTags}
              onArchiveChat={handleArchiveChat}
              onUnarchiveChat={handleUnarchiveChat}
              onDeleteChat={handleDeleteChat}
              onCloseChat={handleCloseChat}
              onBlockChat={handleBlockChat}
              onUnblockChat={handleUnblockChat}
              onToggleChatStatus={handleToggleChatStatus}
              messages={currentMessages}
              onMessageSent={handleMessageSent}
            />
          </div>

          {/* Context/FAQs Panel */}
          <div className={cn(
            "transition-all duration-300 border-l border-border bg-card",
            isContextPanelOpen ? "w-80" : "w-0"
          )}>
            {isContextPanelOpen && (
              <ContextPanel onClose={() => setIsContextPanelOpen(false)} />
            )}
          </div>
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
}