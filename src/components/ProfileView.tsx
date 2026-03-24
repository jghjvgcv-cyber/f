import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Phone, Hash, Truck, LogOut, ChevronRight, Edit2, CheckCircle2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DriverProfile, OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';

export function ProfileView({ profile, onLogout, showAlert }: { profile: DriverProfile, onLogout: any, showAlert: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState({
    name: profile.name || '',
    phone: profile.phone || '',
    vehicle: profile.vehicle || '',
    plate: profile.plate || ''
  });
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'drivers', profile.id), {
        ...data,
        updatedAt: new Date()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `drivers/${profile.id}`));
      
      setIsEditing(false);
      showAlert("Sucesso", "Perfil atualizado com sucesso!", 'success');
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
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center shadow-xl shadow-zinc-900/20 relative group">
            <User className="w-10 h-10 text-white" />
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase italic">{profile.name}</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">ID: {profile.code}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
              <input 
                type="text" 
                value={data.name}
                disabled={!isEditing}
                onChange={e => setData({...data, name: e.target.value})}
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Telefone</label>
              <input 
                type="text" 
                value={data.phone}
                disabled={!isEditing}
                onChange={e => setData({...data, phone: e.target.value})}
                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-70"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Veículo</label>
                <input 
                  type="text" 
                  value={data.vehicle}
                  disabled={!isEditing}
                  onChange={e => setData({...data, vehicle: e.target.value})}
                  className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Placa</label>
                <input 
                  type="text" 
                  value={data.plate}
                  disabled={!isEditing}
                  onChange={e => setData({...data, plate: e.target.value})}
                  className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <button 
              onClick={handleUpdate}
              disabled={loading}
              className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
              <CheckCircle2 className="w-5 h-5" />
            </button>
          )}

          <div className="pt-8 border-t border-zinc-100">
            <button 
              onClick={onLogout}
              className="w-full py-6 bg-zinc-50 text-zinc-400 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              Sair da Conta
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
