import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Truck, ChevronRight, LogOut } from 'lucide-react';
import { Input } from './UI';

export function RegistrationView({ onRegister, onLogout, showAlert }: { onRegister: (data: any) => void, onLogout: () => void, showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [data, setData] = useState({
    name: '',
    code: '',
    plate: '',
    vehicle: '',
    phone: ''
  });

  const handleSubmit = () => {
    if (!data.name || !data.code || !data.plate || !data.vehicle) {
      showAlert("Atenção", "Por favor, preencha todos os campos obrigatórios.", 'info');
      return;
    }
    onRegister(data);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10 space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <Truck className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">Cadastro de Motorista</h2>
          <p className="text-zinc-500 text-sm font-medium">Complete seu perfil para acessar o sistema.</p>
        </div>

        <div className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
          <Input label="Nome Completo" value={data.name} onChange={(v: string) => setData({...data, name: v})} placeholder="Ex: João Silva" />
          <Input label="Código do Motorista" value={data.code} onChange={(v: string) => setData({...data, code: v})} placeholder="Ex: MOT-123" />
          <Input label="Placa do Veículo" value={data.plate} onChange={(v: string) => setData({...data, plate: v.toUpperCase()})} placeholder="ABC-1234" />
          <Input label="Modelo do Veículo" value={data.vehicle} onChange={(v: string) => setData({...data, vehicle: v})} placeholder="Ex: Fiat Fiorino" />
          <Input label="WhatsApp" value={data.phone} onChange={(v: string) => setData({...data, phone: v})} placeholder="Ex: 5531999999999" />
          
          <button 
            onClick={handleSubmit}
            className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 group mt-4"
          >
            Finalizar Cadastro
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <button 
          onClick={onLogout}
          className="w-full py-4 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-3 h-3" />
          Sair da Conta
        </button>
      </motion.div>
    </div>
  );
}
