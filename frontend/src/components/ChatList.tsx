import { useState } from "react";
import { Search, Settings, Book, MessageSquare, Filter, Tag, Bot, BotOff, Sun, Moon, Globe, Archive, RotateCcw, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlatformIcon } from "./PlatformIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Chat } from "./MessengerApp";
interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onToggleChatList: () => void;
  onToggleContextPanel: () => void;
  onToggleAI: (chatId: string) => void;
  showArchived: boolean;
  showBlocked: boolean;
  onToggleArchived: () => void;
  onToggleBlocked: () => void;
  onUnarchiveChat: (chatId: string) => void;
  onUnblockChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}
const tagColors = {
  urgent: "bg-destructive text-destructive-foreground",
  "follow-up": "bg-primary text-primary-foreground",
  sale: "bg-whatsapp text-white",
  pricing: "bg-away text-white",
  meeting: "bg-vk text-white",
  project: "bg-telegram text-white",
  "call-scheduled": "bg-instagram text-white"
};
export function ChatList({
  chats,
  selectedChat,
  onSelectChat,
  onToggleChatList,
  onToggleContextPanel,
  onToggleAI,
  showArchived,
  showBlocked,
  onToggleArchived,
  onToggleBlocked,
  onUnarchiveChat,
  onUnblockChat,
  onDeleteChat
}: ChatListProps) {
  const {
    t,
    language,
    setLanguage
  } = useLanguage();
  const {
    theme,
    setTheme
  } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAI, setFilterAI] = useState(false);
  const [filterHuman, setFilterHuman] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) || chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAI = !filterAI || chat.isAI;
    const matchesHuman = !filterHuman || !chat.isAI;
    const matchesPlatform = filterPlatform === "all" || chat.platform === filterPlatform;
    const matchesStatus = filterStatus === "all" || filterStatus === "ongoing" && chat.isOngoing || filterStatus === "closed" && !chat.isOngoing;
    const matchesTag = filterTag === "all" || chat.tags.includes(filterTag);
    return matchesSearch && matchesAI && matchesHuman && matchesPlatform && matchesStatus && matchesTag;
  });
  const activeChatCount = filteredChats.filter(chat => chat.isOngoing).length;
  const aiChatCount = filteredChats.filter(chat => chat.isAI && chat.isOngoing).length;
  const totalChatCount = chats.length;
  const filteredChatCount = filteredChats.length;
  return <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div className="bg-primary text-primary-foreground rounded-full text-xs font-medium px-3 py-1 flex items-center justify-center whitespace-nowrap">
              {activeChatCount} {showArchived ? t('archived') : showBlocked ? t('blocked') : t('active')}
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-full text-xs font-medium flex items-center gap-1 px-3 py-1 whitespace-nowrap">
              <Bot className="h-3 w-3" />
              {aiChatCount} {t('ai_chats')}
            </div>
            <div className="bg-muted text-muted-foreground rounded-full text-xs font-medium px-3 py-1 flex items-center justify-center whitespace-nowrap">
              {filteredChatCount}/{totalChatCount}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleArchived}
              className="text-xs px-3 py-1 h-auto"
            >
              <Archive className="h-3 w-3 mr-1" />
              {showArchived ? t('show_active') : t('show_archived')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleBlocked}
              className="text-xs px-3 py-1 h-auto"
            >
              <Ban className="h-3 w-3 mr-1" />
              {showBlocked ? t('show_active') : t('show_blocked')}
            </Button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Select value={language} onValueChange={value => setLanguage(value as any)}>
              <SelectTrigger className="w-8 h-8 p-0 flex items-center justify-center [&>svg:last-child]:hidden">
                <Globe className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <div className="flex items-center gap-2">
                    <img src="/lovable-uploads/4b11dd63-cc36-4c63-9ebb-cefaf764a104.png" alt="UK Flag" className="w-4 h-3 object-cover rounded-sm border border-border" />
                    {t('english')}
                  </div>
                </SelectItem>
                <SelectItem value="ru">
                  <div className="flex items-center gap-2">
                    <img src="/lovable-uploads/11f28d85-a152-4e6d-a9cc-114bff0a3656.png" alt="Russian Flag" className="w-4 h-3 object-cover rounded-sm border border-border" />
                    {t('russian')}
                  </div>
                </SelectItem>
                <SelectItem value="ar">
                  <div className="flex items-center gap-2">
                    <img src="/lovable-uploads/71067921-4010-4776-bdda-3b62af7561c4.png" alt="Saudi Flag" className="w-4 h-3 object-cover rounded-sm border border-border" />
                    {t('arabic')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleContextPanel}>
              <Book className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('search_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Filters */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('ai_control')}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={filterAI} onCheckedChange={setFilterAI} id="ai-filter" />
                <label htmlFor="ai-filter" className="text-xs">{t('ai')}</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={filterHuman} onCheckedChange={setFilterHuman} id="human-filter" />
                <label htmlFor="human-filter" className="text-xs">{t('human')}</label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_platforms')}</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="vk">VK</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_status')}</SelectItem>
                <SelectItem value="ongoing">{t('ongoing')}</SelectItem>
                <SelectItem value="closed">{t('closed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filterTag} onValueChange={setFilterTag}>
            
            <SelectContent>
              <SelectItem value="all">{t('all_tags')}</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredChats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No chats found</p>
          </div>
        ) : (
          filteredChats.map(chat => <div key={chat.id} onClick={() => onSelectChat(chat)} className={cn("p-4 border-b border-border cursor-pointer transition-colors hover:bg-hover", selectedChat?.id === chat.id && "bg-active")}>
            <div className="flex items-start gap-3">
              {/* Platform Avatar */}
              <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center bg-card">
                <PlatformIcon platform={chat.platform} className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{chat.contactName}</span>
                    {chat.isAI && <Bot className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={e => {
                  e.stopPropagation();
                  onToggleAI(chat.id);
                }} className="p-1 h-6 w-6">
                      {chat.isAI ? <Bot className="h-3 w-3 text-primary" /> : <BotOff className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                    {showArchived && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={e => {
                            e.stopPropagation();
                            onUnarchiveChat(chat.id);
                          }} 
                          className="p-1 h-6 w-6"
                          title="Unarchive"
                        >
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={e => e.stopPropagation()}
                              className="p-1 h-6 w-6"
                              title={t('delete_chat')}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
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
                              <AlertDialogCancel onClick={e => e.stopPropagation()}>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteChat(chat.id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t('delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {showBlocked && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={e => {
                            e.stopPropagation();
                            onUnblockChat(chat.id);
                          }} 
                          className="p-1 h-6 w-6"
                          title="Unblock"
                        >
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={e => e.stopPropagation()}
                              className="p-1 h-6 w-6"
                              title={t('delete_chat')}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
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
                              <AlertDialogCancel onClick={e => e.stopPropagation()}>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteChat(chat.id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t('delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">{chat.timestamp}</span>
                    {chat.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs p-0">
                        {chat.unreadCount}
                      </Badge>}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {chat.lastMessage}
                </p>

                {/* Status and Tags */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", chat.isOngoing ? "bg-online" : "bg-offline")} />
                    <span className="text-xs text-muted-foreground">
                      {chat.isOngoing ? t('ongoing') : t('closed')}
                    </span>
                  </div>
                  
                  {chat.tags.length > 0 && <div className="flex gap-1">
                      {chat.tags.slice(0, 2).map(tag => <Badge key={tag} className={cn("text-xs px-1 py-0 rounded-full", tagColors[tag as keyof typeof tagColors] || "bg-muted text-muted-foreground")}>
                          {tag}
                        </Badge>)}
                      {chat.tags.length > 2 && <Badge className="text-xs px-1 py-0 rounded-full bg-muted text-muted-foreground">
                          +{chat.tags.length - 2}
                        </Badge>}
                    </div>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>;
}