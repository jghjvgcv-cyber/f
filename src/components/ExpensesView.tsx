import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Fuel, Camera, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError, compressImage } from '../utils/firestore';
import { PhotoCard } from './UI';

export function ExpensesView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [data, setData] = useState({
    fuel: '',
    toll: '',
    maintenance: '',
    receiptPhoto: null as string | null
  });
  const [loading, setLoading] = useState(false);

  const handlePhoto = async (file: File) => {
    try {
      const base64 = await compressImage(file);
      setData(prev => ({ ...prev, receiptPhoto: base64 }));
    } catch (error) {
      showAlert("Erro", "Erro ao processar imagem.", 'error');
    }
  };

  const handleSubmit = async () => {
    if (!data.receiptPhoto) {
      showAlert("Atenção", "Por favor, tire uma foto do comprovante.", 'info');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'expenseReports'), {
        shiftId,
        driverId,
        fuel: Number(data.fuel) || 0,
        toll: Number(data.toll) || 0,
        maintenance: Number(data.maintenance) || 0,
        totalAmount: (Number(data.fuel) || 0) + (Number(data.toll) || 0) + (Number(data.maintenance) || 0),
        receiptPhoto: data.receiptPhoto,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'expenseReports'));
      
      showAlert("Sucesso", "Despesas enviadas com sucesso!", 'success');
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
            <Fuel className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">Relatório de Despesas</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Controle de Custos</p>
          </div>
        </div>

        <div className="space-y-6">
          <PhotoCard label="Foto do Comprovante" photo={data.receiptPhoto || undefined} onTake={handlePhoto} />

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Combustível (R$)</label>
              <input 
                type="number" 
                value={data.fuel}
                onChange={e => setData({...data, fuel: e.target.value})}
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Pedágio (R$)</label>
              <input 
                type="number" 
                value={data.toll}
                onChange={e => setData({...data, toll: e.target.value})}
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Manutenção (R$)</label>
              <input 
                type="number" 
                value={data.maintenance}
                onChange={e => setData({...data, maintenance: e.target.value})}
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xl font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? 'Enviando...' : 'Finalizar Despesas'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
