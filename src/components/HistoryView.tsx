import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History, Truck, Clock, Package, CheckCircle2, ChevronRight, Fuel, MapPin, Trash2 } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ShiftData, OperationType } from '../types';
import { handleFirestoreError, formatDate } from '../utils/firestore';

export function HistoryView({ driverId, showAlert, showConfirm }: { driverId: string, showAlert: any, showConfirm: any }) {
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'shifts'), 
      where('driverId', '==', driverId),
      orderBy('startTime', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ShiftData[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'shifts'));
  }, [driverId]);

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Registro",
      "Tem certeza que deseja excluir este registro de turno?",
      async () => {
        try {
          await deleteDoc(doc(db, 'shifts', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `shifts/${id}`));
          showAlert("Sucesso", "Registro excluído com sucesso!", 'success');
        } catch (error) {
          console.error(error);
        }
      },
      'danger'
    );
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 py-6"
    >
      <div className="flex items-center gap-4 px-2">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <History className="w-6 h-6 text-zinc-900" />
        </div>
        <div>
          <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">Histórico de Rotas</h3>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Últimos 20 registros</p>
        </div>
      </div>

      <div className="space-y-4">
        {shifts.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
            <History className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhum registro encontrado</p>
          </div>
        ) : (
          shifts.map((shift, idx) => (
            <motion.div 
              key={shift.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <Truck className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{formatDate(shift.startTime, 'dd/MM/yyyy')}</p>
                    <p className="text-sm font-bold text-zinc-900">{formatDate(shift.startTime, 'HH:mm')} - {shift.endTime ? formatDate(shift.endTime, 'HH:mm') : 'Em andamento'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(shift.id)}
                  className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Entregas</p>
                  <p className="text-sm font-black text-zinc-900">{shift.total_entregas || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">KM Rodados</p>
                  <p className="text-sm font-black text-zinc-900">{(shift.quilometragem_final || 0) - (shift.quilometragem_inicial || 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</p>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    shift.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {shift.status === 'completed' ? 'Finalizado' : 'Ativo'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
