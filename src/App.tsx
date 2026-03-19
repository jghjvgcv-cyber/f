/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  orderBy,
  limit,
  deleteDoc,
  writeBatch
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
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { queryMapAssistant } from './services/geminiService';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface DriverData {
  name: string;
  code: string;
  plate: string;
  vehicle: string;
  uid: string;
  phone?: string;
  vehicleStatus: 'operational' | 'maintenance_required' | 'out_of_service';
}

interface ShiftData {
  id: string;
  driverId: string;
  startTime: any;
  endTime?: any;
  quilometragem_inicial?: number;
  quilometragem_final?: number;
  total_entregas?: number;
  targetDeliveries?: number;
  status: 'active' | 'completed';
  date: string;
}

interface HelpRequest {
  id: string;
  driverId: string;
  message: string;
  status: 'pending' | 'resolved';
  timestamp: any;
}

interface Message {
  id?: string;
  driverId: string;
  senderId: string;
  text?: string;
  photo?: string;
  audio?: string;
  timestamp: any;
}

interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  timestamp: any;
  status: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    providerInfo: any[];
  }
}

// --- Constants ---
const ADMIN_EMAIL = "jghjvgcv@gmail.com";

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  return new Error(JSON.stringify(errInfo));
};

// --- Helpers ---
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

