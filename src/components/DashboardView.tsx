import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Clock, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  TrendingUp,
  MessageSquare,
  Navigation,
  Bot,
  Sparkles,
  Search
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { DriverData, ShiftData, OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { ActionButton } from './UI';

export function DashboardView({ 
  driver, 
  activeShift, 
  onStartShift, 
  onEndShift,
  onNavigate,
  hasDoneChecklist,
  onTalkToManager,
  currentLocation,
  showAlert,
  showConfirm,
  addingOrder,
  setAddingOrder,
  addOrderNumber
}: { 
  driver: DriverData, 
  activeShift: ShiftData | null, 
  onStartShift: (km: number) => void, 
  onEndShift: (km: number, deliveries: number) => void,
  onNavigate: (view: any) => void,
  hasDoneChecklist: boolean,
  onTalkToManager: () => void,
  currentLocation: any,
  showAlert: any,
  showConfirm: any,
  addingOrder: any,
  setAddingOrder: any,
  addOrderNumber: any
}) {
  const [km, setKm] = useState('');
  const [deliveries, setDeliveries] = useState('');
  const [lastShifts, setLastShifts] = useState<ShiftData[]>([]);
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    if (!driver) return;
    const q = query(
      collection(db, 'shifts'), 
      where('driverId', '==', driver.uid),
      where('status', '==', 'completed'),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      setLastShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ShiftData[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'shifts'));
  }, [driver]);

  if (!activeShift) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 py-6"
      >
        <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-900/5 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
          
          <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center mx-auto group hover:scale-110 transition-transform duration-500">
            <Clock className="w-10 h-10 text-emerald-600 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">Iniciar Jornada</h3>
            <p className="text-zinc-400 text-sm font-medium">Insira a quilometragem atual para começar.</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input 
                type="number" 
                placeholder="000000"
                value={km}
                onChange={e => setKm(e.target.value)}
                className="w-full px-8 py-6 bg-zinc-50 border-2 border-zinc-100 rounded-[2rem] text-4xl font-black text-center text-zinc-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-zinc-200"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-300 font-black text-xl">KM</div>
            </div>
            
            <button 
              onClick={() => onStartShift(Number(km))}
              disabled={!km}
              className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
            >
              <Truck className="w-5 h-5" />
              Iniciar Agora
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ActionButton icon={CheckCircle2} label="Checklist" onClick={() => onNavigate('checklist')} color={hasDoneChecklist ? "bg-emerald-50 border-emerald-100" : "bg-white"} />
          <ActionButton icon={History} label="Histórico" onClick={() => onNavigate('history')} color="bg-white" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-6"
    >
      {/* Active Shift Card */}
      <div className="bg-zinc-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-zinc-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-[80px] rounded-full" />
        
        <div className="flex justify-between items-start mb-10">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Jornada Ativa</p>
            <h3 className="text-3xl font-black tracking-tighter italic uppercase">Em Rota</h3>
          </div>
          <div className="px-4 py-2 bg-emerald-500/20 rounded-full border border-emerald-500/30 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">GPS Ativo</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">KM Inicial</p>
            <p className="text-3xl font-black tracking-tight">{activeShift.quilometragem_inicial}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Início</p>
            <p className="text-3xl font-black tracking-tight">
              {activeShift.startTime?.toDate ? activeShift.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <ActionButton icon={Package} label="Entregas" onClick={() => onNavigate('deliveries')} color="bg-white" />
        <ActionButton icon={Fuel} label="Despesas" onClick={() => onNavigate('expenses')} color="bg-white" />
        <ActionButton icon={MessageSquare} label="Suporte" onClick={onTalkToManager} color="bg-white" />
        <ActionButton icon={AlertCircle} label="Finalizar" onClick={() => onNavigate('dashboard')} color="bg-red-50 border-red-100" />
      </div>

      {/* Order Numbers Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Pedidos do Turno</h4>
          <button 
            onClick={() => setAddingOrder({ shiftId: activeShift.id, value: '' })}
            className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {addingOrder && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-500/5 space-y-3"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  autoFocus
                  placeholder="Digite o número do pedido..."
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (addOrderNumber(activeShift.id, orderNumber), setOrderNumber(''))}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { addOrderNumber(activeShift.id, orderNumber); setOrderNumber(''); }}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Adicionar
                </button>
                <button 
                  onClick={() => setAddingOrder(null)}
                  className="px-6 py-3 bg-zinc-100 text-zinc-500 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-3">
          {activeShift.orderNumbers && activeShift.orderNumbers.length > 0 ? (
            activeShift.orderNumbers.map((order, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-4 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-emerald-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-xs font-black text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pedido</p>
                    <p className="text-sm font-bold text-zinc-900">{order}</p>
                  </div>
                </div>
                <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </motion.div>
            )).reverse()
          ) : (
            <div className="py-12 text-center bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
              <Package className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhum pedido registrado</p>
            </div>
          )}
        </div>
      </section>

      {/* Finish Shift Modal (Inline) */}
      {activeShift && (
        <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h4 className="font-black text-red-900 uppercase text-sm italic tracking-tight">Finalizar Turno</h4>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Encerramento de jornada</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="number" 
                placeholder="KM Final"
                value={km}
                onChange={e => setKm(e.target.value)}
                className="w-full px-6 py-4 bg-white border border-red-200 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Total de Entregas"
                value={deliveries}
                onChange={e => setDeliveries(e.target.value)}
                className="w-full px-6 py-4 bg-white border border-red-200 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
              />
            </div>
            <button 
              onClick={() => onEndShift(Number(km), Number(deliveries))}
              className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95"
            >
              Encerrar e Enviar Relatório
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

import { History, LogOut, Fuel } from 'lucide-react';
