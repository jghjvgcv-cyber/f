import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  LayoutDashboard, 
  History, 
  ShieldCheck, 
  MessageSquare, 
  User as UserIcon,
  LogOut,
  Truck,
  ChevronRight
} from 'lucide-react';
import { cn } from './UI';

export function Sidebar({ 
  isOpen, 
  onClose, 
  view, 
  setView, 
  isAdmin, 
  onLogout,
  driverName
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  view: string, 
  setView: (v: any) => void, 
  isAdmin: boolean,
  onLogout: () => void,
  driverName?: string
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard, description: 'Painel principal' },
    { id: 'history', label: 'Histórico', icon: History, description: 'Jornadas anteriores' },
    { id: 'chat', label: 'Suporte', icon: MessageSquare, description: 'Falar com gestor' },
    { id: 'profile', label: 'Perfil', icon: UserIcon, description: 'Meus dados' },
  ];

  if (isAdmin) {
    menuItems.splice(2, 0, { id: 'manager', label: 'Gestão', icon: ShieldCheck, description: 'Controle de frota' });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Sidebar Panel */}
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[300px] bg-white z-[101] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-zinc-900 uppercase text-sm italic tracking-tight leading-none">HF</h2>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Transportes</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-zinc-50 rounded-xl transition-colors group"
                id="close-sidebar-btn"
              >
                <X className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative overflow-hidden",
                    view === item.id 
                      ? "bg-zinc-900 text-white shadow-xl shadow-zinc-900/20" 
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    view === item.id ? "bg-white/10" : "bg-zinc-100 group-hover:bg-emerald-500 group-hover:text-white"
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{item.label}</p>
                    <p className={cn(
                      "text-[9px] font-medium uppercase tracking-wider opacity-60",
                      view === item.id ? "text-emerald-400" : "text-zinc-400"
                    )}>{item.description}</p>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform",
                    view === item.id ? "text-emerald-400 translate-x-1" : "text-zinc-300 group-hover:text-zinc-900"
                  )} />
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-50 space-y-4">
              {driverName && (
                <div className="px-6 py-4 bg-zinc-50 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-zinc-100">
                    <UserIcon className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">Motorista</p>
                    <p className="text-xs font-bold text-zinc-900 truncate">{driverName}</p>
                  </div>
                </div>
              )}
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all group"
                id="logout-sidebar-btn"
              >
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Encerrar Sessão</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
