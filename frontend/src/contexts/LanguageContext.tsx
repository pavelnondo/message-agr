import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'ru' | 'ar';

interface Translations {
  [key: string]: {
    en: string;
    ru: string;
    ar: string;
  };
}

const translations: Translations = {
  // Header
  'active': { en: 'active', ru: 'активные', ar: 'نشطة' },
  'archived': { en: 'archived', ru: 'архивные', ar: 'مؤرشفة' },
  'ai_chats': { en: 'AI chats', ru: 'ИИ чаты', ar: 'محادثات الذكاء الاصطناعي' },
  'search_placeholder': { en: 'Search conversations...', ru: 'Поиск разговоров...', ar: 'البحث في المحادثات...' },
  'show_archived': { en: 'Archived', ru: 'Архив', ar: 'مؤرشفة' },
  'show_active': { en: 'Active', ru: 'Активные', ar: 'نشطة' },
  
  // Filters
  'ai_control': { en: 'AI Control', ru: 'Управление ИИ', ar: 'التحكم في الذكاء الاصطناعي' },
  'ai': { en: 'AI', ru: 'ИИ', ar: 'ذكاء اصطناعي' },
  'human': { en: 'Human', ru: 'Человек', ar: 'إنسان' },
  'all_platforms': { en: 'All Platforms', ru: 'Все платформы', ar: 'جميع المنصات' },
  'all_status': { en: 'All Status', ru: 'Все статусы', ar: 'جميع الحالات' },
  'all_tags': { en: 'All Tags', ru: 'Все теги', ar: 'جميع العلامات' },
  'ongoing': { en: 'Ongoing', ru: 'В процессе', ar: 'جاري' },
  'closed': { en: 'Closed', ru: 'Закрыто', ar: 'مغلق' },
  
  // Messages
  'select_conversation': { en: 'Select a conversation to start messaging', ru: 'Выберите разговор для начала переписки', ar: 'اختر محادثة لبدء المراسلة' },
  'no_conversation': { en: 'No conversation selected', ru: 'Разговор не выбран', ar: 'لم يتم تحديد محادثة' },
  'choose_conversation': { en: 'Choose a conversation from the chat list to start messaging your contacts.', ru: 'Выберите разговор из списка чатов, чтобы начать переписку с контактами.', ar: 'اختر محادثة من قائمة الدردشة لبدء المراسلة مع جهات الاتصال.' },
  'online': { en: 'Online', ru: 'В сети', ar: 'متصل' },
  'typing': { en: 'typing...', ru: 'печатает...', ar: 'يكتب...' },
  'message_placeholder': { en: 'Type your message...', ru: 'Введите сообщение...', ar: 'اكتب رسالتك...' },
  
  // Actions
  'add_tag': { en: 'Add Tag', ru: 'Добавить тег', ar: 'إضافة علامة' },
  'ai_on': { en: 'AI On', ru: 'ИИ Вкл', ar: 'الذكاء الاصطناعي مفعل' },
  'ai_off': { en: 'AI Off', ru: 'ИИ Выкл', ar: 'الذكاء الاصطناعي معطل' },
  'new_tag': { en: 'New tag...', ru: 'Новый тег...', ar: 'علامة جديدة...' },
  'dark_mode': { en: 'Dark Mode', ru: 'Тёмная тема', ar: 'الوضع الليلي' },
  'language': { en: 'Language', ru: 'Язык', ar: 'اللغة' },
  'delete_chat': { en: 'Delete Chat', ru: 'Удалить чат', ar: 'حذف المحادثة' },
  'delete_confirm_title': { en: 'Are you sure?', ru: 'Вы уверены?', ar: 'هل أنت متأكد؟' },
  'delete_confirm_description': { en: 'This action cannot be undone. This will permanently delete the chat and all its messages.', ru: 'Это действие нельзя отменить. Это навсегда удалит чат и все его сообщения.', ar: 'لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف المحادثة وكل رسائلها نهائياً.' },
  'delete': { en: 'Delete', ru: 'Удалить', ar: 'حذف' },
  'cancel': { en: 'Cancel', ru: 'Отмена', ar: 'إلغاء' },
  'close_chat': { en: 'Close Chat', ru: 'Закрыть чат', ar: 'إغلاق المحادثة' },
  'block_chat': { en: 'Block Chat', ru: 'Заблокировать чат', ar: 'حظر المحادثة' },
  'activate_chat': { en: 'Activate Chat', ru: 'Активировать чат', ar: 'تفعيل المحادثة' },
  'blocked': { en: 'blocked', ru: 'заблокированные', ar: 'محظورة' },
  'show_blocked': { en: 'Blocked', ru: 'Заблокированные', ar: 'محظورة' },
  'block_confirm_title': { en: 'Block this chat?', ru: 'Заблокировать этот чат?', ar: 'حظر هذه المحادثة؟' },
  'block_confirm_description': { en: 'This will block the user and move the chat to the blocked section. You can unblock them later.', ru: 'Это заблокирует пользователя и переместит чат в раздел заблокированных. Вы сможете разблокировать их позже.', ar: 'سيؤدي هذا إلى حظر المستخدم ونقل المحادثة إلى القسم المحظور. يمكنك إلغاء الحظر لاحقاً.' },
  'block': { en: 'Block', ru: 'Заблокировать', ar: 'حظر' },
  'unblock_chat': { en: 'Unblock Chat', ru: 'Разблокировать чат', ar: 'إلغاء حظر المحادثة' },
  
  // Languages
  'english': { en: 'English', ru: 'Английский', ar: 'الإنجليزية' },
  'russian': { en: 'Russian', ru: 'Русский', ar: 'الروسية' },
  'arabic': { en: 'Arabic', ru: 'Арабский', ar: 'العربية' },
  
  // Context Panel
  'context_faqs': { en: 'Context & FAQs', ru: 'Контекст и FAQ', ar: 'السياق والأسئلة الشائعة' },
  'context': { en: 'Context', ru: 'Контекст', ar: 'السياق' },
  'faqs': { en: 'FAQs', ru: 'FAQ', ar: 'الأسئلة الشائعة' },
  'add_context': { en: 'Add Context', ru: 'Добавить контекст', ar: 'إضافة سياق' },
  'add_faq': { en: 'Add FAQ', ru: 'Добавить FAQ', ar: 'إضافة سؤال شائع' },
  'context_placeholder': { en: 'Add important context about this conversation...', ru: 'Добавьте важный контекст об этом разговоре...', ar: 'أضف سياقًا مهمًا حول هذه المحادثة...' },
  'faq_placeholder': { en: 'Add a frequently asked question and its answer...', ru: 'Добавьте часто задаваемый вопрос и ответ...', ar: 'أضف سؤالاً شائعًا وإجابته...' },
  'submitting': { en: 'Submitting...', ru: 'Отправка...', ar: 'جاري الإرسال...' },
  'categories': { en: 'Categories', ru: 'Категории', ar: 'الفئات' },
  'existing_context': { en: 'Existing Context', ru: 'Существующий контекст', ar: 'السياق الموجود' },
  'existing_faqs': { en: 'Existing FAQs', ru: 'Существующие FAQ', ar: 'الأسئلة الشائعة الموجودة' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  
  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };
  
  const isRTL = language === 'ar';
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}