const formatDate = (date: any, formatStr: string, options?: any) => {
  if (!date) return '---';
  try {
    const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
    return format(d, formatStr, options);
  } catch (e) {
    return '---';
  }
};

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('{"error":')) {
        setHasError(true);
        try {
          const info = JSON.parse(event.error.message) as FirestoreErrorInfo;
          setErrorMsg(`Erro de permissão no Firestore: ${info.operationType} em ${info.path}`);
        } catch {
          setErrorMsg('Ocorreu um erro inesperado no banco de dados.');
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-50 mx-auto mb-4 bg-red-500 rounded-full p-2" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ops! Algo deu errado</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Recarregar Aplicativo
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null);
  const [hasDoneChecklist, setHasDoneChecklist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'checklist' | 'deliveries' | 'expenses' | 'history' | 'profile' | 'manager'>('dashboard');
  const [plateLogin, setPlateLogin] = useState({ plate: '', password: '' });
  const [loginMode, setLoginMode] = useState<'google' | 'plate'>('google');
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null);
  const [isMapAssistantOpen, setIsMapAssistantOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' = 'info') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  // --- Auth & Initial Data ---
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    let unsubscribeShift: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.uid);
      
      if (currentUser) {
        setUser(currentUser);
        setIsAuthReady(true);
        
        // Cleanup previous shift listener if it exists
        if (unsubscribeShift) {
          unsubscribeShift();
          unsubscribeShift = undefined;
        }

        await fetchDriverData(currentUser.uid);
        unsubscribeShift = fetchActiveShift(currentUser.uid);
        
        // Check if admin
        const adminEmails = ["jghjvgcv@gmail.com"]; // Add more emails here if needed
        
        if (currentUser.email && (adminEmails.includes(currentUser.email) || adminEmails.includes(currentUser.email.toLowerCase()))) {
          setIsAdmin(true);
          console.log("Admin status set to true (hardcoded email)");
        } else if (currentUser.email) {
          try {
            // Check authorized_admins collection as the source of truth
            const authAdminDoc = await getDoc(doc(db, 'authorized_admins', currentUser.email.toLowerCase()));
            if (authAdminDoc.exists()) {
              setIsAdmin(true);
              console.log("Admin status set to true (Firestore authorized_admins)");
              
              // Also update users collection to persist role for other checks if needed
              await setDoc(doc(db, 'users', currentUser.uid), {
                email: currentUser.email,
                role: 'admin',
                lastLogin: serverTimestamp()
              }, { merge: true });
            } else {
              setIsAdmin(false);
              // Clean up role in users collection if it was there
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              if (userDoc.exists() && userDoc.data().role === 'admin') {
                await setDoc(doc(db, 'users', currentUser.uid), {
                  role: 'user'
                }, { merge: true });
              }
            }
          } catch (e) {
            console.error("Error checking admin status:", e);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setDriver(null);
        setIsAdmin(false);
        setActiveShift(null);
        setHasDoneChecklist(false);
        setView('dashboard');
      }
      setLoading(false);
      setIsAuthReady(true);
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeShift) unsubscribeShift();
    };
  }, []);

  // Location Tracking for Drivers
  useEffect(() => {
    if (!driver || !activeShift) return;

    let watchId: number;

    const updateLocation = async (position: GeolocationPosition) => {
      if (!user) return;
      const { latitude, longitude } = position.coords;
      setCurrentLocation({ driverId: user.uid, latitude, longitude, timestamp: new Date(), status: 'active' } as any);
      const path = `locations/${user.uid}`;
      try {
        await setDoc(doc(db, 'locations', user.uid), {
          driverId: user.uid,
          latitude,
          longitude,
          timestamp: serverTimestamp(),
          status: 'active'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    };

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        updateLocation,
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [driver, activeShift]);

  const fetchDriverData = async (uid: string) => {
    try {
      const docRef = doc(db, 'drivers', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDriver(docSnap.data() as DriverData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `drivers/${uid}`);
    }
  };

  const fetchActiveShift = (uid: string) => {
    const q = query(
      collection(db, 'shifts'), 
      where('driverId', '==', uid), 
      where('status', '==', 'active')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const shiftDoc = querySnapshot.docs[0];
        setActiveShift({ id: shiftDoc.id, ...shiftDoc.data() } as ShiftData);
      } else {
        setActiveShift(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });
  };

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-blocked') {
        showAlert("Erro de Login", "O popup de login foi bloqueado pelo navegador. Por favor, permita popups para este site.", 'error');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore, user just closed the popup or another one was opened
      } else {
        showAlert("Erro de Login", "Erro ao entrar com Google. Tente novamente.", 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithPlate = async () => {
    if (!plateLogin.plate || !plateLogin.password) {
      showAlert("Atenção", "Por favor, preencha a placa e a senha.", 'info');
      return;
    }
    
    if (plateLogin.plate !== plateLogin.password) {
      showAlert("Erro", "A senha deve ser igual à placa do veículo.", 'error');
      return;
    }

    setIsLoggingIn(true);
    try {
      // 1. Sign in anonymously to have a Firebase Auth session
      const authResult = await signInAnonymously(auth);
      const anonUser = authResult.user;

      // 2. Search for driver by plate
      const q = query(collection(db, 'drivers'), where('plate', '==', plateLogin.plate.toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // No driver found with this plate, they might need to register
        // We'll set the user so they can see the RegistrationView
        setUser(anonUser);
        localStorage.setItem('plateLogin', plateLogin.plate);
      } else {
        const driverDoc = snap.docs[0];
        const driverData = { id: driverDoc.id, ...driverDoc.data() } as any;
        
        // Update driver UID to current anonymous UID to ensure permissions work
        if (driverData.uid !== anonUser.uid) {
          await updateDoc(doc(db, 'drivers', driverDoc.id), {
            uid: anonUser.uid
          });
          driverData.uid = anonUser.uid;
        }

        setDriver(driverData);
        setUser(anonUser);
        unsubscribeShift = fetchActiveShift(driverData.uid);
        localStorage.setItem('plateLogin', plateLogin.plate);
      }
    } catch (error: any) {
      console.error('Plate login error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        showAlert("Erro de Configuração", "O login anônimo não está ativado no Firebase Console. Por favor, ative-o em Authentication > Sign-in method.", 'error');
      } else {
        showAlert("Erro de Login", "Erro ao fazer login com placa. Verifique sua conexão ou se o login anônimo está ativado no Firebase.", 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  let unsubscribeShift: (() => void) | undefined;

  useEffect(() => {
    const savedPlate = localStorage.getItem('plateLogin');
    if (savedPlate && !user) {
      setPlateLogin({ plate: savedPlate, password: savedPlate });
      setLoginMode('plate');
      // Auto login could be here but we need to fetch driver data
    }
  }, []);

  const updateDriver = async (data: Partial<DriverData>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'drivers', user.uid), data);
      setDriver(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `drivers/${user.uid}`);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('plateLogin');
      setUser(null);
      setDriver(null);
      setIsAdmin(false);
      setActiveShift(null);
      setHasDoneChecklist(false);
      setView('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // --- Actions ---
  const registerDriver = async (data: Omit<DriverData, 'uid' | 'vehicleStatus'>) => {
    if (!user) return;
    const driverData = { ...data, uid: user.uid, vehicleStatus: 'operational' };
    try {
      await setDoc(doc(db, 'drivers', user.uid), driverData);
      setDriver(driverData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `drivers/${user.uid}`);
    }
  };

  const startShift = async (quilometragem_inicial: number) => {
    if (!user || !driver) return;
    
    // Safety check: ensure checklist was done
    if (!hasDoneChecklist) {
      showAlert("Atenção", "Você precisa realizar o checklist antes de iniciar a jornada.", 'info');
      setView('checklist');
      return;
    }

    const newShift = {
      driverId: user.uid,
      startTime: serverTimestamp(),
      quilometragem_inicial,
      status: 'active',
      targetDeliveries: 0,
      date: format(new Date(), 'yyyy-MM-dd')
    };
    try {
      const docRef = await addDoc(collection(db, 'shifts'), newShift);
      setActiveShift({ id: docRef.id, ...newShift } as any);
      setView('dashboard');
      // We don't reset hasDoneChecklist here anymore, we reset it on endShift or logout
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shifts');
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
      });
      
      const summary = `*Relatório Final de Jornada*\n` +
        `Motorista: ${driver.name}\n` +
        `Veículo: ${driver.vehicle} (${driver.plate})\n` +
        `KM Inicial: ${activeShift.quilometragem_inicial}\n` +
        `KM Final: ${quilometragem_final}\n` +
        `Total Entregas: ${total_entregas}\n` +
        `Meta: ${activeShift.targetDeliveries || 0}\n` +
        `Status: Finalizado`;
      
      notifyManager(summary);
      
      setActiveShift(null);
      setHasDoneChecklist(false);
      setView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shifts/${activeShift.id}`);
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
      });
      showAlert("Sucesso", "Solicitação enviada ao gestor!", 'success');
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao enviar solicitação.", 'error');
    }
  };

  // --- Views ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden relative font-sans">
        {/* Immersive Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row z-10">
          {/* Left Side: Editorial Branding */}
          <div className="flex-1 flex flex-col justify-center px-8 lg:px-20 py-12 lg:py-0">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
                <Truck className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">HF Transportes e Aluguéis</span>
              </div>
              
              <h1 className="text-7xl lg:text-9xl font-black tracking-tighter leading-[0.85] mb-6 uppercase">
                HF<br />
                <span className="text-emerald-500">Transportes</span>
              </h1>
              
              <p className="text-zinc-400 text-lg lg:text-xl max-w-md font-medium leading-relaxed">
                Aluguéis de carrinhas e gestão de logística inteligente. A próxima geração em gestão de frotas.
              </p>
            </motion.div>
          </div>

          {/* Right Side: Login Form */}
          <div className="w-full lg:w-[480px] bg-zinc-900/50 backdrop-blur-3xl border-l border-white/5 flex flex-col justify-center px-8 lg:px-12 py-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full max-w-sm mx-auto"
            >
              <div className="mb-10">
                <h2 className="text-2xl font-bold mb-2">Bem-vindo de volta</h2>
                <p className="text-zinc-500 text-sm">Escolha seu método de acesso preferido.</p>
              </div>

              <div className="bg-white/5 p-1 rounded-2xl flex gap-1 mb-8">
                <button 
                  onClick={() => setLoginMode('google')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    loginMode === 'google' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                  )}
                >
                  Motorista (Google)
                </button>
                <button 
                  onClick={() => setLoginMode('plate')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    loginMode === 'plate' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                  )}
                >
                  Placa do Veículo
                </button>
              </div>
              
              {loginMode === 'google' && (
                <button 
                  onClick={login}
                  disabled={isLoggingIn}
                  className="w-full py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-white/5 disabled:opacity-50 group"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                  {isLoggingIn ? 'Autenticando...' : 'Entrar com Google'}
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {loginMode === 'plate' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Placa do Veículo</label>
                    <input 
                      type="text"
                      placeholder="ABC-1234"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all uppercase placeholder:text-zinc-700"
                      value={plateLogin.plate}
                      onChange={(e) => setPlateLogin({ ...plateLogin, plate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Senha (Placa)</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all uppercase placeholder:text-zinc-700"
                      value={plateLogin.password}
                      onChange={(e) => setPlateLogin({ ...plateLogin, password: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={loginWithPlate}
                    disabled={isLoggingIn}
                    className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isLoggingIn ? 'Autenticando...' : 'Acessar Sistema'}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-white/5 text-center">
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
                  © 2026 HF Transportes e Aluguéis • Versão 3.0
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!driver && !isAdmin) {
    return <RegistrationView onRegister={registerDriver} onLogout={logout} showAlert={showAlert} />;
  }

  const displayDriver = driver || { name: 'Administrador', plate: 'PAINEL', vehicle: 'GESTOR', uid: user?.uid || '' };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 pb-24 font-sans">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 sticky top-0 z-30">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg shadow-zinc-900/10">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-black text-zinc-900 leading-tight uppercase tracking-tight text-sm italic tracking-tighter">HF Transportes</h2>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase tracking-wider">{displayDriver.plate}</span>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{displayDriver.vehicle}</span>
                </div>
              </div>
            </div>
            <button onClick={logout} className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              driver ? (
                <DashboardView 
                  driver={driver} 
                  activeShift={activeShift} 
                  onStartShift={startShift} 
                  onEndShift={endShift}
                  onNavigate={setView}
                  hasDoneChecklist={hasDoneChecklist}
                  onTalkToManager={talkToManager}
                  currentLocation={currentLocation}
                  showAlert={showAlert}
                  showConfirm={showConfirm}
                />
              ) : (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 mb-2">Bem-vindo, Gestor</h2>
                  <p className="text-zinc-500 mb-8">Você está logado como administrador. Use o menu abaixo para gerenciar sua equipe.</p>
                  <button 
                    onClick={() => setView('manager')}
                    className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                  >
                    Ir para Painel da Equipe
                  </button>
                </div>
              )
            )}
            {view === 'checklist' && driver && (
              <ChecklistView 
                shiftId={activeShift?.id} 
                driverId={driver.uid} 
                onComplete={() => {
                  if (!activeShift) setHasDoneChecklist(true);
                  setView('dashboard');
                }} 
                showAlert={showAlert}
              />
            )}
            {view === 'deliveries' && activeShift && driver && (
              <DeliveriesView shiftId={activeShift.id} driverId={driver.uid} onComplete={() => setView('dashboard')} showAlert={showAlert} />
            )}
            {view === 'expenses' && activeShift && driver && (
              <ExpensesView shiftId={activeShift.id} driverId={driver.uid} onComplete={() => setView('dashboard')} showAlert={showAlert} />
            )}
            {view === 'history' && driver && (
              <HistoryView driverId={driver.uid} showAlert={showAlert} showConfirm={showConfirm} />
            )}
            {view === 'profile' && (
              <ProfileView 
                driver={displayDriver} 
                user={user!} 
                onLogout={logout} 
                onUpdateDriver={updateDriver}
              />
            )}
            {view === 'manager' && isAdmin && (
              <ManagerView showAlert={showAlert} showConfirm={showConfirm} />
            )}
          </AnimatePresence>
        </main>

        {/* Floating Map Assistant Button */}
        <button 
          onClick={() => setIsMapAssistantOpen(true)}
          className="fixed bottom-28 right-6 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
        >
          <Bot className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-900 rounded-full flex items-center justify-center">
            <Sparkles className="w-2 h-2 text-emerald-400 animate-pulse" />
          </div>
        </button>

        <MapAssistant 
          isOpen={isMapAssistantOpen} 
          onClose={() => setIsMapAssistantOpen(false)} 
          location={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : undefined}
        />

        {/* Bottom Navigation */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-4 py-3 z-30 rounded-[2rem] shadow-2xl shadow-black/20">
          <div className="flex items-center justify-around">
            <NavButton active={view === 'dashboard'} icon={LayoutDashboard} label="Início" onClick={() => setView('dashboard')} />
            {driver && (
              <NavButton active={view === 'history'} icon={History} label="Histórico" onClick={() => setView('history')} />
            )}
            {isAdmin && (
              <NavButton active={view === 'manager'} icon={Users} label="Equipe" onClick={() => setView('manager')} />
            )}
            <NavButton active={view === 'profile'} icon={UserIcon} label="Perfil" onClick={() => setView('profile')} />
          </div>
        </nav>

        {/* Alert Modal */}
        {alertModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                alertModal.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
                alertModal.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-zinc-50 text-zinc-500'
              }`}>
                {alertModal.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : 
                 alertModal.type === 'error' ? <AlertCircle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-black text-zinc-900 text-center mb-2 italic font-display">{alertModal.title}</h3>
              <p className="text-zinc-500 text-center text-sm font-medium mb-8 leading-relaxed">{alertModal.message}</p>
              <button 
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-900/20"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                confirmModal.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-zinc-50 text-zinc-500'
              }`}>
                {confirmModal.type === 'danger' ? <AlertTriangle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-black text-zinc-900 text-center mb-2 italic font-display">{confirmModal.title}</h3>
              <p className="text-zinc-500 text-center text-sm font-medium mb-8 leading-relaxed">{confirmModal.message}</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }}
                  className={`py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                    confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/20'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function RegistrationView({ onRegister, onLogout, showAlert }: { onRegister: (data: any) => void, onLogout: () => void, showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [formData, setFormData] = useState({ name: '', code: '', plate: '', vehicle: '' });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col p-8 font-sans">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="mb-12 text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-5 bg-emerald-500/10 rounded-[2rem] mb-6 border border-emerald-500/20"
          >
            <Users className="w-10 h-10 text-emerald-600" />
          </motion.div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-3 uppercase">Bem-vindo!</h1>
          <p className="text-zinc-500 font-medium text-sm">Complete seu cadastro para começar a trabalhar na HF Transportes.</p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-zinc-200/50 border border-zinc-100 space-y-8"
        >
          <Input label="Nome Completo" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} placeholder="Ex: João Silva" />
          <Input label="Código do Motorista" value={formData.code} onChange={(v: string) => setFormData({...formData, code: v})} placeholder="Ex: MOT-123" />
          <Input label="Placa do Veículo" value={formData.plate} onChange={(v: string) => setFormData({...formData, plate: v})} placeholder="Ex: ABC-1234" />
          <Input label="Modelo do Veículo" value={formData.vehicle} onChange={(v: string) => setFormData({...formData, vehicle: v})} placeholder="Ex: Fiat Fiorino" />
          
          <button 
            onClick={() => onRegister(formData)}
            disabled={!formData.name || !formData.code || !formData.plate || !formData.vehicle}
            className="w-full py-6 bg-zinc-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] mt-4 hover:bg-zinc-800 transition-all shadow-2xl shadow-zinc-900/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            Finalizar Cadastro
          </button>
        </motion.div>
        
        <button onClick={onLogout} className="mt-12 text-zinc-400 font-black text-[10px] uppercase tracking-[0.3em] hover:text-zinc-600 transition-colors">
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function DriverMap({ location }: { location: DriverLocation | null }) {
  if (!location) return null;

  return (
    <div className="bg-white p-4 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 overflow-hidden">
      <div className="h-[200px] w-full rounded-[2.5rem] overflow-hidden border border-zinc-100 relative z-0">
        <MapContainer center={[location.latitude, location.longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={[location.latitude, location.longitude]}>
            <Popup>Você está aqui</Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="mt-4 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">GPS Ativo</span>
        </div>
        <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">
          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

function DashboardView({ driver, activeShift, onStartShift, onEndShift, onNavigate, hasDoneChecklist, onTalkToManager, currentLocation, showAlert, showConfirm }: any) {
  const [km, setKm] = useState('');
  const [finalKm, setFinalKm] = useState('');
  const [entregas, setEntregas] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Status Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-xl border border-white/5">
            <Truck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-zinc-900 leading-none tracking-tighter uppercase italic">HF Transportes</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">
              Olá, {driver.name.split(' ')[0]} • {activeShift ? 'Em Rota' : 'Indisponível'}
            </p>
          </div>
        </div>
        <div className={cn(
          "w-3 h-3 rounded-full animate-pulse",
          activeShift ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-zinc-300"
        )} />
      </div>

      {/* Real-time Map for Driver */}
      {activeShift && currentLocation && (
        <DriverMap location={currentLocation} />
      )}

      {/* Main Status Card */}
      <div className={cn(
        "relative overflow-hidden p-8 rounded-[3rem] border transition-all duration-700 shadow-2xl shadow-zinc-200/50",
        activeShift 
          ? "bg-zinc-950 border-white/5 text-white" 
          : "bg-white border-zinc-100 text-zinc-900"
      )}>
        {activeShift && (
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        )}
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div className={cn(
              "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2.5",
              activeShift ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500"
            )}>
              <div className={cn("w-2 h-2 rounded-full", activeShift ? "bg-white animate-pulse" : "bg-zinc-300")} />
              {activeShift ? 'Em Rota' : 'Indisponível'}
            </div>
            {activeShift && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-xl border border-white/10">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  {formatDate(activeShift.startTime, 'HH:mm')}
                </span>
              </div>
            )}
          </div>

          {!activeShift ? (
            <div className="space-y-10">
              {!hasDoneChecklist ? (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h4 className="text-xl font-black tracking-tight">Checklist Pendente</h4>
                    <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                      Realize a inspeção do veículo para garantir sua segurança antes de iniciar.
                    </p>
                  </div>
                  <button 
                    onClick={() => onNavigate('checklist')}
                    className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-zinc-800 active:scale-95 transition-all shadow-2xl shadow-zinc-900/20 group"
                  >
                    <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Iniciar Checklist
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-10"
                >
                  <div className="flex items-center gap-4 px-6 py-4 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                    <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Veículo Verificado</span>
                      <span className="text-xs font-bold text-emerald-800">Checklist concluído com sucesso</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] ml-2">Odômetro Inicial</label>
                    <div className="relative group">
                      <input 
                        type="number" 
                        value={km} 
                        onChange={(e) => setKm(e.target.value)} 
                        placeholder="000.000"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-[2rem] px-10 py-6 text-3xl font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-zinc-200"
                      />
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-300 font-black text-xs uppercase tracking-widest">KM</div>
                    </div>
                  </div>
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      boxShadow: km ? "0 25px 50px -12px rgba(16, 185, 129, 0.5)" : "0 0 0px rgba(0,0,0,0)"
                    }}
                    whileHover={km ? { scale: 1.02, backgroundColor: '#059669' } : {}}
                    whileTap={km ? { scale: 0.98 } : {}}
                    onClick={() => onStartShift(Number(km))}
                    disabled={!km}
                    className="w-full py-7 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                  >
                    Abrir Jornada
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 space-y-3">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Meta de Hoje</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-emerald-400 tracking-tighter">{activeShift.targetDeliveries || 0}</span>
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">unid</span>
                  </div>
                </div>
                <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 space-y-3">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">KM Inicial</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tracking-tight">{activeShift.quilometragem_inicial?.toLocaleString()}</span>
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">km</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Pedidos Designados</p>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{activeShift.orderNumbers?.length || 0} Ativos</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeShift.orderNumbers?.length > 0 ? (
                    activeShift.orderNumbers.map((order: string, idx: number) => (
                      <motion.div 
                        key={idx}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black text-emerald-400 uppercase tracking-widest shadow-xl"
                      >
                        #{order}
                      </motion.div>
                    ))
                  ) : (
                    <div className="px-6 py-8 bg-white/5 border border-dashed border-white/10 rounded-[2rem] w-full flex flex-col items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-zinc-700" />
                      </div>
                      <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] text-center">Aguardando pedidos...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Actions */}
      {activeShift && (
        <div className="grid grid-cols-2 gap-4">
          <ActionButton 
            icon={Package} 
            label="Relatar Entregas" 
            onClick={() => onNavigate('deliveries')} 
            color="bg-white"
          />
          <ActionButton 
            icon={Fuel} 
            label="Lançar Despesa" 
            onClick={() => onNavigate('expenses')} 
            color="bg-white"
          />
        </div>
      )}

      {/* End Shift Section */}
      {activeShift && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Finalizar Jornada</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400">KM Final</label>
              <input 
                type="number" 
                value={finalKm} 
                onChange={(e) => setFinalKm(e.target.value)} 
                placeholder="000.000"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400">Total Entregas</label>
              <input 
                type="number" 
                value={entregas} 
                onChange={(e) => setEntregas(e.target.value)} 
                placeholder="0"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <button 
            onClick={() => onEndShift(Number(finalKm), Number(entregas))}
            disabled={!finalKm || !entregas}
            className="w-full py-5 bg-red-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-lg disabled:opacity-50"
          >
            <LogOut className="w-6 h-6" />
            Encerrar e Enviar Resumo
          </button>
        </div>
      )}

      {/* Help Button */}
      <button 
        onClick={onTalkToManager}
        className="w-full py-4 border-2 border-dashed border-zinc-200 text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:border-zinc-300 hover:text-zinc-500 transition-all"
      >
        <AlertCircle className="w-4 h-4" />
        Preciso de ajuda / Falar com Gestor
      </button>
    </motion.div>
  );
}

const MANAGER_PHONE = '553184715702';

const notifyManager = (message: string) => {
  const url = `https://wa.me/${MANAGER_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

function StatusSelector({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  const options = [
    { label: 'OK', color: 'bg-emerald-500', value: 'ok', icon: CheckCircle2 },
    { label: 'Atenção', color: 'bg-amber-500', value: 'attention', icon: AlertTriangle },
    { label: 'Crítico', color: 'bg-red-500', value: 'critical', icon: AlertCircle }
  ];

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{label}</p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 flex flex-col items-center gap-1 border-2",
                isActive 
                  ? `${opt.color} text-white border-transparent shadow-lg shadow-${opt.color.split('-')[1]}-500/20 scale-[1.02]` 
                  : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-zinc-200"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-zinc-300")} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [photos, setPhotos] = useState<{ [key: string]: string }>({});
  const [status, setStatus] = useState({ oil: 'ok', dashboard: 'ok', tire: 'ok' });
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1);

  const handlePhoto = async (key: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string);
      setPhotos(prev => ({ ...prev, [key]: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!photos.oil || !photos.dashboard || !photos.tire) {
      showAlert("Atenção", "Por favor, tire todas as fotos antes de salvar.", 'info');
      return;
    }

    setUploading(true);
    try {
      await addDoc(collection(db, 'checklists'), {
        shiftId: shiftId || 'pre-shift',
        driverId,
        oilStatus: status.oil,
        dashboardStatus: status.dashboard,
        tireStatus: status.tire,
        oilPhoto: photos.oil,
        dashboardPhoto: photos.dashboard,
        tirePhoto: photos.tire,
        timestamp: serverTimestamp()
      });
      
      onComplete();
    } catch (error) {
      const handledError = handleFirestoreError(error, OperationType.CREATE, 'checklists');
      console.error("Erro ao salvar checklist:", handledError);
      showAlert("Erro", "Erro ao enviar checklist. Verifique sua conexão ou permissões.", 'error');
    } finally {
      setUploading(false);
    }
  };

  const steps = [
    { id: 1, title: 'Motor & Óleo', key: 'oil', label: 'Nível do Óleo' },
    { id: 2, title: 'Painel & Elétrica', key: 'dashboard', label: 'Painel / Luzes' },
    { id: 3, title: 'Pneus & Segurança', key: 'tire', label: 'Pneus / Calibragem' }
  ];

  const currentStep = steps[step - 1];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onComplete} 
            className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-zinc-100 hover:bg-zinc-50 active:scale-90 transition-all"
          >
            <ChevronRight className="w-5 h-5 rotate-180 text-zinc-400" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display">Checklist</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Inspeção Obrigatória</p>
          </div>
        </div>
        <div className="flex gap-1">
          {steps.map((s) => (
            <div 
              key={s.id} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                step === s.id ? "w-8 bg-emerald-500" : step > s.id ? "w-4 bg-emerald-200" : "w-4 bg-zinc-100"
              )} 
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 space-y-8 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50" />
            
            <div className="flex items-center gap-5 mb-2 relative">
              <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg shadow-zinc-900/20">
                <span className="text-2xl font-black text-emerald-400">{step}</span>
              </div>
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{currentStep.title}</h3>
            </div>

            <div className="space-y-8 relative">
              <StatusSelector 
                label={currentStep.label} 
                value={(status as any)[currentStep.key]} 
                onChange={(v) => setStatus({...status, [currentStep.key]: v})} 
              />
              
              <PhotoCard 
                label={`Foto do ${currentStep.title}`} 
                photo={(photos as any)[currentStep.key]} 
                onTake={(file: File) => handlePhoto(currentStep.key, file)} 
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-4">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="flex-1 py-5 bg-zinc-100 text-zinc-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all"
          >
            Voltar
          </button>
        )}
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={!(photos as any)[currentStep.key]}
            className="flex-[2] py-6 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-2xl shadow-zinc-900/20 disabled:opacity-50 active:scale-95"
          >
            Próximo Passo
          </button>
        ) : (
          <button 
            onClick={save}
            disabled={!photos.oil || !photos.dashboard || !photos.tire || uploading}
            className="flex-[2] py-6 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/30 disabled:opacity-50 active:scale-95"
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </div>
            ) : (
              "Finalizar Checklist"
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function DeliveriesView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [data, setData] = useState({ received: '', delivered: '', pending: '' });
  const [shift, setShift] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchShift = async () => {
      const s = await getDoc(doc(db, 'shifts', shiftId));
      if (s.exists()) setShift(s.data());
    };
    fetchShift();
  }, [shiftId]);

  const save = async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'deliveryReports'), {
        shiftId,
        driverId,
        received: Number(data.received),
        delivered: Number(data.delivered),
        pending: Number(data.pending),
        timestamp: serverTimestamp()
      });
      
      onComplete();
    } catch (error) {
      const handledError = handleFirestoreError(error, OperationType.CREATE, 'deliveryReports');
      console.error(handledError);
      showAlert("Erro", "Erro ao salvar relatório. Verifique suas permissões.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={onComplete} 
          className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-zinc-100 hover:bg-zinc-50 active:scale-90 transition-all"
        >
          <ChevronRight className="w-5 h-5 rotate-180 text-zinc-400" />
        </button>
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display">Entregas</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Fluxo de Carga</p>
        </div>
      </div>

      {shift?.targetDeliveries && (
        <div className="bg-zinc-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Package className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Meta do Dia</p>
            <div className="flex items-baseline gap-2">
              <p className="text-6xl font-black text-emerald-400 leading-none tracking-tighter">{shift.targetDeliveries}</p>
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Entregas</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500/20">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="h-full bg-emerald-500"
            />
          </div>
        </div>
      )}

      <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 space-y-8">
        <Input label="Entregas Recebidas" type="number" value={data.received} onChange={(v: string) => setData({...data, received: v})} placeholder="0" />
        <Input label="Entregas Realizadas" type="number" value={data.delivered} onChange={(v: string) => setData({...data, delivered: v})} placeholder="0" />
        <Input label="Entregas Pendentes" type="number" value={data.pending} onChange={(v: string) => setData({...data, pending: v})} placeholder="0" />
      </div>

      <button 
        onClick={save}
        disabled={saving}
        className="w-full py-6 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/30 disabled:opacity-50 active:scale-95"
      >
        {saving ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Salvando...
          </div>
        ) : "Salvar Relatório"}
      </button>
    </motion.div>
  );
}

function ExpensesView({ shiftId, driverId, onComplete, showAlert }: any) {
  const [data, setData] = useState({ fuel: '', toll: '', maintenance: '', photo: '' });
  const [saving, setSaving] = useState(false);

  const handlePhoto = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string);
      setData(prev => ({ ...prev, photo: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!data.photo) {
      showAlert("Atenção", "Por favor, tire a foto do comprovante.", 'info');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'expenseReports'), {
        shiftId,
        driverId,
        fuel: Number(data.fuel),
        toll: Number(data.toll),
        maintenance: Number(data.maintenance),
        receiptPhoto: data.photo,
        timestamp: serverTimestamp()
      });
      
      onComplete();
    } catch (error) {
      const handledError = handleFirestoreError(error, OperationType.CREATE, 'expenseReports');
      console.error(handledError);
      showAlert("Erro", "Erro ao salvar despesa. Verifique suas permissões.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={onComplete} 
          className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-zinc-100 hover:bg-zinc-50 active:scale-90 transition-all"
        >
          <ChevronRight className="w-5 h-5 rotate-180 text-zinc-400" />
        </button>
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display">Despesas</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Gestão de Custos</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 space-y-10">
        <div className="space-y-6">
          <Input label="Combustível (R$)" type="number" value={data.fuel} onChange={(v: string) => setData({...data, fuel: v})} placeholder="0,00" />
          <Input label="Pedágio (R$)" type="number" value={data.toll} onChange={(v: string) => setData({...data, toll: v})} placeholder="0,00" />
          <Input label="Manutenção (R$)" type="number" value={data.maintenance} onChange={(v: string) => setData({...data, maintenance: v})} placeholder="0,00" />
        </div>

        <div className="pt-8 border-t border-zinc-50">
          <PhotoCard 
            label="Foto do Comprovante" 
            photo={data.photo} 
            onTake={handlePhoto} 
          />
        </div>
      </div>

      <button 
        onClick={save}
        disabled={saving}
        className="w-full py-6 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/30 disabled:opacity-50 active:scale-95"
      >
        {saving ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Salvando...
          </div>
        ) : "Lançar Despesa"}
      </button>
    </motion.div>
  );
}

function HistoryView({ driverId, showAlert, showConfirm }: { driverId: string, showAlert: any, showConfirm: any }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'shifts'), 
      where('driverId', '==', driverId),
      where('status', 'in', ['active', 'completed'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data.sort((a: any, b: any) => {
        const timeA = a.startTime?.seconds || 0;
        const timeB = b.startTime?.seconds || 0;
        return timeB - timeA;
      }));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));
    return () => unsubscribe();
  }, [driverId]);

  const clearHistory = async () => {
    showConfirm(
      "Limpar Histórico",
      "Tem certeza que deseja limpar todo o seu histórico de jornadas? Esta ação é irreversível.",
      async () => {
        setClearing(true);
        try {
          const batch = writeBatch(db);
          
          // Delete shifts
          const shiftsSnap = await getDocs(query(collection(db, 'shifts'), where('driverId', '==', driverId)));
          shiftsSnap.docs.forEach(d => batch.delete(d.ref));
          
          // Delete related reports
          const checklistsSnap = await getDocs(query(collection(db, 'checklists'), where('driverId', '==', driverId)));
          checklistsSnap.docs.forEach(d => batch.delete(d.ref));
          
          const deliveriesSnap = await getDocs(query(collection(db, 'deliveryReports'), where('driverId', '==', driverId)));
          deliveriesSnap.docs.forEach(d => batch.delete(d.ref));
          
          const expensesSnap = await getDocs(query(collection(db, 'expenseReports'), where('driverId', '==', driverId)));
          expensesSnap.docs.forEach(d => batch.delete(d.ref));
          
          await batch.commit();
          showAlert("Sucesso", "Histórico limpo com sucesso!", 'success');
        } catch (error) {
          console.error("Error clearing history:", error);
          showAlert("Erro", "Erro ao limpar histórico. Verifique suas permissões.", 'error');
        } finally {
          setClearing(false);
        }
      },
      'danger'
    );
  };

  const deleteShift = async (shiftId: string) => {
    showConfirm(
      "Excluir Jornada",
      "Tem certeza que deseja excluir esta jornada?",
      async () => {
        try {
          const batch = writeBatch(db);
          
          // Delete the shift
          batch.delete(doc(db, 'shifts', shiftId));
          
          // Delete related reports (checklists, deliveries, expenses)
          const checklistsSnap = await getDocs(query(collection(db, 'checklists'), where('shiftId', '==', shiftId), where('driverId', '==', driverId)));
          checklistsSnap.docs.forEach(d => batch.delete(d.ref));
          
          const deliveriesSnap = await getDocs(query(collection(db, 'deliveryReports'), where('shiftId', '==', shiftId), where('driverId', '==', driverId)));
          deliveriesSnap.docs.forEach(d => batch.delete(d.ref));
          
          const expensesSnap = await getDocs(query(collection(db, 'expenseReports'), where('shiftId', '==', shiftId), where('driverId', '==', driverId)));
          expensesSnap.docs.forEach(d => batch.delete(d.ref));
          
          await batch.commit();
        } catch (error) {
          console.error("Error deleting shift:", error);
          showAlert("Erro", "Erro ao excluir jornada.", 'error');
        }
      },
      'danger'
    );
  };

  const totals = history.reduce((acc, curr) => {
    if (curr.status === 'completed') {
      acc.deliveries += (curr.total_entregas || 0);
      if (curr.quilometragem_final && curr.quilometragem_inicial) {
        acc.km += (curr.quilometragem_final - curr.quilometragem_inicial);
      }
      acc.completedShifts += 1;
    }
    return acc;
  }, { deliveries: 0, km: 0, completedShifts: 0 });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display">Histórico</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Registro de Jornadas</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            <History className="w-3 h-3" />
            <span>{totals.completedShifts} jornadas</span>
          </div>
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              disabled={clearing}
              className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline disabled:opacity-50"
            >
              {clearing ? "Limpando..." : "Limpar Histórico"}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-zinc-900/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 relative z-10">Total Entregas</p>
          <p className="text-4xl font-black tracking-tighter relative z-10">{totals.deliveries}</p>
        </div>
        <div className="bg-emerald-500 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 mb-2 relative z-10">Total KM</p>
          <div className="flex items-baseline gap-1 relative z-10">
            <p className="text-4xl font-black tracking-tighter">{totals.km.toFixed(0)}</p>
            <span className="text-xs font-black uppercase tracking-widest opacity-60">km</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-zinc-100 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-zinc-100 text-center space-y-4">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <History className="w-10 h-10 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-black text-[10px] uppercase tracking-widest">Nenhuma jornada registrada ainda.</p>
          </div>
        ) : (
          history.map((h) => (
            <motion.div 
              key={h.id} 
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-xl shadow-zinc-200/30 hover:shadow-2xl transition-all group"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                    h.status === 'active' 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse" 
                      : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white"
                  )}>
                    {h.status === 'active' ? <Play className="w-5 h-5 fill-current" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                      {h.startTime ? formatDate(h.startTime, "dd 'de' MMMM", { locale: ptBR }) : 'Data Indisponível'}
                    </p>
                    <h4 className="text-lg font-black text-zinc-900 tracking-tight">
                      {h.placa_veiculo || 'Sem Placa'}
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      h.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                    )}>
                      {h.status === 'active' ? 'Em Curso' : 'Finalizado'}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteShift(h.id);
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-50">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Horário</p>
                  <p className="text-sm font-black text-zinc-900">
                    {formatDate(h.startTime, 'HH:mm')} - {h.endTime ? formatDate(h.endTime, 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Entregas</p>
                  <p className="text-xl font-black text-zinc-900">{h.total_entregas || 0}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Distância</p>
                  <p className="text-xl font-black text-zinc-900">
                    {h.quilometragem_final && h.quilometragem_inicial 
                      ? (h.quilometragem_final - h.quilometragem_inicial).toFixed(1) 
                      : '0.0'}
                    <span className="text-[10px] ml-0.5 opacity-40">km</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function ProfileView({ driver, user, onLogout, onUpdateDriver }: { driver: DriverData, user: User, onLogout: () => void, onUpdateDriver: (data: Partial<DriverData>) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    plate: driver.plate,
    vehicle: driver.vehicle,
    code: driver.code,
    name: driver.name,
    phone: driver.phone || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateDriver(editData);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tighter italic font-display">Meu Perfil</h2>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Configurações da Conta</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isSaving}
          className={cn(
            "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
            isEditing 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          )}
        >
          {isSaving ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isEditing ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5 rotate-45" />
          )}
          {isEditing ? 'Salvar' : 'Editar'}
        </button>
      </div>
      
      <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-50" />
        
        <div className="relative mb-6">
          <div className="w-32 h-32 bg-zinc-100 rounded-[2.5rem] flex items-center justify-center border-4 border-white shadow-2xl overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt={driver.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-16 h-16 text-zinc-300" />
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {isEditing ? (
          <input 
            value={editData.name}
            onChange={(e) => setEditData({...editData, name: e.target.value})}
            className="text-2xl font-black text-zinc-900 tracking-tight text-center bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        ) : (
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{driver.name}</h3>
        )}
        <p className="text-zinc-400 font-medium mb-6 mt-1">{user.email}</p>
        
        <div className="px-6 py-2 bg-zinc-900 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/20">
          Motorista Ativo
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 overflow-hidden">
        <div className="p-8 border-b border-zinc-50 bg-zinc-50/50">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Informações do Veículo</p>
        </div>
        <div className="p-10 space-y-8">
          <div className="flex justify-between items-center">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Placa</p>
              {isEditing ? (
                <input 
                  value={editData.plate}
                  onChange={(e) => setEditData({...editData, plate: e.target.value.toUpperCase()})}
                  className="text-xl font-black text-zinc-900 tracking-tight bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-1 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              ) : (
                <p className="text-xl font-black text-zinc-900 tracking-tight">{driver.plate}</p>
              )}
            </div>
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center ml-4">
              <Truck className="w-6 h-6 text-zinc-300" />
            </div>
          </div>
          <div className="h-px bg-zinc-50" />
          <div className="flex justify-between items-center">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Modelo</p>
              {isEditing ? (
                <input 
                  value={editData.vehicle}
                  onChange={(e) => setEditData({...editData, vehicle: e.target.value})}
                  className="text-xl font-black text-zinc-900 tracking-tight bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-1 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              ) : (
                <p className="text-xl font-black text-zinc-900 tracking-tight">{driver.vehicle}</p>
              )}
            </div>
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center ml-4">
              <Car className="w-6 h-6 text-zinc-300" />
            </div>
          </div>
          <div className="h-px bg-zinc-50" />
          <div className="flex justify-between items-center">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Código</p>
              {isEditing ? (
                <input 
                  value={editData.code}
                  onChange={(e) => setEditData({...editData, code: e.target.value})}
                  className="text-xl font-black text-zinc-900 tracking-tight bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-1 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              ) : (
                <p className="text-xl font-black text-zinc-900 tracking-tight">{driver.code}</p>
              )}
            </div>
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center ml-4">
              <ShieldCheck className="w-6 h-6 text-zinc-300" />
            </div>
          </div>
          <div className="h-px bg-zinc-50" />
          <div className="flex justify-between items-center">
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">WhatsApp</p>
              {isEditing ? (
                <input 
                  value={editData.phone}
                  onChange={(e) => setEditData({...editData, phone: e.target.value})}
                  placeholder="Ex: 5531999999999"
                  className="text-xl font-black text-zinc-900 tracking-tight bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-1 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              ) : (
                <p className="text-xl font-black text-zinc-900 tracking-tight">{driver.phone || 'Não informado'}</p>
              )}
            </div>
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center ml-4">
              <MessageSquare className="w-6 h-6 text-zinc-300" />
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <button 
          onClick={() => setIsEditing(false)}
          className="w-full py-4 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:text-zinc-600 transition-colors"
        >
          Cancelar Edição
        </button>
      )}

      <button 
        onClick={onLogout}
        className="w-full py-6 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3"
      >
        <LogOut className="w-4 h-4" />
        Sair da Conta
      </button>
    </motion.div>
  );
}

function ChatView({ driverId, user, isAdmin = false }: { driverId: string, user: User, isAdmin?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('driverId', '==', driverId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));
    return unsub;
  }, [driverId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text?: string, photo?: string, audio?: string) => {
    if (!text && !photo && !audio) return;
    try {
      await addDoc(collection(db, 'messages'), {
        driverId,
        senderId: user.uid,
        text: text || null,
        photo: photo || null,
        audio: audio || null,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const compressed = await compressImage(event.target?.result as string);
        sendMessage(undefined, compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[3rem] overflow-hidden border border-zinc-100 shadow-2xl shadow-zinc-200/50">
      {/* Chat Header */}
      <div className="px-8 py-6 bg-white border-b border-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900 tracking-tight uppercase">
              {isAdmin ? "Chat com Motorista" : "Suporte HF Transportes"}
            </h3>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Canal Direto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Online</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50/30"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === user.uid;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={m.id} 
              className={clsx(
                "flex flex-col max-w-[85%]",
                isMe ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={clsx(
                "p-5 rounded-[2rem] shadow-sm",
                isMe 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-100 rounded-tl-none"
              )}>
                {m.text && <p className="text-sm font-medium leading-relaxed">{m.text}</p>}
                {m.photo && (
                  <div className="mt-2 rounded-2xl overflow-hidden shadow-lg">
                    <img 
                      src={m.photo} 
                      alt="Chat" 
                      className="max-w-full h-auto block" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {m.audio && (
                  <div className="flex items-center gap-3 py-1">
                    <div className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      isMe ? "bg-white/10" : "bg-zinc-100"
                    )}>
                      <Mic className="w-5 h-5" />
                    </div>
                    <div className="flex-1 h-1 bg-current opacity-20 rounded-full min-w-[100px]" />
                  </div>
                )}
              </div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-2 px-2">
                {m.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-zinc-50">
        <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-[2rem] border border-zinc-100 focus-within:border-emerald-500/50 transition-all">
          <label className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors cursor-pointer">
            <Camera className="w-6 h-6" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage(newMessage)}
            placeholder="Escreva sua mensagem..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400"
          />
          <button
            onClick={() => sendMessage(newMessage)}
            disabled={!newMessage.trim()}
            className={clsx(
              "p-4 rounded-2xl transition-all active:scale-95",
              newMessage.trim() 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                : "bg-zinc-200 text-zinc-400"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FleetMap({ drivers, locations, focusedDriverId }: { drivers: any[], locations: DriverLocation[], focusedDriverId?: string | null }) {
  const activeLocations = locations.filter(loc => {
    const driver = drivers.find(d => d.uid === loc.driverId);
    return driver;
  });

  const focusedLoc = focusedDriverId ? activeLocations.find(l => l.driverId === focusedDriverId) : null;

  const center: [number, number] = focusedLoc 
    ? [focusedLoc.latitude, focusedLoc.longitude]
    : (activeLocations.length > 0 
      ? [activeLocations[0].latitude, activeLocations[0].longitude]
      : [-19.9167, -43.9345]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 overflow-hidden">
        <div className="h-[500px] w-full rounded-[2.5rem] overflow-hidden border border-zinc-100 relative z-0">
          <MapContainer center={center} zoom={focusedLoc ? 16 : 12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {activeLocations.map(loc => {
              const driver = drivers.find(d => d.uid === loc.driverId);
              const isLive = loc.timestamp && (new Date().getTime() - (loc.timestamp.seconds * 1000)) < 60000;
              return (
                <Marker 
                  key={loc.driverId} 
                  position={[loc.latitude, loc.longitude]}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="w-8 h-8 ${focusedDriverId === loc.driverId ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-500/20' : 'bg-zinc-900'} rounded-full flex items-center justify-center border-2 border-white shadow-xl transition-all duration-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                          </div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                  })}
                >
                  <Popup>
                    <div className="p-3 min-w-[150px]">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-black text-zinc-900 uppercase tracking-tight">{driver?.name}</p>
                        {isLive && (
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{driver?.plate}</p>
                      <div className="mt-3 pt-3 border-t border-zinc-100">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</p>
                          {isLive && <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>}
                        </div>
                        <p className="text-[10px] font-black text-zinc-900 uppercase">{loc.status}</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Map Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-xl shadow-zinc-200/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900 tracking-tight">{activeLocations.length}</p>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Veículos Ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl shadow-zinc-900/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Navigation className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white tracking-tight">100%</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sinal GPS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerView({ showAlert, showConfirm }: { showAlert: any, showConfirm: any }) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const driversRef = useRef<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [reports, setReports] = useState<any>({ checklists: [], deliveries: [], expenses: [], helpRequests: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'map' | 'reports' | 'config'>('dashboard');
  const [editingTarget, setEditingTarget] = useState<{shiftId: string, value: string} | null>(null);
  const [addingOrder, setAddingOrder] = useState<{shiftId: string, value: string} | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [viewingChecklist, setViewingChecklist] = useState<any>(null);

  const updateVehicleStatus = async (driverId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'drivers', driverId), { vehicleStatus: status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${driverId}`);
    }
  };

  const [authorizedAdmins, setAuthorizedAdmins] = useState<any[]>([]);

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
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrivers(data);
      driversRef.current = data;
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    const unsubAuthAdmins = onSnapshot(collection(db, 'authorized_admins'), (snap) => {
      setAuthorizedAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'authorized_admins'));

    // Fetch shifts from the last 30 days for reports
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const unsubShifts = onSnapshot(query(
      collection(db, 'shifts'), 
      where('startTime', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      where('status', 'in', ['active', 'completed'])
    ), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));

    const unsubChecklists = onSnapshot(collection(db, 'checklists'), (snap) => {
      setReports(prev => ({ ...prev, checklists: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'checklists'));

    const unsubDeliveries = onSnapshot(collection(db, 'deliveryReports'), (snap) => {
      setReports(prev => ({ ...prev, deliveries: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'deliveryReports'));

    const unsubExpenses = onSnapshot(collection(db, 'expenseReports'), (snap) => {
      setReports(prev => ({ ...prev, expenses: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'expenseReports'));

    const isInitialLoad = { help: true };
    const unsubHelp = onSnapshot(collection(db, 'helpRequests'), (snap) => {
      const newHelpRequests = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpRequest));
      
      setReports(prev => {
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

    // Request Notification Permission
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

  const updateTarget = async (shiftId: string, target: number) => {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), { targetDeliveries: target });
      setEditingTarget(null);
    } catch (error) {
      console.error(error);
    }
  };

  const endShift = async (shiftId: string) => {
    showConfirm(
      "Encerrar Rota",
      "Deseja realmente encerrar esta rota?",
      async () => {
        try {
          await updateDoc(doc(db, 'shifts', shiftId), {
            status: 'completed',
            endTime: serverTimestamp()
          });
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao encerrar rota.", 'error');
        }
      },
      'danger'
    );
  };

  const addOrderNumber = async (shiftId: string, orderNumber: string) => {
    if (!orderNumber) return;
    try {
      const shift = shifts.find(s => s.id === shiftId);
      const orders = shift.orderNumbers || [];
      await updateDoc(doc(db, 'shifts', shiftId), { 
        orderNumbers: [...orders, orderNumber] 
      });
      setAddingOrder(null);
    } catch (error) {
      console.error(error);
    }
  };

  const sendWhatsAppSummary = (driverName: string, shift: any) => {
    const checklist = reports.checklists.find((c: any) => c.shiftId === shift.id);
    const delivery = reports.deliveries.find((d: any) => d.shiftId === shift.id);
    const expense = reports.expenses.find((e: any) => e.shiftId === shift.id);

    const text = `*Resumo HF Transportes - ${driverName}*\n` +
      `📅 Data: ${shift.date}\n` +
      `🏁 Status: ${shift.status === 'active' ? 'Em Rota' : 'Finalizado'}\n` +
      `📦 Entregas: ${delivery?.delivered || 0}/${shift.targetDeliveries || '?'}\n` +
      `📸 Checklist: ${checklist ? '✅ Enviado' : '❌ Pendente'}\n` +
      `💰 Despesas: ${expense ? '✅ Enviado' : '❌ Pendente'}\n` +
      `📍 Local: Ver no App`;

    const url = `https://wa.me/553184715702?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getDeliveryChartData = () => {
    return drivers.map(d => {
      const activeShift = shifts.find(s => s.driverId === d.uid && s.status === 'active');
      const delivery = activeShift ? reports.deliveries.find((del: any) => del.shiftId === activeShift.id) : null;
      return {
        name: d.name.split(' ')[0],
        delivered: delivery?.delivered || 0,
        goal: activeShift?.targetDeliveries || 0
      };
    }).filter(d => d.goal > 0 || d.delivered > 0);
  };

  const getMileageChartData = () => {
    const data: any[] = [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, 'dd/MM');
    }).reverse();

    last7Days.forEach(dateStr => {
      const dayShifts = shifts.filter(s => {
        if (!s.startTime) return false;
        const shiftDate = format(s.startTime.toDate(), 'dd/MM');
        return shiftDate === dateStr;
      });
      
      const totalMileage = dayShifts.reduce((acc, s) => {
        if (s.quilometragem_final && s.quilometragem_inicial) {
          return acc + (s.quilometragem_final - s.quilometragem_inicial);
        }
        return acc;
      }, 0);

      data.push({ 
        date: dateStr, 
        mileage: totalMileage || 0 
      });
    });
    return data;
  };

  const getDailyFlowData = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7am to 6pm
    return hours.map(hour => {
      const count = reports.deliveries.filter((d: any) => {
        if (!d.timestamp) return false;
        const date = d.timestamp.toDate();
        return date.getHours() === hour && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      }).reduce((acc, d) => acc + (d.delivered || 0), 0);
      return { hour: `${hour}h`, deliveries: count };
    });
  };

  const selectedDriver = drivers.find(d => d.uid === selectedDriverId);
  const activeShifts = shifts.filter(s => s.status === 'active');
  const driverShift = activeShifts.find(s => s.driverId === selectedDriverId);
  const driverLocation = locations.find(l => l.driverId === selectedDriverId);
  const driverChecklist = driverShift ? reports.checklists.find((c: any) => c.shiftId === driverShift.id) : null;
  const driverDelivery = driverShift ? reports.deliveries.find((d: any) => d.shiftId === driverShift.id) : null;
  const driverExpense = driverShift ? reports.expenses.find((e: any) => e.shiftId === driverShift.id) : null;

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
          { id: 'reports', label: 'Relatórios', icon: BarChart3 },
          { id: 'config', label: 'Config', icon: ShieldCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-zinc-900 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight italic font-display">Mapa da Frota</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Localização em Tempo Real de Todos os Veículos</p>
              </div>
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center">
                <MapPin className="w-7 h-7 text-zinc-300" />
              </div>
            </div>
            <FleetMap drivers={drivers} locations={locations} focusedDriverId={focusedDriverId} />
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <h3 className="text-xl font-black text-zinc-900 mb-4 italic font-display">Configurações do Sistema</h3>
            <p className="text-sm text-zinc-500 mb-8">Gerencie os dados globais da plataforma e permissões de acesso.</p>
            
            <div className="space-y-8">
              {/* Admin Management Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Gestão de Administradores</span>
                </div>
                
                <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 space-y-4">
                  <p className="text-xs text-zinc-500 font-medium">
                    Adicione o e-mail de outros gestores para que eles possam acessar este painel usando o login do Google.
                  </p>
                  
                  <div className="flex gap-3">
                    <input 
                      type="email"
                      id="new-admin-email"
                      placeholder="email@exemplo.com"
                      className="flex-1 bg-white border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
                    />
                    <button 
                      onClick={async () => {
                        const emailInput = document.getElementById('new-admin-email') as HTMLInputElement;
                        const email = emailInput?.value.trim().toLowerCase();
                        if (!email) return;
                        
                        try {
                          await setDoc(doc(db, 'authorized_admins', email), {
                            email,
                            role: 'admin',
                            addedAt: serverTimestamp(),
                            addedBy: auth.currentUser?.email
                          });
                          
                          showAlert("Sucesso", `E-mail ${email} autorizado como gestor.`, 'success');
                          emailInput.value = '';
                        } catch (e) {
                          console.error("Error adding admin:", e);
                          showAlert("Erro", "Erro ao autorizar gestor. Verifique suas permissões.", 'error');
                        }
                      }}
                      className="bg-zinc-900 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-900/20"
                    >
                      Autorizar
                    </button>
                  </div>

                  <div className="pt-4 border-t border-zinc-200 mt-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Remover Gestor por E-mail</p>
                    <div className="flex gap-3">
                      <input 
                        type="email"
                        id="remove-admin-email"
                        placeholder="email@remover.com"
                        className="flex-1 bg-white border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500"
                      />
                      <button 
                        onClick={() => {
                          const emailInput = document.getElementById('remove-admin-email') as HTMLInputElement;
                          const email = emailInput?.value.trim().toLowerCase();
                          if (!email) return;
                          if (email === 'jghjvgcv@gmail.com') {
                            showAlert("Erro", "O gestor principal não pode ser removido.", 'error');
                            return;
                          }
                          
                          showConfirm(
                            "Remover Gestor",
                            `Tem certeza que deseja remover a autorização de ${email}?`,
                            async () => {
                              try {
                                await deleteDoc(doc(db, 'authorized_admins', email));
                                showAlert("Sucesso", "Gestor removido com sucesso.", 'success');
                                emailInput.value = '';
                              } catch (e) {
                                console.error("Error removing admin:", e);
                                showAlert("Erro", "Erro ao remover gestor. Verifique se o e-mail está correto.", 'error');
                              }
                            },
                            'danger'
                          );
                        }}
                        className="bg-red-600 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  {authorizedAdmins.length > 0 && (
                    <div className="mt-8 space-y-3">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Gestores Autorizados</p>
                      <div className="grid grid-cols-1 gap-2">
                        {allAdmins.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-zinc-900">{admin.email}</span>
                                {admin.isPrincipal && (
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Gestor Principal</span>
                                )}
                              </div>
                            </div>
                            {admin.email !== 'jghjvgcv@gmail.com' && (
                              <button 
                                onClick={() => {
                                  showConfirm(
                                    "Remover Gestor",
                                    `Tem certeza que deseja remover a autorização de ${admin.email}?`,
                                    async () => {
                                      try {
                                        await deleteDoc(doc(db, 'authorized_admins', admin.id));
                                        showAlert("Sucesso", "Gestor removido com sucesso.", 'success');
                                      } catch (e) {
                                        console.error("Error removing admin:", e);
                                        showAlert("Erro", "Erro ao remover gestor.", 'error');
                                      }
                                    },
                                    'danger'
                                  );
                                }}
                                className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100 space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Zona de Perigo</span>
                </div>
                <p className="text-xs text-red-800 font-medium">
                  Esta ação irá zerar todos os quilômetros e jornadas de protótipo. 
                  Isso não pode ser desfeito.
                </p>
                <button 
                  onClick={() => {
                    showConfirm(
                      "Limpar Dados do Protótipo",
                      "Tem certeza que deseja realizar a limpeza completa de todos os dados? Esta ação irá deletar permanentemente o histórico de jornadas, checklists, mensagens e localizações.",
                      async () => {
                        try {
                          const collectionsToClear = [
                            'shifts', 'checklists', 'deliveryReports', 
                            'expenseReports', 'helpRequests', 'locations', 'messages'
                          ];
                          
                          for (const collName of collectionsToClear) {
                            const snap = await getDocs(collection(db, collName));
                            const docs = snap.docs;
                            
                            // Delete in chunks of 500 (Firestore batch limit)
                            for (let i = 0; i < docs.length; i += 500) {
                              const batch = writeBatch(db);
                              docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
                              await batch.commit();
                            }
                          }
                          
                          showAlert("Sucesso", "Limpeza de dados concluída com sucesso.", 'success');
                          setTimeout(() => window.location.reload(), 2000);
                        } catch (e) {
                          console.error("Error resetting data:", e);
                          showAlert("Erro", "Erro ao realizar limpeza. Verifique suas permissões.", 'error');
                        }
                      },
                      'danger'
                    );
                  }}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                >
                  Limpar Todos os Dados (Limpeza)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Help Requests Section */}
          {reports.helpRequests.filter((h: any) => h.status === 'pending').length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chamados de Ajuda Ativos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.helpRequests.filter((h: any) => h.status === 'pending').map((help: any) => {
                  const driver = drivers.find(d => d.uid === help.driverId);
                  return (
                    <motion.div 
                      key={help.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-red-50 border border-red-100 p-4 rounded-3xl flex justify-between items-center"
                    >
                      <div>
                        <p className="text-xs font-black text-red-600 uppercase">{driver?.name || 'Motorista'}</p>
                        <p className="text-sm font-bold text-red-900">{help.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const driverPhone = driver?.phone || MANAGER_PHONE;
                            const url = `https://wa.me/${driverPhone}?text=${encodeURIComponent(`Olá ${driver?.name || ''}, vi sua solicitação de ajuda: "${help.message}"`)}`;
                            window.open(url, '_blank');
                          }}
                          className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors"
                          title="Falar no WhatsApp"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, 'helpRequests', help.id), { status: 'resolved' });
                          }}
                          className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-red-700 transition-colors"
                        >
                          RESOLVER
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campaign Progress */}
          <div className="bg-zinc-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Zap className="w-48 h-48 text-emerald-400" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Campanha Ativa</h3>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">Monitoramento de Desenvolvimento Futurístico</p>
                </div>
                <div className="w-14 h-14 bg-emerald-500/10 rounded-[1.5rem] flex items-center justify-center border border-emerald-500/20 backdrop-blur-xl">
                  <TrendingUp className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-4xl font-black text-white tracking-tighter">
                      {activeShifts.reduce((acc, s) => {
                        const del = reports.deliveries.find((d: any) => d.shiftId === s.id);
                        return acc + (del?.delivered || 0);
                      }, 0)}
                    </p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Entregas Consolidadas Hoje</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400 tracking-tighter">
                      {Math.round((activeShifts.reduce((acc, s) => {
                        const del = reports.deliveries.find((d: any) => d.shiftId === s.id);
                        return acc + (del?.delivered || 0);
                      }, 0) / (activeShifts.reduce((acc, s) => acc + (s.targetDeliveries || 0), 0) || 1)) * 100)}%
                    </p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Eficiência Global</p>
                  </div>
                </div>
                <div className="h-4 bg-white/5 rounded-2xl overflow-hidden border border-white/10 p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (activeShifts.reduce((acc, s) => {
                      const del = reports.deliveries.find((d: any) => d.shiftId === s.id);
                      return acc + (del?.delivered || 0);
                    }, 0) / (activeShifts.reduce((acc, s) => acc + (s.targetDeliveries || 0), 0) || 1)) * 100)}%` }}
                    className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-zinc-500 uppercase">Meta Total</span>
                      <span className="text-sm font-bold text-white">{activeShifts.reduce((acc, s) => acc + (s.targetDeliveries || 0), 0)}</span>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-zinc-500 uppercase">Em Rota</span>
                      <span className="text-sm font-bold text-white">{activeShifts.length}</span>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Status: Operacional</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Flow Chart */}
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight italic font-display">Fluxo Diário</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Consolidado por hora</p>
              </div>
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-zinc-300" />
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDailyFlowData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="hour" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }} 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }} 
                  />
                  <Bar dataKey="deliveries" fill="#10b981" radius={[8, 8, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Real-time Map */}
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight italic font-display">Localização</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Frota em Tempo Real</p>
              </div>
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center">
                <MapPin className="w-7 h-7 text-zinc-300" />
              </div>
            </div>
            <FleetMap drivers={drivers} locations={locations} focusedDriverId={focusedDriverId} />
          </div>

          {/* Recent Notifications */}
          <div className="bg-zinc-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-3 relative z-10">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Atividade Recente
            </h3>
            <div className="space-y-6 relative z-10">
              {allActions.length === 0 ? (
                <p className="text-sm text-zinc-500 font-medium italic">Nenhuma atividade registrada hoje.</p>
              ) : (
                allActions.map((action: any) => {
                  const driver = drivers.find(d => d.uid === action.driverId);
                  return (
                    <div key={action.id} className="flex items-center justify-between border-b border-white/5 pb-6 last:border-0 last:pb-0 group">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                          action.type === 'help' ? "bg-red-500/20" : "bg-white/5"
                        )}>
                          {action.type === 'help' ? (
                            <AlertCircle className="w-6 h-6 text-red-400" />
                          ) : (
                            <Clock className="w-6 h-6 text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-base font-black text-white tracking-tight">{driver?.name || 'Motorista'}</p>
                          <p className={clsx(
                            "text-[10px] font-black uppercase tracking-widest mt-0.5",
                            action.type === 'help' ? "text-red-400" : "text-zinc-500"
                          )}>{action.label}</p>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                        {action.timestamp ? formatDate(action.timestamp.toDate(), 'HH:mm') : '--:--'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Summary Bento Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Motoristas</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-black text-zinc-900 tracking-tighter leading-none">{drivers.length}</p>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total</span>
              </div>
            </div>
            <div className="bg-zinc-900 p-10 rounded-[3rem] shadow-2xl text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Em Rota</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-black text-white tracking-tighter leading-none">{activeShifts.length}</p>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Ativos</span>
              </div>
            </div>
          </div>

          {/* Authorized Managers Section */}
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight italic font-display">Gestores Autorizados</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Controle de Acesso Administrativo</p>
              </div>
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-zinc-300" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allAdmins.map((admin) => (
                <motion.div 
                  key={admin.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-5 bg-zinc-50 border border-zinc-100 rounded-[2rem] group hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition-colors">
                      <ShieldCheck className="w-6 h-6 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 tracking-tight">{admin.email}</p>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                        {admin.isPrincipal ? 'Gestor Principal' : 'Acesso Administrativo'}
                      </p>
                    </div>
                  </div>
                  {admin.email !== 'jghjvgcv@gmail.com' ? (
                    <button 
                      onClick={() => {
                        showConfirm(
                          "Remover Gestor",
                          `Tem certeza que deseja remover a autorização de ${admin.email}?`,
                          async () => {
                            try {
                              await deleteDoc(doc(db, 'authorized_admins', admin.id));
                              showAlert("Sucesso", "Gestor removido com sucesso.", 'success');
                            } catch (e) {
                              console.error("Error removing admin:", e);
                              showAlert("Erro", "Erro ao remover gestor.", 'error');
                            }
                          },
                          'danger'
                        );
                      }}
                      className="w-10 h-10 bg-white text-zinc-300 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-zinc-100"
                      title="Remover Gestor"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Principal</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
      </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-6">
          {/* Driver List */}
          <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Monitoramento de Frota</h3>
          <span className="text-[10px] font-bold text-zinc-400 uppercase">{drivers.length} Cadastrados</span>
        </div>
        
        {/* Checklist Modal */}
        <AnimatePresence>
          {viewingChecklist && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setViewingChecklist(null)}
                className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 leading-tight">Detalhes do Checklist</h3>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                      {formatDate(viewingChecklist.timestamp, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setViewingChecklist(null)}
                    className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                  {[
                    { label: 'Óleo', status: viewingChecklist.oilStatus, photo: viewingChecklist.oilPhoto },
                    { label: 'Painel', status: viewingChecklist.dashboardStatus, photo: viewingChecklist.dashboardPhoto },
                    { label: 'Pneus', status: viewingChecklist.tireStatus, photo: viewingChecklist.tirePhoto }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{item.label}</p>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                          item.status === 'ok' ? "bg-emerald-100 text-emerald-600" : 
                          item.status === 'attention' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                        )}>
                          {item.status}
                        </span>
                      </div>
                      <div className="aspect-video rounded-3xl overflow-hidden border border-zinc-100 bg-zinc-50">
                        <img src={item.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-8 bg-zinc-50 border-t border-zinc-100">
                  <button 
                    onClick={() => setViewingChecklist(null)}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all"
                  >
                    Fechar Visualização
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : drivers.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-zinc-300 text-center">
            <Users className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">Nenhum motorista cadastrado.</p>
          </div>
        ) : (
          drivers.map((d) => {
            const activeShift = shifts.find(s => s.driverId === d.uid && s.status === 'active');
            const driverChecklists = reports.checklists.filter((c: any) => c.driverId === d.uid);
            const checklist = driverChecklists.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
            const delivery = activeShift ? reports.deliveries.find((del: any) => del.shiftId === activeShift.id) : null;
            const expense = activeShift ? reports.expenses.find((e: any) => e.shiftId === activeShift.id) : null;
            const location = locations.find(l => l.driverId === d.uid);
            const isLive = location && location.timestamp && (new Date().getTime() - (location.timestamp.seconds * 1000)) < 60000;

            return (
              <div 
                key={d.id} 
                className={cn(
                  "group relative bg-white p-8 rounded-[3rem] border transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-200/50",
                  activeShift ? "border-emerald-100 ring-1 ring-emerald-50" : "border-zinc-100"
                )}
              >
                {activeShift && checklist && checklist.oilStatus === 'ok' && checklist.dashboardStatus === 'ok' && checklist.tireStatus === 'ok' && (
                  <div className="absolute -top-4 -right-4 z-10">
                    <div className="bg-emerald-500 text-white p-3 rounded-[1.5rem] shadow-xl shadow-emerald-500/40 animate-bounce">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                      activeShift ? "bg-emerald-50 shadow-inner" : "bg-zinc-50 shadow-inner"
                    )}>
                      <UserIcon className={cn("w-8 h-8", activeShift ? "text-emerald-600" : "text-zinc-300")} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-black text-zinc-900 leading-tight tracking-tight">{d.name}</h4>
                        {isLive && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Live</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{d.plate}</span>
                        <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{d.vehicle}</span>
                        <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                          d.vehicleStatus === 'operational' ? "bg-emerald-100 text-emerald-700" :
                          d.vehicleStatus === 'maintenance_required' ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {d.vehicleStatus === 'operational' ? 'Operacional' :
                           d.vehicleStatus === 'maintenance_required' ? 'Manutenção' :
                           'Fora de Serviço'}
                        </span>
                      </div>
                    </div>
                  </div>
                    <div className="flex items-center gap-4">
                      {location && (
                        <button 
                          onClick={() => {
                            setFocusedDriverId(d.uid);
                            setActiveTab('map');
                          }}
                          className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all active:scale-90"
                          title="Ver no Mapa"
                        >
                          <MapPin className="w-6 h-6" />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          showConfirm(
                            "Excluir Motorista",
                            `Tem certeza que deseja excluir o motorista ${d.name}? Esta ação irá remover o registro do motorista, mas manterá o histórico de jornadas.`,
                            async () => {
                              try {
                                await deleteDoc(doc(db, 'drivers', d.id));
                                showAlert("Sucesso", "Motorista excluído com sucesso.", 'success');
                              } catch (e) {
                                console.error("Error deleting driver:", e);
                                showAlert("Erro", "Erro ao excluir motorista. Verifique suas permissões.", 'error');
                              }
                            },
                            'danger'
                          );
                        }}
                        className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-all active:scale-90"
                        title="Excluir Motorista"
                      >
                        <X className="w-6 h-6" />
                      </button>
                      {activeShift ? (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-full shadow-lg shadow-emerald-500/20">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          Em Rota
                        </div>
                        <div className="flex flex-col items-end mt-2">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Desde {formatDate(activeShift.startTime, 'HH:mm')}</span>
                          {location && !isLive && (
                            <span className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest">Visto às {formatDate(location.timestamp, 'HH:mm')}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="px-4 py-1.5 bg-zinc-100 text-zinc-400 text-[10px] font-black uppercase rounded-full tracking-widest">Offline</span>
                    )}
                    <button 
                      onClick={() => setSelectedDriverId(d.uid)}
                      className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all active:scale-90"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {activeShift && (
                  <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-50">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Checklist</p>
                      <button 
                        onClick={() => setViewingChecklist(checklist)}
                        disabled={!checklist}
                        className={cn(
                          "flex items-center gap-2 font-black text-xs transition-all p-3 rounded-2xl w-full justify-center",
                          !checklist ? "text-red-500 bg-red-50/50 border border-red-100" : 
                          (checklist.oilStatus === 'ok' && checklist.dashboardStatus === 'ok' && checklist.tireStatus === 'ok') ? "text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100" : "text-amber-500 bg-amber-50 border border-amber-100 hover:bg-amber-100"
                        )}
                      >
                        {!checklist ? (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            <span>Pendente</span>
                          </>
                        ) : (
                          <>
                            {checklist.oilStatus === 'ok' && checklist.dashboardStatus === 'ok' && checklist.tireStatus === 'ok' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            <span className="underline decoration-dotted underline-offset-4">{checklist.oilStatus === 'ok' && checklist.dashboardStatus === 'ok' && checklist.tireStatus === 'ok' ? "OK" : "Atenção"}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Pedidos</p>
                      <div className="flex items-center gap-3 font-black text-lg text-zinc-900 h-12 justify-center bg-zinc-50 rounded-2xl border border-zinc-100">
                        <Package className="w-5 h-5 text-zinc-300" />
                        <span>{delivery?.delivered || 0} <span className="text-zinc-300">/</span> {activeShift.targetDeliveries || "---"}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">KM Inicial</p>
                      <div className="flex items-center justify-center h-12 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <p className="text-lg font-black text-zinc-900 tracking-tight">{activeShift.quilometragem_inicial?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeShift && (
                  <div className="flex gap-3 pt-6">
                    {editingTarget?.shiftId === activeShift.id ? (
                      <div className="flex-1 flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Qtd Entregas"
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500"
                          value={editingTarget.value}
                          onChange={(e) => setEditingTarget({...editingTarget, value: e.target.value})}
                        />
                        <button 
                          onClick={() => updateTarget(activeShift.id, Number(editingTarget.value))}
                          className="bg-emerald-500 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setEditingTarget({shiftId: activeShift.id, value: String(activeShift.targetDeliveries || '')})}
                        className="flex-1 py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-zinc-900/20 active:scale-95 transition-all"
                      >
                        Definir Meta
                      </button>
                    )}
                    <button 
                      onClick={() => sendWhatsAppSummary(d.name, activeShift)}
                      className="px-8 py-5 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-emerald-100 transition-all active:scale-95"
                    >
                      <MessageSquare className="w-5 h-5" />
                      WhatsApp
                    </button>
                    <button 
                      onClick={() => endShift(activeShift.id)}
                      className="px-8 py-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                    >
                      Encerrar
                    </button>
                  </div>
                )}

                {activeShift && (
                  <div className="pt-8 border-t border-zinc-50 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Pedidos Designados</p>
                      <button 
                        onClick={() => setAddingOrder({ shiftId: activeShift.id, value: '' })}
                        className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-[0.2em]"
                      >
                        + Adicionar
                      </button>
                    </div>
                    
                    {addingOrder?.shiftId === activeShift.id && (
                      <div className="flex gap-3 mb-6">
                        <input 
                          type="text"
                          placeholder="Nº do Pedido"
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-xs font-black focus:outline-none focus:border-emerald-500"
                          value={addingOrder.value}
                          onChange={(e) => setAddingOrder({ ...addingOrder, value: e.target.value })}
                        />
                        <button 
                          onClick={() => addOrderNumber(activeShift.id, addingOrder.value)}
                          className="bg-zinc-900 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]"
                        >
                          OK
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {activeShift.orderNumbers?.map((order: string, idx: number) => (
                        <span key={idx} className="px-4 py-2 bg-zinc-50 text-zinc-600 text-[10px] font-black rounded-xl border border-zinc-100 shadow-sm">
                          #{order}
                        </span>
                      )) || <p className="text-[10px] text-zinc-400 italic">Nenhum pedido enviado ainda.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-10">
          {/* Delivery Performance Chart */}
          <div className="bg-white p-10 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight italic font-display">Desempenho</h3>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Entregas vs Metas (Hoje)</p>
              </div>
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDeliveryChartData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                  />
                  <Legend 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', paddingTop: '30px' }} 
                  />
                  <Bar dataKey="delivered" name="Entregues" fill="#10b981" radius={[8, 8, 0, 0]} barSize={32} />
                  <Bar dataKey="goal" name="Meta" fill="#f4f4f5" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fleet Mileage Chart */}
          <div className="bg-zinc-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight italic font-display">Frota</h3>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Quilometragem (7 Dias)</p>
              </div>
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Truck className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <div className="h-72 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getMileageChartData()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '16px', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mileage" 
                    name="KM Total" 
                    stroke="#10b981" 
                    strokeWidth={6} 
                    dot={{ r: 8, fill: '#10b981', strokeWidth: 4, stroke: '#18181b' }}
                    activeDot={{ r: 10, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational Summary Table */}
          <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 overflow-hidden">
            <div className="p-10 border-b border-zinc-50">
              <h3 className="text-lg font-black text-zinc-900 uppercase tracking-widest italic font-display">Resumo Operacional</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1">Últimos 30 Dias</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Motorista</th>
                    <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Entregas</th>
                    <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">KM Total</th>
                    <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Despesas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {drivers.map(d => {
                    const driverShifts = shifts.filter(s => s.driverId === d.uid);
                    const totalDeliveries = driverShifts.reduce((acc, s) => {
                      const del = reports.deliveries.find((del: any) => del.shiftId === s.id);
                      return acc + (del?.delivered || 0);
                    }, 0);
                    const totalKM = driverShifts.reduce((acc, s) => {
                      if (s.quilometragem_final && s.quilometragem_inicial) return acc + (s.quilometragem_final - s.quilometragem_inicial);
                      return acc;
                    }, 0);
                    const totalExpenses = driverShifts.reduce((acc, s) => {
                      const exp = reports.expenses.find((e: any) => e.shiftId === s.id);
                      if (!exp) return acc;
                      return acc + (Number(exp.fuel || 0) + Number(exp.toll || 0) + Number(exp.maintenance || 0));
                    }, 0);

                    return (
                      <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-10 py-8">
                          <p className="text-base font-black text-zinc-900 tracking-tight group-hover:text-emerald-600 transition-colors">{d.name}</p>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">{d.plate}</p>
                        </td>
                        <td className="px-10 py-8 text-base font-black text-zinc-900">{totalDeliveries}</td>
                        <td className="px-10 py-8 text-base font-black text-zinc-900">{totalKM.toLocaleString()} <span className="text-[10px] opacity-40">km</span></td>
                        <td className="px-10 py-8 text-base font-black text-emerald-600">R$ {totalExpenses.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <AnimatePresence>
        {selectedDriverId && selectedDriver && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriverId(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedDriver.name}</h3>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{selectedDriver.plate} • {selectedDriver.vehicle}</p>
                </div>
                <button onClick={() => setSelectedDriverId(null)} className="p-2 bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8">
                {/* Vehicle Status Control */}
                <section className="space-y-4">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Status do Veículo</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'operational', label: 'Operacional', activeClass: 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20', hoverClass: 'hover:border-emerald-200 hover:text-emerald-600' },
                      { id: 'maintenance_required', label: 'Manutenção', activeClass: 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20', hoverClass: 'hover:border-amber-200 hover:text-amber-600' },
                      { id: 'out_of_service', label: 'Fora de Serviço', activeClass: 'bg-red-500 border-red-500 text-white shadow-red-500/20', hoverClass: 'hover:border-red-200 hover:text-red-600' }
                    ].map((status) => (
                      <button
                        key={status.id}
                        onClick={() => updateVehicleStatus(selectedDriver.uid, status.id)}
                        className={cn(
                          "py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                          selectedDriver.vehicleStatus === status.id
                            ? `${status.activeClass} shadow-lg`
                            : `bg-white border-zinc-100 text-zinc-400 ${status.hoverClass}`
                        )}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Real-time Location */}
                {driverLocation && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Localização Atual</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                    <div className="h-[200px] w-full rounded-3xl overflow-hidden border border-zinc-100 relative z-0">
                      <MapContainer center={[driverLocation.latitude, driverLocation.longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker position={[driverLocation.latitude, driverLocation.longitude]}>
                          <Popup>{selectedDriver.name}</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Visto por último: {formatDate(driverLocation.timestamp, 'HH:mm:ss')}</p>
                      <a 
                        href={`https://www.google.com/maps?q=${driverLocation.latitude},${driverLocation.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                      >
                        Abrir no Google Maps
                      </a>
                    </div>
                  </section>
                )}

                {/* Active Shift Info */}
                <section className="space-y-4">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Jornada Atual</h4>
                  {driverShift ? (
                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Início</p>
                        <p className="font-bold text-zinc-900">{formatDate(driverShift.startTime, 'HH:mm')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">KM Inicial</p>
                        <p className="font-bold text-zinc-900">{driverShift.quilometragem_inicial || '---'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                      <p className="text-sm text-zinc-400 font-medium">Motorista não iniciou jornada hoje.</p>
                    </div>
                  )}
                </section>

                {/* Checklist Photos & Status */}
                {driverChecklist && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Checklist de Manutenção</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <div className="aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 relative">
                          <img src={driverChecklist.oilPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className={cn(
                            "absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase text-white",
                            driverChecklist.oilStatus === 'ok' ? "bg-emerald-500" : driverChecklist.oilStatus === 'attention' ? "bg-amber-500" : "bg-red-500"
                          )}>
                            {driverChecklist.oilStatus}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-center text-zinc-500 uppercase">Óleo</p>
                      </div>
                      <div className="space-y-2">
                        <div className="aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 relative">
                          <img src={driverChecklist.dashboardPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className={cn(
                            "absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase text-white",
                            driverChecklist.dashboardStatus === 'ok' ? "bg-emerald-500" : driverChecklist.dashboardStatus === 'attention' ? "bg-amber-500" : "bg-red-500"
                          )}>
                            {driverChecklist.dashboardStatus}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-center text-zinc-500 uppercase">Painel</p>
                      </div>
                      <div className="space-y-2">
                        <div className="aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 relative">
                          <img src={driverChecklist.tirePhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className={cn(
                            "absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase text-white",
                            driverChecklist.tireStatus === 'ok' ? "bg-emerald-500" : driverChecklist.tireStatus === 'attention' ? "bg-amber-500" : "bg-red-500"
                          )}>
                            {driverChecklist.tireStatus}
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-center text-zinc-500 uppercase">Pneus</p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Delivery Report */}
                {driverDelivery && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Relatório de Entregas</h4>
                    <div className="grid grid-cols-3 gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Realizadas</p>
                        <p className="text-xl font-black text-emerald-700">{driverDelivery.delivered}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Devolvidas</p>
                        <p className="text-xl font-black text-emerald-700">{driverDelivery.returned}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Total</p>
                        <p className="text-xl font-black text-emerald-700">{driverDelivery.total}</p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Chat Section */}
                <section className="space-y-4">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Chat Direto</h4>
                  <div className="h-[400px]">
                    <ChatView driverId={selectedDriverId} user={auth.currentUser!} isAdmin={true} />
                  </div>
                </section>

                {/* Expense Receipt */}
                {driverExpense && (
                  <section className="space-y-4 pb-6">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Comprovante de Despesa</h4>
                    <div className="flex gap-4 items-start">
                      <div className="w-32 aspect-[3/4] bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 flex-shrink-0">
                        <img src={driverExpense.receiptPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Combustível</span>
                          <span className="font-bold">R$ {driverExpense.fuel || '0,00'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Pedágio</span>
                          <span className="font-bold">R$ {driverExpense.toll || '0,00'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Manutenção</span>
                          <span className="font-bold">R$ {driverExpense.maintenance || '0,00'}</span>
                        </div>
                        <div className="h-px bg-zinc-100 my-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-900 font-bold">Total</span>
                          <span className="font-black text-emerald-600">R$ {(Number(driverExpense.fuel || 0) + Number(driverExpense.toll || 0) + Number(driverExpense.maintenance || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- UI Components ---

function Input({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
      />
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all gap-4 group",
        color
      )}
    >
      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:scale-110 transition-all duration-300">
        <Icon className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" />
      </div>
      <span className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.15em] text-center leading-tight">{label}</span>
    </button>
  );
}

function PhotoCard({ label, photo, onTake }: { label: string, photo?: string, onTake: (file: File) => void }) {
  const id = React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onTake(file);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">{label}</p>
      <div className="relative group">
        <input 
          type="file" 
          id={id}
          onChange={handleChange} 
          accept="image/*" 
          capture="environment"
          className="hidden" 
        />
        <label 
          htmlFor={id}
          className={cn(
            "block w-full aspect-video rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden relative",
            photo 
              ? "border-emerald-500 bg-emerald-50" 
              : "border-zinc-200 bg-zinc-50 hover:border-emerald-300 hover:bg-emerald-50/30"
          )}
        >
          {photo ? (
            <>
              <img src={photo} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-zinc-300 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-300">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Clique para fotografar</p>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: any) {
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

function MapAssistant({ location, isOpen, onClose }: { location?: { latitude: number; longitude: number }, isOpen: boolean, onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, links?: { title: string, uri: string }[] }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const result = await queryMapAssistant(userMsg, location);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.text,
        links: result.links
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Desculpe, ocorreu um erro ao processar sua solicitação de mapa." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[600px]"
      >
        {/* Header */}
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight italic font-display">Assistente de Mapa</h3>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Powered by Gemini</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50">
          {messages.length === 0 && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-zinc-900 uppercase text-xs tracking-widest">Como posso ajudar?</p>
                <p className="text-zinc-500 text-[10px] font-medium max-w-[200px] mx-auto">Pergunte sobre postos, restaurantes ou rotas próximas.</p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium leading-relaxed",
                msg.role === 'user' 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-100 shadow-sm rounded-tl-none"
              )}>
                {msg.content}
                
                {msg.links && msg.links.length > 0 && (
                  <div className="mt-4 space-y-2 pt-4 border-t border-zinc-100">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Locais Encontrados:</p>
                    {msg.links.map((link, lIdx) => (
                      <a 
                        key={lIdx}
                        href={link.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors group"
                      >
                        <span className="text-[10px] font-black text-zinc-900 uppercase truncate pr-2">{link.title}</span>
                        <MapPin className="w-3 h-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-zinc-100">
          <div className="flex gap-2">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ex: Postos de gasolina próximos..."
              className="flex-1 bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !query.trim()}
              className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
