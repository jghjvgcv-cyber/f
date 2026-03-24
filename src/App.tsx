import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  getDocFromServer,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { 
  Truck, 
  LogOut, 
  AlertTriangle,
  LayoutDashboard,
  History,
  CheckCircle2,
  Package,
  Fuel,
  MessageSquare,
  User as UserIcon,
  ShieldCheck,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

// Import refactored components
import { DashboardView } from './components/DashboardView';
import { RegistrationView } from './components/RegistrationView';
import { ChecklistView } from './components/ChecklistView';
import { DeliveriesView } from './components/DeliveriesView';
import { ExpensesView } from './components/ExpensesView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { ManagerView } from './components/ManagerView';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';
import { DriverData, ShiftData, OperationType } from './types';
import { handleFirestoreError } from './utils/firestore';

// --- Constants ---
const ADMIN_EMAIL = "jghjvgcv@gmail.com";

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    try {
      const info = JSON.parse(error.message);
      return { hasError: true, errorInfo: info };
    } catch {
      return { hasError: true, errorInfo: { error: error.message || 'Ocorreu um erro inesperado.' } };
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">Ops! Algo deu errado</h2>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                {this.state.errorInfo?.error || 'Não foi possível completar a operação no momento.'}
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null);
  const [hasDoneChecklist, setHasDoneChecklist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'checklist' | 'deliveries' | 'expenses' | 'history' | 'profile' | 'manager' | 'chat'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [plateLogin, setPlateLogin] = useState({ plate: '', password: '' });
  const [loginMode, setLoginMode] = useState<'google' | 'plate'>('google');
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  const [addingOrder, setAddingOrder] = useState<{shiftId: string, value: string} | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const addOrderNumber = async (shiftId: string, orderInput: string) => {
    if (!orderInput) return;
    try {
      const shiftDoc = await getDoc(doc(db, 'shifts', shiftId)).catch(e => handleFirestoreError(e, OperationType.GET, `shifts/${shiftId}`));
      if (!shiftDoc || !shiftDoc.exists()) return;
      
      const newOrders = orderInput.split(',').map(o => o.trim()).filter(o => o !== '');
      const currentOrders = shiftDoc.data().orderNumbers || [];
      
      await updateDoc(doc(db, 'shifts', shiftId), { 
        orderNumbers: [...currentOrders, ...newOrders] 
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `shifts/${shiftId}`));
      setAddingOrder(null);
    } catch (error) {
      console.error(error);
    }
  };

  const registerDriver = async (data: Omit<DriverData, 'uid' | 'vehicleStatus' | 'id'>) => {
    if (!user) return;
    const driverData: DriverData = { ...data, uid: user.uid, vehicleStatus: 'operational', id: user.uid };
    try {
      await setDoc(doc(db, 'drivers', user.uid), driverData).catch(e => handleFirestoreError(e, OperationType.WRITE, `drivers/${user.uid}`));
      setDriver(driverData);
    } catch (error) {
      console.error("Error registering driver:", error);
    }
  };

  const endShift = async (quilometragem_final: number, total_entregas: number) => {
    if (!activeShift || !driver) return;
    try {
      await updateDoc(doc(db, 'shifts', activeShift.id), {
        endTime: serverTimestamp(),
        quilometragem_final,
        total_entregas,
        status: 'completed'
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `shifts/${activeShift.id}`));
      
      setActiveShift(null);
      setHasDoneChecklist(false);
      setView('dashboard');
    } catch (error) {
      console.error(error);
    }
  };

  const talkToManager = async () => {
    if (!driver) return;
    try {
      await addDoc(collection(db, 'helpRequests'), {
        driverId: driver.uid,
        message: 'Preciso falar com o gestor sobre a rota atual.',
        status: 'pending',
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'helpRequests'));
      showAlert("Sucesso", "Solicitação enviada ao gestor!", 'success');
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao enviar solicitação.", 'error');
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' = 'info') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection')).catch(e => handleFirestoreError(e, OperationType.GET, 'test/connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchDriverData(currentUser.uid);
        fetchActiveShift(currentUser.uid);
        
        // Check admin status
        if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        } else if (currentUser.email) {
          const authAdminDoc = await getDoc(doc(db, 'authorized_admins', currentUser.email.toLowerCase())).catch(e => handleFirestoreError(e, OperationType.GET, `authorized_admins/${currentUser.email}`));
          if (authAdminDoc.exists()) {
            setIsAdmin(true);
          }
        }
      } else {
        setUser(null);
        setDriver(null);
        setIsAdmin(false);
        setActiveShift(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  const fetchDriverData = async (uid: string) => {
    const docSnap = await getDoc(doc(db, 'drivers', uid)).catch(e => handleFirestoreError(e, OperationType.GET, `drivers/${uid}`));
    if (docSnap.exists()) {
      setDriver({ id: docSnap.id, ...docSnap.data() } as DriverData);
    }
  };

  const fetchActiveShift = (uid: string) => {
    const q = query(collection(db, 'shifts'), where('driverId', '==', uid), where('status', '==', 'active'));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveShift({ id: snap.docs[0].id, ...snap.docs[0].data() } as ShiftData);
      } else {
        setActiveShift(null);
      }
    });
  };

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error: any) {
      console.error(error);
      showAlert("Erro de Login", "Não foi possível entrar com Google.", 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithPlate = async () => {
    if (!plateLogin.plate) {
      showAlert("Atenção", "Por favor, informe a placa do veículo.", 'info');
      return;
    }

    // If password is provided, it must match the plate
    if (plateLogin.password && plateLogin.plate !== plateLogin.password) {
      showAlert("Erro", "A senha deve ser a mesma placa do veículo.", 'error');
      return;
    }

    setIsLoggingIn(true);
    try {
      const authResult = await signInAnonymously(auth);
      const plate = plateLogin.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const q = query(collection(db, 'drivers'), where('plate', '==', plate));
      const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'drivers'));
      
      if (!snap.empty) {
        const driverDoc = snap.docs[0];
        await updateDoc(doc(db, 'drivers', driverDoc.id), { uid: authResult.user.uid });
        setDriver({ id: driverDoc.id, ...driverDoc.data(), uid: authResult.user.uid } as DriverData);
        setUser(authResult.user);
        localStorage.setItem('plateLogin', plate);
      } else {
        // If not found, we still set the user so they can see the RegistrationView
        setUser(authResult.user);
        localStorage.setItem('plateLogin', plate);
        showAlert("Novo Motorista", "Placa não encontrada. Por favor, complete seu cadastro.", 'info');
      }
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao entrar com placa. Verifique sua conexão.", 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('plateLogin');
    setUser(null);
    setDriver(null);
    setView('dashboard');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-600"></div></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">HF Transportes</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Gestão de Logística Inteligente</p>
          </div>

          <div className="bg-zinc-900 p-1 rounded-2xl flex gap-1">
            <button onClick={() => setLoginMode('google')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'google' ? 'bg-white text-black' : 'text-zinc-500'}`}>Google</button>
            <button onClick={() => setLoginMode('plate')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'plate' ? 'bg-white text-black' : 'text-zinc-500'}`}>Placa</button>
          </div>

          {loginMode === 'google' ? (
            <button onClick={login} disabled={isLoggingIn} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-100 transition-all">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Placa do Veículo</p>
                <input 
                  type="text" 
                  placeholder="ABC1234" 
                  value={plateLogin.plate} 
                  onChange={e => setPlateLogin({...plateLogin, plate: e.target.value.toUpperCase()})} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold focus:border-emerald-500 outline-none transition-all" 
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Senha (Repita a Placa)</p>
                <input 
                  type="password" 
                  placeholder="MESMA PLACA" 
                  value={plateLogin.password} 
                  onChange={e => setPlateLogin({...plateLogin, password: e.target.value.toUpperCase()})} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold focus:border-emerald-500 outline-none transition-all" 
                />
              </div>
              <button onClick={loginWithPlate} disabled={isLoggingIn} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20">
                {isLoggingIn ? 'Entrando...' : 'Acessar Sistema'}
              </button>
              <p className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                Dica: A senha inicial é a própria placa do seu veículo.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!driver && !isAdmin) {
    return (
      <RegistrationView 
        onRegister={registerDriver} 
        onLogout={logout} 
        showAlert={showAlert} 
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 font-sans">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          view={view} 
          setView={setView} 
          isAdmin={isAdmin} 
          onLogout={logout} 
          driverName={driver?.name}
        />

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100 px-6 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-zinc-50 rounded-xl transition-colors group"
              id="open-sidebar-btn"
            >
              <Menu className="w-6 h-6 text-zinc-900 group-hover:scale-110 transition-transform" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-black text-zinc-900 uppercase text-xs italic tracking-tight">HF <span className="text-emerald-500">Transportes</span></h1>
            </div>

            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        <main className="max-w-lg mx-auto p-6">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <DashboardView 
                driver={driver!} 
                activeShift={activeShift} 
                onStartShift={(km) => setView('checklist')} 
                onEndShift={endShift}
                onNavigate={setView}
                hasDoneChecklist={hasDoneChecklist}
                onTalkToManager={talkToManager}
                currentLocation={currentLocation}
                showAlert={showAlert}
                showConfirm={showConfirm}
                addingOrder={addingOrder}
                setAddingOrder={setAddingOrder}
                addOrderNumber={addOrderNumber}
              />
            )}
            {view === 'checklist' && <ChecklistView driverId={driver!.uid} shiftId={activeShift?.id} showAlert={showAlert} onComplete={() => { setHasDoneChecklist(true); setView('dashboard'); }} onCancel={() => setView('dashboard')} />}
            {view === 'deliveries' && <DeliveriesView driverId={driver!.uid} shiftId={activeShift?.id} showAlert={showAlert} onComplete={() => setView('dashboard')} onCancel={() => setView('dashboard')} />}
            {view === 'expenses' && <ExpensesView driverId={driver!.uid} shiftId={activeShift?.id} showAlert={showAlert} onComplete={() => setView('dashboard')} onCancel={() => setView('dashboard')} />}
            {view === 'history' && <HistoryView driverId={driver!.uid} showAlert={showAlert} showConfirm={showConfirm} />}
            {view === 'profile' && <ProfileView profile={driver as any} onLogout={logout} showAlert={showAlert} />}
            {view === 'chat' && <ChatView driverId={driver!.uid} user={user} isAdmin={isAdmin} />}
            {view === 'manager' && isAdmin && (
              <ManagerView 
                showAlert={showAlert} 
                showConfirm={showConfirm} 
                setView={setView}
                addingOrder={addingOrder}
                setAddingOrder={setAddingOrder}
                addOrderNumber={addOrderNumber}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Modals */}
        <AnimatePresence>
          {confirmModal.isOpen && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tight">{confirmModal.title}</h3>
                <p className="text-zinc-500 text-sm font-medium">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                  <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className={`flex-1 py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest ${confirmModal.type === 'danger' ? 'bg-rose-500' : 'bg-emerald-500'}`}>Confirmar</button>
                </div>
              </motion.div>
            </div>
          )}
          {alertModal.isOpen && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tight">{alertModal.title}</h3>
                <p className="text-zinc-500 text-sm font-medium">{alertModal.message}</p>
                <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">OK</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
