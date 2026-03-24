import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Message, OperationType } from '../types';
import { handleFirestoreError, compressImage } from '../utils/firestore';
import { motion } from 'motion/react';
import { MessageSquare, Mic, Camera, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ChatView({ driverId, user, isAdmin = false }: { driverId: string, user: User, isAdmin?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('driverId', '==', driverId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));
    return unsub;
  }, [driverId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text?: string, photo?: string, audio?: string) => {
    if (!text && !photo && !audio) return;
    try {
      await addDoc(collection(db, 'messages'), {
        driverId,
        senderId: user.uid,
        text: text || null,
        photo: photo || null,
        audio: audio || null,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'messages'));
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      sendMessage(undefined, compressed);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[3rem] overflow-hidden border border-zinc-100 shadow-2xl shadow-zinc-200/50">
      {/* Chat Header */}
      <div className="px-8 py-6 bg-white border-b border-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900 tracking-tight uppercase">
              {isAdmin ? "Chat com Motorista" : "Suporte HF Transportes"}
            </h3>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Canal Direto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50/30"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === user.uid;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={m.id} 
              className={cn(
                "flex flex-col max-w-[85%]",
                isMe ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "p-5 rounded-[2rem] shadow-sm",
                isMe 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-100 rounded-tl-none"
              )}>
                {m.text && <p className="text-sm font-medium leading-relaxed">{m.text}</p>}
                {m.photo && (
                  <div className="mt-2 rounded-2xl overflow-hidden shadow-lg">
                    <img 
                      src={m.photo} 
                      alt="Chat" 
                      className="max-w-full h-auto block" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {m.audio && (
                  <div className="flex items-center gap-3 py-1">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      isMe ? "bg-white/10" : "bg-zinc-100"
                    )}>
                      <Mic className="w-5 h-5" />
                    </div>
                    <div className="flex-1 h-1 bg-current opacity-20 rounded-full min-w-[100px]" />
                  </div>
                )}
              </div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-2 px-2">
                {m.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-zinc-50">
        <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-[2rem] border border-zinc-100 focus-within:border-emerald-500/50 transition-all">
          <label className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors cursor-pointer">
            <Camera className="w-6 h-6" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage(newMessage)}
            placeholder="Escreva sua mensagem..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
          />
          <button
            onClick={() => sendMessage(newMessage)}
            disabled={!newMessage.trim()}
            className={cn(
              "p-4 rounded-2xl transition-all active:scale-95",
              newMessage.trim() 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                : "bg-zinc-200 text-zinc-400"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
