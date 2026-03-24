import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError, compressImage } from '../utils/firestore';
import { PhotoCard } from './UI';

export function ChecklistView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [photos, setPhotos] = useState<any>({
    oil: null,
    dashboard: null,
    tire: null
  });
  const [status, setStatus] = useState<any>({
    oil: 'ok',
    dashboard: 'ok',
    tire: 'ok'
  });
  const [loading, setLoading] = useState(false);

  const handlePhoto = async (type: string, file: File) => {
    try {
      const base64 = await compressImage(file);
      setPhotos((prev: any) => ({ ...prev, [type]: base64 }));
    } catch (error) {
      showAlert("Erro", "Erro ao processar imagem.", 'error');
    }
  };

  const handleSubmit = async () => {
    if (!photos.oil || !photos.dashboard || !photos.tire) {
      showAlert("Atenção", "Por favor, tire todas as fotos obrigatórias.", 'info');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'checklists'), {
        shiftId: shiftId || 'pre-shift',
        driverId,
        oilPhoto: photos.oil,
        dashboardPhoto: photos.dashboard,
        tirePhoto: photos.tire,
        oilStatus: status.oil,
        dashboardStatus: status.dashboard,
        tireStatus: status.tire,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'checklists'));
      
      showAlert("Sucesso", "Checklist realizado com sucesso!", 'success');
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
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tighter uppercase italic">Checklist Diário</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Segurança e Manutenção</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Oil Check */}
          <div className="space-y-4">
            <PhotoCard label="Nível de Óleo / Motor" photo={photos.oil} onTake={(f) => handlePhoto('oil', f)} />
            <div className="flex gap-2">
              {['ok', 'attention', 'critical'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setStatus((prev: any) => ({ ...prev, oil: s }))}
                  className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                    status.oil === s 
                      ? "bg-zinc-900 text-white border-zinc-900" 
                      : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100"
                  }`}
                >
                  {s === 'ok' ? 'Normal' : s === 'attention' ? 'Atenção' : 'Crítico'}
                </button>
              ))}
            </div>
          </div>

          {/* Dashboard Check */}
          <div className="space-y-4">
            <PhotoCard label="Painel (KM e Luzes)" photo={photos.dashboard} onTake={(f) => handlePhoto('dashboard', f)} />
            <div className="flex gap-2">
              {['ok', 'attention', 'critical'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setStatus((prev: any) => ({ ...prev, dashboard: s }))}
                  className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                    status.dashboard === s 
                      ? "bg-zinc-900 text-white border-zinc-900" 
                      : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100"
                  }`}
                >
                  {s === 'ok' ? 'Normal' : s === 'attention' ? 'Atenção' : 'Crítico'}
                </button>
              ))}
            </div>
          </div>

          {/* Tires Check */}
          <div className="space-y-4">
            <PhotoCard label="Estado dos Pneus" photo={photos.tire} onTake={(f) => handlePhoto('tire', f)} />
            <div className="flex gap-2">
              {['ok', 'attention', 'critical'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setStatus((prev: any) => ({ ...prev, tire: s }))}
                  className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                    status.tire === s 
                      ? "bg-zinc-900 text-white border-zinc-900" 
                      : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100"
                  }`}
                >
                  {s === 'ok' ? 'Normal' : s === 'attention' ? 'Atenção' : 'Crítico'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
        >
          {loading ? 'Enviando...' : 'Finalizar Checklist'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
