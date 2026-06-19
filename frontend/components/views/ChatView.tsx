import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Eu sou o assistente do LabProcessor. Posso responder perguntas sobre os métodos analíticos que você já processou. Como posso ajudar?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Desculpe, não consegui processar sua pergunta.',
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Ocorreu um erro ao se comunicar com o servidor. Verifique se o backend está rodando.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center gap-3">
        <div className="p-2 bg-teal-500/20 rounded-lg">
          <MessageSquare className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Chat Contextual</h2>
          <p className="text-xs text-slate-400">Conversando com seus dados do Pinecone</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] flex gap-3 ${
                m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                m.sender === 'user' ? 'bg-teal-600' : 'bg-slate-700'
              }`}>
                {m.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-teal-400" />}
              </div>
              <div
                className={`p-4 rounded-2xl leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-none shadow-lg shadow-teal-900/20 whitespace-pre-wrap'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none prose prose-invert prose-slate max-w-none'
                }`}
              >
                {m.sender === 'bot' ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({node, ...props}) => (
                        <img 
                          {...props} 
                          className="rounded-lg border border-slate-600 my-2 max-h-64 object-contain bg-white"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Imagem+indisponivel';
                          }}
                        />
                      ),
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-2">
                          <table {...props} className="border-collapse border border-slate-600 w-full text-xs" />
                        </div>
                      ),
                      th: ({node, ...props}) => <th {...props} className="border border-slate-600 p-1 bg-slate-700" />,
                      td: ({node, ...props}) => <td {...props} className="border border-slate-600 p-1" />,
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
                <div className={`text-[10px] mt-2 opacity-50 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              <span className="text-sm text-slate-400 italic">Analisando contexto...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte sobre seus métodos (ex: 'Quais equipamentos são usados no teste de pureza do Paracetamol?')..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none h-12 max-h-32 transition-all"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-xl transition-all flex items-center justify-center ${
              !input.trim() || isLoading
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-900/30 active:scale-95'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
