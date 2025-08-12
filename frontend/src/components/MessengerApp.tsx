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

// Mock data kept as placeholder during initial load
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

  // Load chats from backend and enrich with platform (messager) and names
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getChats();
        // Map base fields
        let mapped: Chat[] = data.map((c) => ({
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
        }));
        setChats(mapped);
        // Enrich with chat details (messager) in parallel
        const details = await Promise.allSettled(
          mapped.map((c) => api.api.get(`/api/chats/${c.id}`))
        );
        mapped = mapped.map((c, idx) => {
          const d = details[idx];
          if (d.status === 'fulfilled') {
            const det = d.value.data || {};
            const platform = (det.messager as string) || 'telegram';
            const name = det.name || c.contactName;
            return { ...c, platform: platform as Chat['platform'], contactName: name };
          }
          return c;
        });
        setChats(mapped);
      } catch {}
    })();
  }, []);

  // Load messages when a chat is selected
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

  // Live WebSocket updates for messages and chat updates
  useEffect(() => {
    const wsMessages = connectMessagesWebSocket((msg) => {
      const mapped = {
        id: msg.id,
        content: msg.message,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOutgoing: msg.message_type === 'answer',
        isRead: true,
        platform: 'telegram' as Chat['platform'],
      };
      setMessagesByChat((prev) => ({ ...prev, [msg.chat_id]: [...(prev[msg.chat_id] || []), mapped] }));
      setChats((prev) => prev.map(c => c.id === msg.chat_id ? { ...c, lastMessage: msg.message, timestamp: msg.created_at } : c));
    });

    const wsUpdates = connectChatUpdatesWebSocket((chat) => {
      setChats((prev) => {
        const idx = prev.findIndex(c => c.id === chat.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], isAI: chat.ai_enabled };
        return copy;
      });
    });

    return () => {
      try { wsMessages && wsMessages.close(); } catch {}
      try { wsUpdates && wsUpdates.close(); } catch {}
    };
  }, []);

  const handleToggleAI = (chatId: string) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId 
          ? { ...chat, isAI: !chat.isAI }
          : chat
      )
    );
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
    if (!selectedChat) return [] as Array<{ id: string; content: string; timestamp: string; isOutgoing: boolean; isRead: boolean; platform: Chat['platform'] }>;
    return messagesByChat[selectedChat.id] || [];
  }, [messagesByChat, selectedChat?.id]);

  const handleMessageSent = (chatId: string, optimistic: { id: string; content: string; timestamp: string; isOutgoing: boolean; isRead: boolean; platform: Chat['platform'] }) => {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), optimistic],
    }));
    setChats((prev) => prev.map(c => c.id === chatId ? { ...c, lastMessage: optimistic.content, timestamp: new Date().toISOString() } : c));
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