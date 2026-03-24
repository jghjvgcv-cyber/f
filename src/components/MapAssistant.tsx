import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bot, X, Sparkles, MapPin, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mocking queryMapAssistant for now, or I should find it in App.tsx
// I'll search for queryMapAssistant in App.tsx
import { queryMapAssistant } from '../services/geminiService';

export function MapAssistant({ location, isOpen, onClose }: { location?: { latitude: number; longitude: number }, isOpen: boolean, onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, links?: { title: string, uri: string }[] }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const result = await queryMapAssistant(userMsg, location);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.text,
        links: result.links
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Desculpe, ocorreu um erro ao processar sua solicitação de mapa." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[600px]"
      >
        {/* Header */}
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight italic font-display">Assistente de Mapa</h3>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Powered by Gemini</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50">
          {messages.length === 0 && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Como posso ajudar?</p>
                <p className="text-zinc-500 text-[10px] font-medium max-w-[200px] mx-auto">Pergunte sobre postos, restaurantes ou rotas próximas.</p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium leading-relaxed",
                msg.role === 'user' 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-100 shadow-sm rounded-tl-none"
              )}>
                {msg.content}
                
                {msg.links && msg.links.length > 0 && (
                  <div className="mt-4 space-y-2 pt-4 border-t border-zinc-100">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Locais Encontrados:</p>
                    {msg.links.map((link, lIdx) => (
                      <a 
                        key={lIdx}
                        href={link.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors group"
                      >
                        <span className="text-[10px] font-black text-zinc-900 uppercase truncate pr-2">{link.title}</span>
                        <MapPin className="w-3 h-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-zinc-100">
          <div className="flex gap-2">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ex: Postos de gasolina próximos..."
              className="flex-1 bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !query.trim()}
              className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
