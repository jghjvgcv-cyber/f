import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Package, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';

export function DeliveriesView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [data, setData] = useState({
    received: '',
    delivered: '',
    returned: '',
    total: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!data.received || !data.delivered || !data.returned || !data.total) {
      showAlert("Atenção", "Por favor, preencha todos os campos do relatório.", 'info');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'deliveryReports'), {
        shiftId,
        driverId,
        received: Number(data.received),
        delivered: Number(data.delivered),
        returned: Number(data.returned),
        total: Number(data.total),
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'deliveryReports'));
      
      showAlert("Sucesso", "Relatório de entregas enviado!", 'success');
      onComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 py-6"
    >
      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-2xl shadow-zinc-900/5 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <Package className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">Relatório de Entregas</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Controle de Produtividade</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Recebidas</label>
            <input 
              type="number" 
              value={data.received}
              onChange={e => setData({...data, received: e.target.value})}
              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Realizadas</label>
            <input 
              type="number" 
              value={data.delivered}
              onChange={e => setData({...data, delivered: e.target.value})}
              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Devolvidas</label>
            <input 
              type="number" 
              value={data.returned}
              onChange={e => setData({...data, returned: e.target.value})}
              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Total Geral</label>
            <input 
              type="number" 
              value={data.total}
              onChange={e => setData({...data, total: e.target.value})}
              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? 'Enviando...' : 'Finalizar Relatório'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
