import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Maximize2, Minimize2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../firebase';
import { getIdToken } from 'firebase/auth';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface DashboardChatProps {
  token?: string | null;
}

export const DashboardChat: React.FC<DashboardChatProps> = ({ token: initialToken }) => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: t.chat.welcome,
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isExpanded]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Robust token retrieval: prop fallback to active currentUser token
      let activeToken = initialToken;
      if (!activeToken && auth.currentUser) {
        console.log('[Chat] Prop token missing, fetching active Firebase token...');
        activeToken = await getIdToken(auth.currentUser);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({ 
          message: input,
          language: language
        }),
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Fallback if not JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || t.chat.error,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: error.message?.includes('401') || error.message?.includes('403') 
          ? "Sessão expirada. Por favor, faça login novamente."
          : t.chat.serverError,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const containerClasses = isExpanded 
    ? "fixed inset-4 sm:inset-10 z-[100] bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-700 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300"
    : "bg-slate-900 rounded-[3rem] overflow-hidden border border-slate-800/50 shadow-2xl flex flex-col h-full transition-all duration-300 ring-1 ring-white/5";

  return (
    <>
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-in fade-in duration-300" 
          onClick={() => setIsExpanded(false)} 
        />
      )}
      
      <div className={containerClasses}>
        <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
            <h3 className="text-white font-bold text-sm">{t.chat.title}</h3>
          </div>
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsExpanded(!isExpanded)}
               className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
               title={isExpanded ? "Reduzir" : "Ampliar"}
             >
               {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
             </button>
             {isExpanded && (
               <button 
                 onClick={() => setIsExpanded(false)}
                 className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[90%] p-3.5 rounded-3xl text-sm leading-relaxed ${
                m.sender === 'user' 
                  ? 'bg-teal-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-300 rounded-tl-none border border-white/5'
              }`}>
                {m.sender === 'bot' ? (
                  <div className="prose prose-invert prose-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                ) : m.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                <span className="text-[10px] text-slate-400 italic">{t.chat.loading}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white/5 border-t border-white/5">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t.chat.placeholder}
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-teal-600 rounded-xl text-white hover:bg-teal-500 disabled:bg-slate-800 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
