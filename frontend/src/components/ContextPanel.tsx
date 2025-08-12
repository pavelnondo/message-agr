import { useState } from "react";
import { X, FileText, HelpCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
interface ContextPanelProps {
  onClose: () => void;
}
export function ContextPanel({
  onClose
}: ContextPanelProps) {
  const { t, isRTL } = useLanguage();
  const [contextText, setContextText] = useState("");
  const [faqText, setFaqText] = useState("");
  const [isSubmittingContext, setIsSubmittingContext] = useState(false);
  const [isSubmittingFAQ, setIsSubmittingFAQ] = useState(false);
  const handleSubmitContext = async () => {
    if (!contextText.trim()) return;
    setIsSubmittingContext(true);

    // TODO: Implement context submission to backend
    console.log("Submitting context:", contextText);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setContextText("");
    setIsSubmittingContext(false);
  };
  const handleSubmitFAQ = async () => {
    if (!faqText.trim()) return;
    setIsSubmittingFAQ(true);

    // TODO: Implement FAQ submission to backend
    console.log("Submitting FAQ:", faqText);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setFaqText("");
    setIsSubmittingFAQ(false);
  };

  // Mock existing context and FAQs - TODO: Replace with backend data
  const existingContext = [{
    id: "c1",
    content: "Customer is interested in our premium subscription plan. They mentioned budget constraints but seem very engaged with the product features.",
    timestamp: "2 hours ago",
    author: "John Doe"
  }, {
    id: "c2",
    content: "Previous conversation included discussion about integration with their existing CRM system. They use Salesforce.",
    timestamp: "1 day ago",
    author: "AI Assistant"
  }];
  const existingFAQs = [{
    id: "f1",
    question: "What's included in the premium plan?",
    answer: "Premium plan includes unlimited projects, priority support, advanced analytics, and custom integrations.",
    category: "Pricing"
  }, {
    id: "f2",
    question: "How does the CRM integration work?",
    answer: "Our platform supports native integrations with Salesforce, HubSpot, and Pipedrive. Custom integrations available on enterprise plans.",
    category: "Technical"
  }, {
    id: "f3",
    question: "What is your refund policy?",
    answer: "We offer a 30-day money-back guarantee for all paid plans. No questions asked.",
    category: "Billing"
  }];
  const faqCategories = [...new Set(existingFAQs.map(faq => faq.category))];
  return <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
          <h2 className="text-lg font-semibold">{t('context_faqs')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="context" className="h-full">
          <TabsList className={cn("grid w-full grid-cols-2 mb-0", isRTL ? "mx-2 my-4" : "m-4")}>
            <TabsTrigger value="context" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <FileText className="h-4 w-4" />
              {t('context')}
            </TabsTrigger>
            <TabsTrigger value="faqs" className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <HelpCircle className="h-4 w-4" />
              {t('faqs')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="context" className="m-4 mt-6 space-y-4">
            {/* Add Context Form */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">{t('add_context')}</h3>
              <Textarea 
                placeholder={t('context_placeholder')} 
                value={contextText} 
                onChange={e => setContextText(e.target.value)} 
                className={cn("min-h-[100px]", isRTL && "text-right")} 
              />
              <Button onClick={handleSubmitContext} disabled={!contextText.trim() || isSubmittingContext} className="w-full">
                {isSubmittingContext ? t('submitting') : <>
                    <Send className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                    {t('add_context')}
                  </>}
              </Button>
            </div>

            {/* Existing Context */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">{t('existing_context')}</h3>
              <div className="space-y-3">
                {existingContext.map(context => (
                  <div key={context.id} className="p-3 bg-muted rounded-lg">
                    <p className={cn("text-sm", isRTL && "text-right")}>{context.content}</p>
                    <div className={cn("flex justify-between items-center mt-2 pt-2 border-t border-border", isRTL && "flex-row-reverse")}>
                      <span className="text-xs text-muted-foreground">{context.author}</span>
                      <span className="text-xs text-muted-foreground">{context.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="faqs" className="m-4 mt-6 space-y-4">
            {/* Add FAQ Form */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">{t('add_faq')}</h3>
              <Textarea 
                placeholder={t('faq_placeholder')} 
                value={faqText} 
                onChange={e => setFaqText(e.target.value)} 
                className={cn("min-h-[100px]", isRTL && "text-right")} 
              />
              <Button onClick={handleSubmitFAQ} disabled={!faqText.trim() || isSubmittingFAQ} className="w-full">
                {isSubmittingFAQ ? t('submitting') : <>
                    <Send className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                    {t('add_faq')}
                  </>}
              </Button>
            </div>

            {/* FAQ Categories */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">{t('categories')}</h3>
              <div className={cn("flex flex-wrap gap-2", isRTL && "justify-end")}>
                {faqCategories.map(category => (
                  <Badge key={category} variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Existing FAQs */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">{t('existing_faqs')}</h3>
              <div className="space-y-3">
                {existingFAQs.map(faq => (
                  <div key={faq.id} className="p-3 bg-muted rounded-lg">
                    <div className={cn("flex justify-between items-start mb-2", isRTL && "flex-row-reverse")}>
                      <h4 className={cn("font-medium text-sm", isRTL && "text-right")}>{faq.question}</h4>
                      <Badge variant="outline" className={cn("text-xs", isRTL ? "mr-2" : "ml-2")}>
                        {faq.category}
                      </Badge>
                    </div>
                    <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}