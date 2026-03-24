import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
  deleteDoc,
  addDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Truck, 
  Clock, 
  Camera, 
  Package, 
  Fuel, 
  CheckCircle2, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Trash2,
  MapPin,
  History,
  LayoutDashboard,
  Users,
  X,
  BarChart3,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  MessageSquare,
  Mic,
  Send,
  Image as ImageIcon,
  ShieldCheck,
  Zap,
  Play,
  Car,
  Navigation,
  Bot,
  Sparkles,
  Info,
  Shield,
  UserPlus,
  Trash,
  FileText,
  Settings,
  Activity,
  Share2,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ptBR } from 'date-fns/locale';
import { db, auth } from '../firebase';
import { 
  DriverData, 
  ShiftData, 
  HelpRequest, 
  DriverLocation, 
  OperationType 
} from '../types';
import { handleFirestoreError, formatDate } from '../utils/firestore';
import { ChatView } from './ChatView';
import { FleetMap } from './FleetMap';
import { MapAssistant } from './MapAssistant';
import { NavButton, ActionButton, Input, PhotoCard } from './UI';

export function ManagerView({ 
  showAlert, 
  showConfirm, 
  setView,
  addingOrder,
  setAddingOrder,
  addOrderNumber
}: { 
  showAlert: any, 
  showConfirm: any, 
  setView: any,
  addingOrder: any,
  setAddingOrder: any,
  addOrderNumber: any
}) {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const driversRef = useRef<DriverData[]>([]);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [reports, setReports] = useState<any>({ checklists: [], deliveries: [], expenses: [], helpRequests: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'map' | 'reports' | 'config'>('dashboard');
  const [editingTarget, setEditingTarget] = useState<{shiftId: string, value: string} | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [viewingChecklist, setViewingChecklist] = useState<any>(null);
  const [viewingDelivery, setViewingDelivery] = useState<any>(null);
  const [viewingExpense, setViewingExpense] = useState<any>(null);
  const [authorizedAdmins, setAuthorizedAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isMapAssistantOpen, setIsMapAssistantOpen] = useState(false);

  const allAdmins = useMemo(() => {
    const principalEmail = 'jghjvgcv@gmail.com';
    const list = [...authorizedAdmins];
    const principalIndex = list.findIndex(a => a.email === principalEmail);
    
    if (principalIndex === -1) {
      list.unshift({ id: 'principal', email: principalEmail, isPrincipal: true });
    } else {
      list[principalIndex] = { ...list[principalIndex], isPrincipal: true };
    }
    return list;
  }, [authorizedAdmins]);

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DriverData[];
      setDrivers(data);
      driversRef.current = data;
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    const unsubAuthAdmins = onSnapshot(collection(db, 'authorized_admins'), (snap) => {
      setAuthorizedAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'authorized_admins'));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const unsubShifts = onSnapshot(query(
      collection(db, 'shifts'), 
      where('startTime', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      where('status', 'in', ['active', 'completed'])
    ), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShiftData[]);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));

    const unsubChecklists = onSnapshot(collection(db, 'checklists'), (snap) => {
      setReports((prev: any) => ({ ...prev, checklists: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'checklists'));

    const unsubDeliveries = onSnapshot(collection(db, 'deliveryReports'), (snap) => {
      setReports((prev: any) => ({ ...prev, deliveries: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'deliveryReports'));

    const unsubExpenses = onSnapshot(collection(db, 'expenseReports'), (snap) => {
      setReports((prev: any) => ({ ...prev, expenses: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'expenseReports'));

    const isInitialLoad = { help: true };
    const unsubHelp = onSnapshot(collection(db, 'helpRequests'), (snap) => {
      const newHelpRequests = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpRequest));
      
      setReports((prev: any) => {
        const pendingRequests = newHelpRequests.filter(h => h.status === 'pending');
        const prevPendingCount = prev.helpRequests.filter((h: any) => h.status === 'pending').length;
        
        if (!isInitialLoad.help && pendingRequests.length > prevPendingCount && Notification.permission === 'granted') {
          const latestRequest = pendingRequests[0];
          const driver = driversRef.current.find(d => d.uid === latestRequest.driverId);
          new Notification("🚨 Solicitação de Ajuda", {
            body: `${driver?.name || 'Motorista'} solicitou ajuda: ${latestRequest.message}`,
            icon: '/favicon.ico'
          });
        }
        isInitialLoad.help = false;
        return { ...prev, helpRequests: newHelpRequests };
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'helpRequests'));

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const unsubLocations = onSnapshot(collection(db, 'locations'), (snap) => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'locations'));

    return () => {
      unsubDrivers();
      unsubAuthAdmins();
      unsubShifts();
      unsubChecklists();
      unsubDeliveries();
      unsubExpenses();
      unsubHelp();
      unsubLocations();
    };
  }, []);

  const updateVehicleStatus = async (driverId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'drivers', driverId), { vehicleStatus: status }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `drivers/${driverId}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${driverId}`);
    }
  };

  const updateTarget = async (shiftId: string, value: string) => {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), { targetDeliveries: parseInt(value) || 0 });
      setEditingTarget(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shifts/${shiftId}`);
    }
  };

  const endShift = async (shiftId: string) => {
    showConfirm(
      "Encerrar Turno",
      "Tem certeza que deseja encerrar este turno remotamente?",
      async () => {
        try {
          await updateDoc(doc(db, 'shifts', shiftId), { 
            status: 'completed',
            endTime: serverTimestamp()
          });
          showAlert("Sucesso", "Turno encerrado com sucesso!", "success");
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `shifts/${shiftId}`);
        }
      },
      'danger'
    );
  };

  const sendWhatsAppSummary = (driver: DriverData, shift: ShiftData) => {
    const delivery = reports.deliveries.find((d: any) => d.shiftId === shift.id);
    const expense = reports.expenses.find((e: any) => e.shiftId === shift.id);
    
    const text = `*RESUMO DO TURNO - HF TRANSPORTES*%0A%0A` +
      `👤 *Motorista:* ${driver.name}%0A` +
      `📅 *Data:* ${formatDate(shift.startTime, 'dd/MM/yyyy')}%0A` +
      `⏰ *Início:* ${formatDate(shift.startTime, 'HH:mm')}%0A` +
      `🏁 *Fim:* ${formatDate(shift.endTime, 'HH:mm')}%0A%0A` +
      `📦 *Entregas:* ${delivery?.deliveriesCount || 0}/${shift.targetDeliveries || 0}%0A` +
      `🛣️ *KM Rodados:* ${delivery?.kmEnd - delivery?.kmStart || 0}km%0A` +
      `💰 *Despesas:* R$ ${expense?.totalAmount || 0}%0A%0A` +
      `_Gerado automaticamente pelo Sistema HF_`;
    
    window.open(`https://wa.me/${driver.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const getDeliveryChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return formatDate(d, 'dd/MM');
    }).reverse();

    return last7Days.map(day => {
      const dayDeliveries = reports.deliveries.filter((d: any) => formatDate(d.timestamp, 'dd/MM') === day);
      return {
        name: day,
        entregas: dayDeliveries.reduce((acc: number, curr: any) => acc + (curr.deliveriesCount || 0), 0)
      };
    });
  };

  const getMileageChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return formatDate(d, 'dd/MM');
    }).reverse();

    return last7Days.map(day => {
      const dayDeliveries = reports.deliveries.filter((d: any) => formatDate(d.timestamp, 'dd/MM') === day);
      return {
        name: day,
        km: dayDeliveries.reduce((acc: number, curr: any) => acc + (curr.kmEnd - curr.kmStart || 0), 0)
      };
    });
  };

  const getDailyFlowData = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7h to 18h
    return hours.map(hour => {
      const count = reports.deliveries.filter((d: any) => {
        const date = d.timestamp?.toDate();
        return date && date.getHours() === hour && formatDate(date, 'dd/MM/yyyy') === formatDate(new Date(), 'dd/MM/yyyy');
      }).length;
      return { hour: `${hour}h`, count };
    });
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    const email = newAdminEmail.toLowerCase().trim();
    try {
      await setDoc(doc(db, 'authorized_admins', email), {
        email: email,
        createdAt: serverTimestamp(),
        addedBy: auth.currentUser?.email
      });
      setNewAdminEmail('');
      setIsAddingAdmin(false);
      showAlert("Sucesso", "Administrador autorizado com sucesso!", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `authorized_admins/${email}`);
    }
  };

  const removeAdmin = async (adminId: string) => {
    showConfirm(
      "Remover Administrador",
      "Tem certeza que deseja remover esta autorização?",
      async () => {
        try {
          await deleteDoc(doc(db, 'authorized_admins', adminId));
          showAlert("Sucesso", "Administrador removido com sucesso!", "success");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `authorized_admins/${adminId}`);
        }
      },
      'danger'
    );
  };

  const deleteDriver = async (driverId: string) => {
    showConfirm(
      "Remover Motorista",
      "Tem certeza que deseja remover este motorista do sistema? Esta ação não pode ser desfeita.",
      async () => {
        try {
          await deleteDoc(doc(db, 'drivers', driverId));
          showAlert("Sucesso", "Motorista removido com sucesso!", "success");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `drivers/${driverId}`);
        }
      },
      'danger'
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse">Carregando painel de controle...</p>
      </div>
    );
  }

  const activeShifts = shifts.filter(s => s.status === 'active');
  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const latestShift = selectedDriver ? shifts.find(s => s.driverId === selectedDriver.uid && s.status === 'active') : null;
  const driverChecklist = latestShift ? reports.checklists.find((c: any) => c.shiftId === latestShift.id) : null;
  const driverDelivery = latestShift ? reports.deliveries.find((d: any) => d.shiftId === latestShift.id) : null;
  const driverExpense = latestShift ? reports.expenses.find((e: any) => e.shiftId === latestShift.id) : null;

  const allActions = [
    ...reports.checklists.map((c: any) => ({ ...c, type: 'checklist', label: 'Enviou Checklist' })),
    ...reports.deliveries.map((d: any) => ({ ...d, type: 'delivery', label: 'Relatou Entregas' })),
    ...reports.expenses.map((e: any) => ({ ...e, type: 'expense', label: 'Lançou Despesa' })),
    ...reports.helpRequests.map((h: any) => ({ ...h, type: 'help', label: 'Solicitou Ajuda' }))
  ].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 10);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-zinc-900/40 border border-white/10">
            <Truck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display uppercase">HF Transportes</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Painel Gestor • Monitoramento Real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Live
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1 bg-zinc-100 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'fleet', label: 'Frota', icon: Truck },
          { id: 'map', label: 'Mapa', icon: MapPin },
          { id: 'reports', label: 'Relatórios', icon: FileText },
          { id: 'config', label: 'Config', icon: Settings }
        ].map((tab) => (
          <NavButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Em Rota', value: activeShifts.length, icon: Play, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Entregas Hoje', value: reports.deliveries.filter((d: any) => formatDate(d.timestamp, 'dd/MM/yyyy') === formatDate(new Date(), 'dd/MM/yyyy')).reduce((acc: number, curr: any) => acc + (curr.deliveriesCount || 0), 0), icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Alertas', value: reports.helpRequests.filter((h: any) => h.status === 'pending').length, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
                { label: 'Despesas', value: `R$ ${reports.expenses.filter((e: any) => formatDate(e.timestamp, 'dd/MM/yyyy') === formatDate(new Date(), 'dd/MM/yyyy')).reduce((acc: number, curr: any) => acc + (curr.totalAmount || 0), 0)}`, icon: Fuel, color: 'text-rose-500', bg: 'bg-rose-50' }
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-white rounded-3xl border border-zinc-100 shadow-sm">
                  <div className={`w-10 h-10 ${stat.bg} rounded-2xl flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-zinc-900 tracking-tight italic">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Volume de Entregas
                  </h3>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getDeliveryChartData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f4f4f5' }}
                      />
                      <Bar dataKey="entregas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 bg-white rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Quilometragem Diária
                  </h3>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getMileageChartData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="km" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-zinc-900 rounded-[32px] p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity className="w-32 h-32" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Atividade Recente
              </h3>
              <div className="space-y-4 relative z-10">
                {allActions.map((action: any, i) => {
                  const driver = drivers.find(d => d.uid === action.driverId);
                  return (
                    <div 
                      key={i} 
                      onClick={() => {
                        if (action.type === 'checklist') setViewingChecklist(action);
                        if (action.type === 'delivery') setViewingDelivery(action);
                        if (action.type === 'expense') setViewingExpense(action);
                      }}
                      className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                        action.type === 'help' ? 'bg-rose-500/20 text-rose-400' :
                        action.type === 'delivery' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {action.type === 'help' ? <AlertTriangle className="w-5 h-5" /> :
                         action.type === 'delivery' ? <Package className="w-5 h-5" /> :
                         <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{driver?.name || 'Motorista'}</p>
                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{action.label}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-[10px] font-black text-zinc-500">{formatDate(action.timestamp, 'HH:mm')}</p>
                        <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Ver Detalhes
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'fleet' && (
          <motion.div
            key="fleet"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {drivers.map(driver => {
              const shift = shifts.find(s => s.driverId === driver.uid && s.status === 'active');
              const location = locations.find(l => l.driverId === driver.uid);
              
              return (
                <div 
                  key={driver.id}
                  className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden"
                >
                  <div className="p-5 flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-inner">
                        {driver.photoURL ? (
                          <img src={driver.photoURL} alt={driver.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center ${
                        shift ? 'bg-emerald-500' : 'bg-zinc-300'
                      }`}>
                        <Play className="w-2.5 h-2.5 text-white fill-current" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-black text-zinc-900 truncate tracking-tight">{driver.name}</h3>
                        {shift && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded-full">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Car className="w-3 h-3" />
                        {driver.vehicle || 'Sem veículo'} • {driver.plate || '---'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedDriverId(selectedDriverId === driver.id ? null : driver.id)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          selectedDriverId === driver.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        <ChevronRight className={`w-5 h-5 transition-transform ${selectedDriverId === driver.id ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedDriverId === driver.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-zinc-50/50 border-t border-zinc-100"
                      >
                        <div className="p-5 space-y-6">
                          {shift ? (
                            <>
                              {/* Shift Stats */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-white rounded-2xl border border-zinc-100">
                                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Entregas</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-zinc-900 italic">
                                      {reports.deliveries.find((d: any) => d.shiftId === shift.id)?.deliveriesCount || 0}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-400">/ {shift.targetDeliveries || 0}</span>
                                  </div>
                                </div>
                                <div className="p-3 bg-white rounded-2xl border border-zinc-100">
                                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Início</p>
                                  <p className="text-lg font-black text-zinc-900 italic">{formatDate(shift.startTime, 'HH:mm')}</p>
                                </div>
                                <div className="p-3 bg-white rounded-2xl border border-zinc-100">
                                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status GPS</p>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${location ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    <span className="text-[10px] font-black text-zinc-900 uppercase">{location ? 'Online' : 'Offline'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="grid grid-cols-2 gap-3">
                                <ActionButton
                                  onClick={() => setView({ type: 'chat', driverId: driver.uid })}
                                  icon={MessageSquare}
                                  label="Abrir Chat"
                                  variant="secondary"
                                />
                                <ActionButton
                                  onClick={() => endShift(shift.id)}
                                  icon={LogOut}
                                  label="Encerrar Turno"
                                  variant="danger"
                                />
                              </div>

                              {/* Target Editor */}
                              <div className="p-4 bg-white rounded-2xl border border-zinc-100">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Meta de Entregas</p>
                                {editingTarget?.shiftId === shift.id ? (
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      value={editingTarget.value}
                                      onChange={(val: string) => setEditingTarget({ ...editingTarget, value: val })}
                                      placeholder="Nova meta"
                                    />
                                    <button 
                                      onClick={() => updateTarget(shift.id, editingTarget.value)}
                                      className="px-4 bg-emerald-500 text-white rounded-xl font-bold text-xs"
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setEditingTarget({ shiftId: shift.id, value: String(shift.targetDeliveries || 0) })}
                                    className="w-full flex items-center justify-between p-2 hover:bg-zinc-50 rounded-xl transition-colors"
                                  >
                                    <span className="text-sm font-bold text-zinc-900">{shift.targetDeliveries || 0} entregas</span>
                                    <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                                  </button>
                                )}
                              </div>

                              {/* Bulk Order Input */}
                              <div className="p-4 bg-zinc-900 rounded-2xl text-white">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Enviar Pedidos</p>
                                  <Package className="w-4 h-4 text-emerald-400" />
                                </div>
                                {addingOrder?.shiftId === shift.id ? (
                                  <div className="space-y-3">
                                    <textarea 
                                      autoFocus
                                      placeholder="Cole os números dos pedidos separados por vírgula..."
                                      className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-emerald-500 transition-all resize-none"
                                      value={addingOrder.value}
                                      onChange={e => setAddingOrder({ ...addingOrder, value: e.target.value })}
                                    />
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => addOrderNumber(shift.id, addingOrder.value)}
                                        className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"
                                      >
                                        Enviar Agora
                                      </button>
                                      <button 
                                        onClick={() => setAddingOrder(null)}
                                        className="px-4 py-3 bg-white/10 text-zinc-400 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setAddingOrder({ shiftId: shift.id, value: '' })}
                                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Adicionar Pedidos em Lote
                                  </button>
                                )}
                              </div>

                              {/* Quick Checklist View */}
                              {reports.checklists.find((c: any) => c.shiftId === shift.id) && (
                                <button 
                                  onClick={() => setViewingChecklist(reports.checklists.find((c: any) => c.shiftId === shift.id))}
                                  className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-emerald-100 hover:bg-emerald-100 transition-all"
                                >
                                  <Camera className="w-4 h-4" />
                                  Ver Fotos do Checklist
                                </button>
                              )}

                              <button 
                                onClick={() => deleteDriver(driver.id)}
                                className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-rose-100 hover:bg-rose-100 transition-all mt-4"
                              >
                                <Trash className="w-4 h-4" />
                                Excluir Motorista
                              </button>
                            </>
                          ) : (
                            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-zinc-200 space-y-4">
                              <div className="space-y-2">
                                <Clock className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                                <p className="text-xs font-bold text-zinc-500">Motorista fora de serviço no momento</p>
                              </div>
                              
                              <button 
                                onClick={() => deleteDriver(driver.id)}
                                className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-rose-100 hover:bg-rose-100 transition-all"
                              >
                                <Trash className="w-4 h-4" />
                                Excluir Motorista
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="h-[calc(100vh-280px)] min-h-[400px] bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden relative"
          >
            <FleetMap drivers={drivers} locations={locations} focusedDriverId={focusedDriverId} />
            
            {/* Map Assistant Trigger */}
            <button
              onClick={() => setIsMapAssistantOpen(true)}
              className="absolute bottom-6 right-6 w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-zinc-900/40 border border-white/10 z-[1000] hover:scale-110 transition-transform active:scale-95"
            >
              <Bot className="w-6 h-6 text-emerald-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900 animate-pulse" />
            </button>

            <MapAssistant 
              isOpen={isMapAssistantOpen} 
              onClose={() => setIsMapAssistantOpen(false)}
              location={locations[0] ? { latitude: locations[0].latitude, longitude: locations[0].longitude } : undefined}
            />
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Reports List */}
            <div className="space-y-4">
              {shifts.filter(s => s.status === 'completed').sort((a, b) => (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0)).map(shift => {
                const driver = drivers.find(d => d.uid === shift.driverId);
                const delivery = reports.deliveries.find((d: any) => d.shiftId === shift.id);
                const expense = reports.expenses.find((e: any) => e.shiftId === shift.id);
                const checklist = reports.checklists.find((c: any) => c.shiftId === shift.id);

                return (
                  <div key={shift.id} className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                          <h4 className="font-black text-zinc-900 tracking-tight">{driver?.name || 'Motorista'}</h4>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            {formatDate(shift.startTime, 'dd/MM/yyyy')} • {formatDate(shift.startTime, 'HH:mm')} - {formatDate(shift.endTime, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => sendWhatsAppSummary(driver!, shift)}
                        className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-zinc-50 rounded-2xl">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Entregas</p>
                        <p className="text-sm font-black text-zinc-900 italic">{delivery?.deliveriesCount || 0}/{shift.targetDeliveries || 0}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-2xl">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">KM Total</p>
                        <p className="text-sm font-black text-zinc-900 italic">{delivery ? delivery.kmEnd - delivery.kmStart : 0}km</p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-2xl">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Despesas</p>
                        <p className="text-sm font-black text-zinc-900 italic">R$ {expense?.totalAmount || 0}</p>
                      </div>
                    </div>

                    {checklist && (
                      <button 
                        onClick={() => setViewingChecklist(checklist)}
                        className="w-full py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Ver Checklist Completo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Admin Management */}
            <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Gestão de Administradores
                </h3>
                <button 
                  onClick={() => setIsAddingAdmin(!isAddingAdmin)}
                  className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center"
                >
                  {isAddingAdmin ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              {isAddingAdmin && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mb-6 space-y-3"
                >
                  <Input
                    type="email"
                    placeholder="E-mail do novo administrador"
                    value={newAdminEmail}
                    onChange={(val: string) => setNewAdminEmail(val)}
                    icon={Mail}
                  />
                  <ActionButton
                    onClick={addAdmin}
                    label="Autorizar E-mail"
                    icon={UserPlus}
                  />
                </motion.div>
              )}

              <div className="space-y-3">
                {allAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${admin.isPrincipal ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{admin.email}</p>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          {admin.isPrincipal ? 'Administrador Principal' : 'Acesso Autorizado'}
                        </p>
                      </div>
                    </div>
                    {!admin.isPrincipal && (
                      <button 
                        onClick={() => removeAdmin(admin.id)}
                        className="w-8 h-8 text-rose-500 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* System Info */}
            <div className="bg-zinc-900 rounded-[32px] p-6 text-white">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4">Informações do Sistema</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 font-bold uppercase">Versão</span>
                  <span className="font-mono">v2.4.0-pro</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 font-bold uppercase">Status do Servidor</span>
                  <span className="text-emerald-400 font-bold uppercase">Operacional</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 font-bold uppercase">Último Backup</span>
                  <span className="font-mono">{formatDate(new Date(), 'dd/MM HH:mm')}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist Modal */}
      <AnimatePresence>
        {viewingChecklist && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight italic">Checklist de Veículo</h3>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Relatório de Inspeção</p>
                </div>
                <button 
                  onClick={() => setViewingChecklist(null)}
                  className="w-10 h-10 bg-white text-zinc-400 rounded-2xl flex items-center justify-center shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8 no-scrollbar">
                {/* Status Grid */}
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Nível de Óleo', status: viewingChecklist.oilStatus, photo: viewingChecklist.oilPhoto },
                    { label: 'Painel (KM/Luzes)', status: viewingChecklist.dashboardStatus, photo: viewingChecklist.dashboardPhoto },
                    { label: 'Estado dos Pneus', status: viewingChecklist.tireStatus, photo: viewingChecklist.tirePhoto }
                  ].map((item, i) => (
                    <div key={i} className="bg-zinc-50 rounded-[2rem] border border-zinc-100 overflow-hidden">
                      <div className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{item.label}</p>
                          <div className="flex items-center gap-2">
                            {item.status === 'ok' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-600 uppercase">Normal</span>
                              </>
                            ) : item.status === 'attention' ? (
                              <>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-xs font-bold text-amber-600 uppercase">Atenção</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                                <span className="text-xs font-bold text-rose-600 uppercase">Crítico</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="w-16 h-16 bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                          {item.photo ? (
                            <img 
                              src={item.photo} 
                              alt={item.label} 
                              className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" 
                              onClick={() => window.open(item.photo, '_blank')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-5 h-5 text-zinc-200" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {viewingChecklist.observations && (
                  <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Observações do Motorista</p>
                    <p className="text-sm font-medium text-amber-900 leading-relaxed">{viewingChecklist.observations}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delivery Modal */}
      <AnimatePresence>
        {viewingDelivery && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight italic">Relatório de Entregas</h3>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resumo de Atividade</p>
                </div>
                <button 
                  onClick={() => setViewingDelivery(null)}
                  className="w-10 h-10 bg-white text-zinc-400 rounded-2xl flex items-center justify-center shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Entregas</p>
                    <p className="text-4xl font-black text-emerald-700 italic">{viewingDelivery.deliveriesCount || 0}</p>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 text-center">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">KM Rodados</p>
                    <p className="text-4xl font-black text-blue-700 italic">{viewingDelivery.kmEnd - viewingDelivery.kmStart || 0}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">KM Inicial</span>
                    <span className="text-sm font-bold text-zinc-900">{viewingDelivery.kmStart}</span>
                  </div>
                  <div className="flex justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">KM Final</span>
                    <span className="text-sm font-bold text-zinc-900">{viewingDelivery.kmEnd}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {viewingExpense && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight italic">Relatório de Despesas</h3>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lançamento Financeiro</p>
                </div>
                <button 
                  onClick={() => setViewingExpense(null)}
                  className="w-10 h-10 bg-white text-zinc-400 rounded-2xl flex items-center justify-center shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="p-8 bg-rose-50 rounded-[2.5rem] border border-rose-100 text-center">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Valor Total</p>
                  <p className="text-5xl font-black text-rose-700 italic">R$ {viewingExpense.totalAmount || 0}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Combustível</span>
                    <span className="text-sm font-bold text-zinc-900">R$ {viewingExpense.fuel || 0}</span>
                  </div>
                  <div className="flex justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pedágio</span>
                    <span className="text-sm font-bold text-zinc-900">R$ {viewingExpense.toll || 0}</span>
                  </div>
                  <div className="flex justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Manutenção</span>
                    <span className="text-sm font-bold text-zinc-900">R$ {viewingExpense.maintenance || 0}</span>
                  </div>
                </div>

                {viewingExpense.receiptPhoto && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Comprovante</p>
                    <div className="w-full aspect-video rounded-3xl overflow-hidden border border-zinc-100 shadow-sm">
                      <img 
                        src={viewingExpense.receiptPhoto} 
                        alt="Comprovante" 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => window.open(viewingExpense.receiptPhoto, '_blank')}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
