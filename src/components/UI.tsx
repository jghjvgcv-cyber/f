import React from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Input({ label, value, onChange, type = "text", placeholder, icon: Icon }: any) {
  return (
    <div className="space-y-2">
      {label && <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />}
        <input 
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full py-4 bg-zinc-50 border border-zinc-200 rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-zinc-900 placeholder:text-zinc-300",
            Icon ? "pl-14 pr-6" : "px-6"
          )}
        />
      </div>
    </div>
  );
}

export function ActionButton({ icon: Icon, label, onClick, color, variant = 'primary' }: any) {
  const variants = {
    primary: "bg-white text-zinc-900 border-zinc-100 hover:border-emerald-500",
    secondary: "bg-zinc-50 text-zinc-600 border-zinc-100 hover:bg-zinc-900 hover:text-white",
    danger: "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-500 hover:text-white",
  };

  const iconColors = {
    primary: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white",
    secondary: "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-800 group-hover:text-white",
    danger: "bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-[2.5rem] border shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all gap-4 group",
        variants[variant as keyof typeof variants] || variants.primary,
        color
      )}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
        iconColors[variant as keyof typeof iconColors] || iconColors.primary
      )}>
        <Icon className="w-7 h-7 transition-colors" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-center leading-tight">{label}</span>
    </button>
  );
}

export function PhotoCard({ label, photo, onTake }: { label?: string, photo?: string, onTake?: (file: File) => void }) {
  const id = React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onTake) {
      onTake(file);
    }
  };

  return (
    <div className="space-y-3">
      {label && <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{label}</p>}
      <div className="relative group">
        {onTake && (
          <input 
            type="file" 
            id={id}
            onChange={handleChange} 
            accept="image/*" 
            capture="environment"
            className="hidden" 
          />
        )}
        <label 
          htmlFor={onTake ? id : undefined}
          className={cn(
            "block w-full aspect-video rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden relative",
            onTake ? "cursor-pointer" : "cursor-default",
            photo 
              ? "border-emerald-500 bg-emerald-50" 
              : "border-zinc-200 bg-zinc-50 hover:border-emerald-300 hover:bg-emerald-50/30"
          )}
        >
          {photo ? (
            <>
              <img src={photo} alt={label || "Foto"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              {onTake && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-zinc-300 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-300">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {onTake ? 'Clique para fotografar' : 'Sem foto disponível'}
              </p>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}

import { motion } from 'motion/react';

export function NavButton({ active, icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 transition-all relative group py-1",
        active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all duration-300",
        active ? "bg-emerald-500/10 scale-110" : "group-hover:bg-white/5"
      )}>
        <Icon className={cn("w-5 h-5", active && "stroke-[2.5px]")} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.15em]">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full"
        />
      )}
    </button>
  );
}
