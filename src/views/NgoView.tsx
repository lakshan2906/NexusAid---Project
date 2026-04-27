import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Package, HeartPulse, Truck, Navigation, AlertTriangle, CheckCircle, BarChart3, Activity, Users, Settings, Bluetooth, SignalLow, X, MessageCircle, GitBranch, HardHat, Zap, Ghost, EyeOff, Map as MapIcon, History as HistoryIcon, FolderOpen, Menu } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import RoutingMachine from '../components/RoutingMachine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import * as d3 from 'd3';

// Marker icon fix for Leaflet
import L from 'leaflet';
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const BaseIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [35, 52],
    iconAnchor: [17, 52],
    className: 'hue-rotate-[140deg] brightness-125' // Makes the base pin distinctly different (Purple/Indigo)
});

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${
        active 
        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25 translate-x-1' 
        : 'text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-neutral-dark dark:hover:text-white'
      }`}
    >
      <div className={`transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-12'}`}>
        {icon}
      </div>
      <span className={`text-sm font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
        {label}
      </span>
    </button>
  );
}

function StatCard({ label, value, icon, color, action, critical }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] md:rounded-[48px] border border-brand-primary/5 dark:border-white/5 shadow-elegant relative transition-all hover:shadow-active group min-h-[280px] flex flex-col justify-between">
      {/* Background decoration moved to avoid any intersection with text/buttons */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700 pointer-events-none z-0" />
      
      <div className="flex items-start relative z-10 w-full mb-4">
        <div className={`${color} bg-brand-accent/40 dark:bg-white/5 p-4 rounded-2xl md:rounded-3xl shadow-sm flex-shrink-0`}>
          {React.cloneElement(icon, { className: `w-6 h-6 ${color}` })}
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        <div className="mb-6">
          {critical && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200/50 dark:border-red-800/30 mb-3 animate-pulse">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[9px] font-display font-black text-red-500 tracking-widest uppercase">Emergency</span>
            </div>
          )}
          <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mb-1 font-mono">{label}</p>
          <p className={`text-4xl md:text-5xl font-display font-black tracking-tighter dark:text-white ${color}`}>
            {value}
          </p>
        </div>
        
        {action && (
          <div className="w-full">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className="w-full bg-brand-primary text-white text-[10px] py-4 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-brand-primary/90 active:scale-[0.98] transition-all shadow-xl shadow-brand-primary/20 cursor-pointer"
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NgoView({ onLogout }: { onLogout: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ngoCredentials, setNgoCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [ngoLocation] = useState({ lat: 28.6139, lng: 77.2090 }); // Mock NGO Base (New Delhi)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'reports' | 'network' | 'archive'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [routingEndpoint, setRoutingEndpoint] = useState<any>(null);
  const [obstacles, setObstacles] = useState<any[]>([]);
  const [isReportingObstacle, setIsReportingObstacle] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [mapZoom, setMapZoom] = useState(13);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Firestore Listener Error (requests):", error);
    });

    const obstaclesQ = query(collection(db, 'obstacles'), orderBy('createdAt', 'desc'));
    const unsubObstacles = onSnapshot(obstaclesQ, (snapshot) => {
      // Filter in memory to avoid index requirements for '!=' queries
      const allObs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setObstacles(allObs.filter((o: any) => o.type !== 'deleted'));
    }, (error) => {
      console.error("Firestore Listener Error (obstacles):", error);
    });

    return () => {
      unsubRequests();
      unsubObstacles();
    };
  }, []);

  // Personnel Location Simulation Hook
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const q = query(collection(db, 'deliveries'), where('status', '==', 'en-route'));
        const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.GET, 'deliveries'));
        if (!snapshot) return;
        
        for (const d of snapshot.docs) {
          const data = d.data();
          const reqDoc = requests.find(r => r.id === data.requestId);
          if (!reqDoc || !reqDoc.location) continue;

          // Simple vector movement towards target
          const currentLat = data.currentLocation.lat;
          const currentLng = data.currentLocation.lng;
          const targetLat = parseFloat(reqDoc.location.lat);
          const targetLng = parseFloat(reqDoc.location.lng);

          const distLat = targetLat - currentLat;
          const distLng = targetLng - currentLng;
          
          // If close enough, don't move or complete it (we'll let the user complete it)
          if (Math.abs(distLat) < 0.0001 && Math.abs(distLng) < 0.0001) continue;

          const step = 0.0005; // Simulation speed
          const angle = Math.atan2(distLat, distLng);
          
          const nextLat = currentLat + Math.sin(angle) * step;
          const nextLng = currentLng + Math.cos(angle) * step;

          await updateDoc(doc(db, 'deliveries', d.id), {
            currentLocation: { lat: nextLat, lng: nextLng },
            updatedAt: serverTimestamp()
          }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `deliveries/${d.id}`));
        }
      } catch (err) {
        console.error("Simulation Error:", err);
      }
    }, 4000); // Update every 4 seconds for a smooth feel

    return () => clearInterval(interval);
  }, [isAuthenticated, requests]);

  const handleAssignTask = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'assigned',
        updatedAt: serverTimestamp()
      });
      // Create a delivery record
      await addDoc(collection(db, 'deliveries'), {
        requestId,
        status: 'en-route',
        driverName: "Sarah Jenkins",
        currentLocation: { lat: ngoLocation.lat, lng: ngoLocation.lng },
        updatedAt: serverTimestamp()
      });
      
      // Auto-navigate to map after assignment if we are not already there
      const req = requests.find(r => r.id === requestId);
      if (req) {
        setRoutingEndpoint(req);
        setActiveTab('map');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'requests/deliveries');
    }
  };

  const handleCompleteTask = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const handleSendReply = async (requestId: string) => {
    if (!replyMessage.trim()) return;
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        ngoReply: replyMessage,
        updatedAt: serverTimestamp()
      });
      setReplyMessage('');
      setReplyingTo(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const handleReportObstacle = async (lat: number, lng: number) => {
    if (!isReportingObstacle) return;
    
    try {
      await addDoc(collection(db, 'obstacles'), {
        lat,
        lng,
        type: 'road-block',
        severity: 'high',
        description: 'Broken road/Debris reported by field crew',
        createdAt: serverTimestamp()
      });
      
      setIsReportingObstacle(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'obstacles');
    }
  };

  const handleDeleteObstacle = async (id: string) => {
    try {
      await updateDoc(doc(db, 'obstacles', id), {
          status: 'cleared',
          deletedAt: serverTimestamp()
      });
      // Actually deleting is better for this simulation since we don't need history
      // But let's just filter them out if we use status or just delete
      await updateDoc(doc(db, 'obstacles', id), { type: 'deleted' }); // Hidden type
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `obstacles/${id}`);
    }
  };
  
  // Actually just delete it for simplicity in this crisis app
  const deleteObstacle = async (id: string) => {
    try {
      await addDoc(collection(db, 'logs'), { action: 'delete_obstacle', obstacleId: id, timestamp: serverTimestamp() });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'logs');
    }
    // Note: In real app we delete the doc. Here let's just mark it.
    // I'll update the listener to filter out deleted ones.
  };

  const startNav = () => {
    if (!routingEndpoint) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${ngoLocation.lat},${ngoLocation.lng}&destination=${routingEndpoint.location.lat},${routingEndpoint.location.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  function MapEvents() {
    useMapEvents({
      click: (e) => {
        if (isReportingObstacle) {
          handleReportObstacle(e.latlng.lat, e.latlng.lng);
        }
      },
    });
    return null;
  }

  const handleNgoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (ngoCredentials.username === 'ADMIN' && ngoCredentials.password === 'ADMIN') {
      setIsAuthenticated(true);
    } else {
      setLoginError('Invalid NGO Command Credentials');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 transition-colors">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-2xl border border-gray-100 dark:border-white/5"
        >
          <div className="flex justify-center mb-8">
            <div className="bg-brand-primary p-5 rounded-3xl shadow-lg shadow-brand-primary/20">
              <HardHat className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-display font-black text-center mb-2 dark:text-white">NGO Command</h2>
          <p className="text-gray-500 text-center text-sm mb-10">Fleet Management Authorization Required</p>
          
          {loginError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-xs font-bold mb-6 text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleNgoLogin} className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black mb-1.5 block px-1 font-mono">Tactical ID</label>
              <input 
                type="text" 
                value={ngoCredentials.username}
                onChange={(e) => setNgoCredentials(p => ({ ...p, username: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white transition-colors"
                placeholder="ADMIN"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black mb-1.5 block px-1 font-mono">Access Key</label>
              <input 
                type="password" 
                value={ngoCredentials.password}
                onChange={(e) => setNgoCredentials(p => ({ ...p, password: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex gap-4 pt-6">
              <button 
                type="button"
                onClick={onLogout}
                className="flex-1 text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold uppercase transition-colors"
              >
                Back
              </button>
              <button 
                type="submit"
                className="flex-2 bg-brand-primary text-white py-4 px-8 rounded-2xl font-bold transition-all shadow-lg shadow-brand-primary/20 hover:scale-[1.02]"
              >
                AUTHORIZE
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  const findShortestRoute = () => {
    if (requests.length === 0) return;
    
    // Sort pending requests by distance (Haversine simple distance for simulation)
    const pendingWithDist = requests
      .filter(r => r.status === 'pending' && r.location?.lat)
      .map(r => {
        const d = Math.sqrt(
          Math.pow(r.location.lat - ngoLocation.lat, 2) + 
          Math.pow(r.location.lng - ngoLocation.lng, 2)
        );
        return { ...r, distance: d };
      })
      .sort((a, b) => a.distance - b.distance);

    if (pendingWithDist.length > 0) {
      setRoutingEndpoint(pendingWithDist[0]);
      setActiveTab('map');
    }
  };

  const statsData = [
    { name: '08:00', requests: 12, resolved: 8 },
    { name: '10:00', requests: 25, resolved: 15 },
    { name: '12:00', requests: 45, resolved: 30 },
    { name: '14:00', requests: 38, resolved: 42 },
    { name: '16:00', requests: 20, resolved: 35 },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-light dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-white dark:bg-slate-900 text-neutral-dark dark:text-white flex flex-col transition-all duration-300 shadow-elegant border-r border-brand-primary/5 dark:border-white/5 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 md:p-10 border-b border-brand-primary/5 dark:border-white/5 bg-brand-accent/30 dark:bg-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-brand-primary p-3 rounded-2xl shadow-xl shadow-brand-primary/20">
                <HeartPulse className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-black text-2xl tracking-tighter uppercase italic text-brand-primary">NexusAid</span>
            </div>
            <button className="md:hidden p-2 text-gray-400 hover:text-brand-primary" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-6 px-1">
            <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(155,107,255,1)]" />
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.3em] font-mono">Node_Command_07</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 mt-8 space-y-1.5">
          <NavItem 
            icon={<Activity className="w-5 h-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Navigation className="w-5 h-5" />} 
            label="Fleet Control" 
            active={activeTab === 'map'} 
            onClick={() => { setActiveTab('map'); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<BarChart3 className="w-5 h-5" />} 
            label="Analytics" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <NavItem 
            icon={<GitBranch className="w-5 h-5" />} 
            label="Topology" 
            active={activeTab === 'network'} 
            onClick={() => setActiveTab('network')} 
          />
          <NavItem 
            icon={<HistoryIcon className="w-5 h-5" />} 
            label="Crisis Archive" 
            active={activeTab === 'archive'} 
            onClick={() => setActiveTab('archive')} 
          />
        </nav>

        <div className="p-6 border-t border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
           <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5">
             <p className="text-[10px] text-gray-400 mb-1 font-mono uppercase tracking-widest font-black">Active Personnel</p>
             <div className="flex items-end gap-2">
               <p className="text-2xl font-black text-neutral-dark dark:text-white">128</p>
               <p className="text-[10px] text-green-500 font-bold mb-1">+12h</p>
             </div>
             <div className="mt-3 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '75%' }}
                 transition={{ duration: 1 }}
                 className="h-full bg-brand-primary rounded-full shadow-[0_0_8px_rgba(138,79,255,0.4)]" 
               />
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-neutral-light dark:bg-slate-950">
        <header className="h-20 md:h-24 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-brand-primary/5 dark:border-white/5 flex items-center justify-between px-4 md:px-12 transition-all sticky top-0 z-20">
           <div className="flex items-center gap-4">
             <button className="md:hidden p-2 bg-brand-primary/10 rounded-xl text-brand-primary" onClick={() => setIsSidebarOpen(true)}>
               <Menu className="w-6 h-6" />
             </button>
             <div>
               <h1 className="text-lg md:text-2xl font-display font-black text-neutral-dark dark:text-white uppercase tracking-tight italic">{activeTab}</h1>
               <div className="hidden sm:flex items-center gap-3 mt-1">
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Neural Sync Active</p>
                 <div className="w-1 h-1 bg-brand-primary/30 rounded-full" />
                 <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em]">Node_Alpha</p>
               </div>
             </div>
           </div>
           <div className="flex items-center gap-2 md:gap-8">
             <div 
               onClick={() => setIsOfflineMode(!isOfflineMode)}
               className={`hidden lg:flex items-center gap-4 cursor-pointer px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                 isOfflineMode 
                 ? 'bg-amber-50 text-amber-700 border-amber-200' 
                 : 'bg-brand-accent text-brand-primary border-brand-primary/10'
               }`}
             >
               <div className={`w-2 h-2 rounded-full ${isOfflineMode ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(155,107,255,0.8)]'}`} />
               {isOfflineMode ? 'Mesh Overlay' : 'Secure Sync'}
             </div>
             
             <div className="hidden sm:block h-10 w-[1px] bg-gray-100 dark:bg-white/10" />
             
             <div className="hidden sm:block h-10 w-[1px] bg-gray-100 dark:bg-white/10" />

             <button 
               onClick={onLogout}
               className="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center gap-2 px-4 group"
             >
               <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
               <span className="text-[10px] font-black uppercase tracking-widest">Disconnect</span>
             </button>
           </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-10">
          {activeTab === 'dashboard' && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-10 h-full">
              <div className="lg:col-span-8 space-y-6 md:space-y-8 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8 relative z-10">
                   <StatCard 
                     label="Survivors Aided"
                     value={requests.filter(r => r.status === 'completed').reduce((acc, r) => acc + (Number(r.peopleCount) || 0), 0)}
                     icon={<Users className="w-6 h-6" />}
                     color="text-brand-secondary"
                     border="border-brand-secondary"
                   />
                   <StatCard 
                     label="Injured Personnel"
                     value={requests.filter(r => r.status === 'pending' || r.status === 'assigned').reduce((acc, r) => acc + (Number(r.injuredCount) || 0), 0)}
                     icon={<AlertTriangle className="w-6 h-6" />}
                     color="text-red-500"
                     border="border-red-500"
                     critical
                   />
                   <StatCard 
                     label="Pending SOS"
                     value={requests.filter(r => r.status === 'pending').length}
                     icon={<Activity className="w-6 h-6" />}
                     color="text-brand-primary"
                     border="border-brand-primary"
                     action={{ label: "Optimized Route", onClick: findShortestRoute }}
                   />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-white/5 shadow-elegant overflow-hidden pb-10 relative transition-all">
                  <div className="p-6 md:p-8 border-b border-gray-50 dark:border-white/5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <h2 className="font-display font-black text-lg flex items-center gap-3 dark:text-white uppercase tracking-tight">
                       <Activity className="w-6 h-6 text-brand-primary" />
                       Incoming SOS Pulse
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Last Update: Just Now</span>
                      <div className="bg-brand-primary/10 px-3 py-1.5 rounded-full">
                        <div className="text-[10px] text-brand-primary font-black uppercase tracking-widest animate-pulse flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-brand-primary rounded-full" /> Live Core
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-[800px] overflow-auto custom-scrollbar">
                    {requests.map((req) => (
                      <div 
                        key={`sidebar-req-${req.id}`} 
                        onClick={() => setSelectedRequest(req)}
                        className={`p-6 transition-all cursor-pointer hover:bg-brand-accent/50 dark:hover:bg-brand-primary/5 border-l-4 relative ${
                          ['critical', 'HIGH'].includes(req.urgency) ? 'border-red-500' : 
                          ['high', 'MEDIUM'].includes(req.urgency) ? 'border-brand-primary' : 
                          'border-brand-secondary'
                        } ${selectedRequest?.id === req.id ? 'bg-brand-accent dark:bg-brand-primary/10' : ''}`}
                      >
                         <div className="flex justify-between items-start mb-2">
                            <div>
                               <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm dark:text-white">{req.victimName} • {req.phone}</h3>
                                   {req.disasterName && (
                                     <span className="bg-slate-900 text-white dark:bg-slate-700 text-[8px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tight whitespace-nowrap">
                                       {req.disasterName}
                                     </span>
                                   )}
                                  <div className="flex gap-1">
                                     <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-200/50">
                                        {req.peopleCount || 1} P
                                     </span>
                                     {req.injuredCount > 0 && (
                                       <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-200/50 animate-pulse">
                                          {req.injuredCount} I
                                       </span>
                                     )}
                                  </div>
                               </div>
                               <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{req.location?.address}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              ['critical', 'HIGH'].includes(req.urgency) ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {req.urgency}
                            </span>
                         </div>
                         <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">{req.summary}</p>
                         
                         <div className="mt-3 flex gap-4 items-center border-y border-gray-50 dark:border-white/5 py-2">
                           <div className="flex items-center gap-1.5">
                             <Users className="w-3.5 h-3.5 text-blue-500" />
                             <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                               People: {req.peopleCount || 0}
                             </span>
                           </div>
                           <div className="flex items-center gap-1.5 border-l border-gray-100 dark:border-white/10 pl-4">
                             <AlertTriangle className={`w-3.5 h-3.5 ${req.injuredCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                             <span className={`text-[10px] font-black uppercase ${req.injuredCount > 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                               Injured: {req.injuredCount || 0}
                             </span>
                           </div>
                         </div>

                         {req.aiAnalysis && (
                           <div className="mt-4 space-y-3">
                             <div className="flex flex-wrap gap-1.5">
                               {req.aiAnalysis.categories?.map((cat: string) => (
                                 <span key={cat} className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full text-[9px] font-black uppercase tracking-tighter">
                                   {cat}
                                 </span>
                               ))}
                               <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[9px] font-black uppercase tracking-tighter border border-indigo-500/20">
                                 {req.aiAnalysis.recommendedNGO}
                               </span>
                             </div>
                             <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                               <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-mono italic flex gap-2">
                                 <Zap className="w-3 h-3 text-brand-secondary shrink-0" />
                                 {req.aiAnalysis.allocationHint}
                               </p>
                             </div>
                           </div>
                         )}
                         <div className="mt-4 flex gap-2">
                            {req.status === 'pending' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAssignTask(req.id); }}
                                className="flex-1 bg-brand-primary text-white text-xs font-bold py-2 rounded-lg"
                              >
                                ASSIGN FLEET
                              </button>
                            )}
                            {req.status === 'assigned' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleCompleteTask(req.id); }}
                                className="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg"
                              >
                                MARK DELIVERED
                              </button>
                            )}
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setReplyingTo(replyingTo === req.id ? null : req.id); 
                               }}
                               className="px-3 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg py-2 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                             >
                                REPLY
                             </button>
                         </div>

                         {replyingTo === req.id && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                               <textarea 
                                 placeholder="Send instructions/confirmation to victim..."
                                 value={replyMessage}
                                 onChange={(e) => setReplyMessage(e.target.value)}
                                 className="w-full p-3 text-xs bg-white dark:bg-slate-900 dark:text-white border border-gray-100 dark:border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-brand-primary resize-none h-20 transition-colors"
                               />
                               <div className="mt-2 flex justify-end gap-2">
                                  <button onClick={() => setReplyingTo(null)} className="text-[10px] font-bold text-gray-400 uppercase">Cancel</button>
                                  <button onClick={() => handleSendReply(req.id)} className="bg-brand-primary text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase">Send Message</button>
                               </div>
                            </motion.div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm h-[300px] transition-colors">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Request Density (24h)</h3>
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={statsData}>
                        <defs>
                          <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9F7AEA" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#9F7AEA" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            backgroundColor: 'white'
                          }} 
                        />
                        <Area type="monotone" dataKey="requests" stroke="#9F7AEA" fillOpacity={1} fill="url(#colorReq)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>

                <div className="bg-neutral-dark p-6 rounded-3xl text-white shadow-xl">
                   <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Relay Overlays</h3>
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <Bluetooth className="w-5 h-5 text-brand-primary" />
                        <div>
                          <p className="text-xs font-bold">Bluetooth Mesh P2P</p>
                          <p className="text-[10px] text-gray-400">4 civilian nodes active in 1km radius</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <SignalLow className="w-5 h-5 text-brand-secondary" />
                        <div>
                          <p className="text-xs font-bold">Offline Navigation</p>
                          <p className="text-[10px] text-gray-400">Vector tiles cached for New Delhi Region</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="h-full flex flex-col xl:flex-row gap-6 md:gap-8">
              <div className="flex-1 min-h-[400px] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 relative transition-colors">
                 <MapContainer center={[ngoLocation.lat, ngoLocation.lng]} zoom={13} className="h-full w-full">
                    <TileLayer
                      url={isOfflineMode 
                        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      }
                    />
                    
                    <Marker position={[ngoLocation.lat, ngoLocation.lng]} icon={BaseIcon}>
                      <Popup>Command Center Base</Popup>
                    </Marker>
 
                    <MapEvents />

                    {routingEndpoint && 
                     !isNaN(parseFloat(routingEndpoint.location?.lat)) && 
                     !isNaN(parseFloat(routingEndpoint.location?.lng)) && (
                      <RoutingMachine 
                        start={[ngoLocation.lat, ngoLocation.lng]} 
                        end={[parseFloat(routingEndpoint.location.lat), parseFloat(routingEndpoint.location.lng)]}
                        obstacles={obstacles}
                      />
                    )}

                    {obstacles.map(obs => (
                      <Marker 
                        key={`obstacle-${obs.id}`} 
                        position={[obs.lat, obs.lng]}
                        icon={L.divIcon({
                          className: 'custom-obstacle-icon',
                          html: `<div class="bg-red-600 text-white p-1 rounded shadow-lg border-2 border-white flex items-center justify-center transform rotate-45 w-6 h-6">
                                   <div class="transform -rotate-45 font-black text-[10px]">X</div>
                                 </div>`,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12]
                        })}
                      >
                        <Popup>
                          <div className="p-2">
                             <p className="font-bold text-red-600 text-xs text-center">ROAD BLOCKED</p>
                             <p className="text-[10px] text-gray-500 mt-2 text-center">{obs.description}</p>
                             <button 
                               onClick={() => handleDeleteObstacle(obs.id)}
                               className="w-full mt-3 bg-emerald-500 text-white text-[10px] font-black py-1.5 rounded uppercase hover:bg-emerald-600 transition-colors"
                             >
                               Mark as Cleared
                             </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {requests.map(req => {
                      const lat = parseFloat(req.location?.lat);
                      const lng = parseFloat(req.location?.lng);
                      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

                      // Custom Pulsating Icon for Urgent SOS
                      const urgentIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div class="relative flex items-center justify-center">
                                 <div class="absolute w-8 h-8 rounded-full ${req.urgency === 'critical' ? 'bg-red-500' : 'bg-orange-500'} animate-ping opacity-25"></div>
                                 <div class="z-10 w-4 h-4 rounded-full ${req.urgency === 'critical' ? 'bg-red-600 border-2 border-white' : 'bg-orange-500 border-2 border-white'} shadow-lg"></div>
                               </div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                      });

                      return (
                        <Marker 
                          key={`map-marker-${req.id}`} 
                          position={[lat, lng]}
                          opacity={req.status === 'completed' ? 0.4 : 1}
                          icon={(req.urgency === 'critical' || req.urgency === 'high') ? urgentIcon : BaseIcon}
                          eventHandlers={{
                            click: (e) => {
                              setRoutingEndpoint(req);
                              const mapInstance = e.target?._map;
                              if (mapInstance) {
                                try {
                                  mapInstance.setView(e.latlng, 16, { animate: true });
                                } catch (err) {
                                  console.warn("Map view update failed:", err);
                                }
                                setTimeout(() => {
                                  if (e.target && e.target._map) {
                                    try {
                                      e.target.openPopup();
                                    } catch (err) {
                                      // Popup might have been removed
                                    }
                                  }
                                }, 100);
                              }
                            }
                          }}
                        >
                        <Popup>
                          <div className="p-3 min-w-[220px] dark:text-white transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <p className="font-black text-sm uppercase tracking-tight">{req.victimName}</p>
                                {req.urgency === 'critical' && (
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" title="CRITICAL SOS" />
                                )}
                              </div>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                req.urgency === 'critical' ? 'bg-red-600 text-white shadow-sm' :
                                req.urgency === 'high' ? 'bg-orange-100 text-orange-600' : 
                                'bg-brand-primary/10 text-brand-primary'
                              }`}>
                                {req.urgency}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-gray-900 font-bold mb-1 italic">"{req.summary}"</p>
                            <p className="text-[10px] text-gray-500 mb-2 leading-tight">{req.location.address}</p>
                            
                            <div className="grid grid-cols-2 gap-2 mb-3">
                               <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                 <div className="flex items-center gap-1 mb-1">
                                   <Users className="w-3 h-3 text-blue-500" />
                                   <p className="text-[9px] text-blue-500 font-bold uppercase">People Affected</p>
                                 </div>
                                 <p className="text-base font-black dark:text-white">{req.peopleCount || 1}</p>
                               </div>
                               <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl border border-red-100 dark:border-red-800/30">
                                 <div className="flex items-center gap-1 mb-1">
                                   <AlertTriangle className="w-3 h-3 text-red-500" />
                                   <p className="text-[9px] text-red-500 font-bold uppercase">Injuries Reported</p>
                                 </div>
                                 <p className="text-base font-black text-red-600 dark:text-red-400">{req.injuredCount || 0}</p>
                               </div>
                            </div>

                            <div className="flex flex-wrap gap-1 mb-4">
                               {req.needs && Object.entries(req.needs).map(([need, amount]: [string, any]) => amount > 0 && (
                                 <span key={`map-pop-need-${req.id}-${need}`} className="bg-brand-primary/5 text-brand-primary text-[9px] px-2 py-1 rounded-md font-bold uppercase">
                                   {need}
                                 </span>
                               ))}
                            </div>

                            <div className="flex gap-2">
                              {req.status === 'pending' ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAssignTask(req.id); }}
                                  className="flex-1 bg-brand-primary text-white text-[10px] py-2 rounded-xl font-bold shadow-sm shadow-brand-primary/20 hover:scale-[1.02] transition-all"
                                >
                                  ASSIGN FLEET
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setRoutingEndpoint(req)}
                                  className="flex-1 bg-brand-primary text-white text-[10px] py-2 rounded-xl font-bold shadow-sm shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                  Route to Goal
                                </button>
                              )}
                               <button 
                                onClick={() => handleCompleteTask(req.id)}
                                className="px-3 bg-green-50 text-green-600 border border-green-100 rounded-xl hover:bg-green-100 transition-all"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </Popup>
                        </Marker>
                      );
                    })}
                 </MapContainer>
              </div>

              <div className="w-80 space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                   <h3 className="font-bold text-sm mb-4 dark:text-white">Tactical Routing</h3>
                   <div className="space-y-3">
                      <button 
                        onClick={() => setIsReportingObstacle(!isReportingObstacle)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                          isReportingObstacle 
                          ? 'bg-red-500 text-white border-red-500 animate-pulse font-black shadow-lg shadow-red-500/20' 
                          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-white/5 hover:border-red-500 hover:text-red-500'
                        }`}
                      >
                        {isReportingObstacle ? (
                          <> <EyeOff className="w-4 h-4" /> CLICK MAP TO MARK BLOCK </>
                        ) : (
                          <> <AlertTriangle className="w-4 h-4" /> REPORT ROAD BLOCKAGE </>
                        )}
                      </button>
                      {routingEndpoint ? (
                        <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl">
                           <div className="flex justify-between items-center mb-2">
                             <p className="text-[10px] font-bold text-brand-primary uppercase">Current Target</p>
                             <button onClick={() => setRoutingEndpoint(null)}><X className="w-3 h-3 text-gray-400" /></button>
                           </div>
                           <p className="font-bold text-sm dark:text-white">{routingEndpoint.victimName}</p>
                           <p className="text-xs text-gray-500 mb-3">{routingEndpoint.location.address}</p>
                           
                           {routingEndpoint.status === 'pending' ? (
                             <button 
                               onClick={() => handleAssignTask(routingEndpoint.id)}
                               className="w-full bg-brand-primary text-white py-2 rounded-xl text-xs font-bold animate-pulse"
                             >
                               CONFIRM FLEET ASSIGNMENT
                             </button>
                           ) : (
                             <button 
                               onClick={startNav}
                               className="w-full bg-brand-primary text-white py-2 rounded-xl text-xs font-bold hover:bg-brand-primary/90 transition-colors"
                             >
                               START GPS NAVIGATION
                             </button>
                           )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 text-xs">
                          Select a victim on the map to calculate the shortest path.
                        </div>
                      )}
                      
                      <button 
                        onClick={findShortestRoute}
                        className="w-full border-2 border-gray-100 hover:border-brand-primary text-gray-600 hover:text-brand-primary py-3 rounded-2xl text-xs font-bold transition-all"
                      >
                        Find Nearest Urgent SOS
                      </button>
                   </div>
                </div>

                <div className="bg-neutral-dark p-6 rounded-3xl text-white shadow-xl">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Offline Map Data</p>
                    <div className="flex items-center gap-3">
                       <SignalLow className="w-5 h-5 text-brand-secondary" />
                       <p className="text-xs font-medium">Regional Tiles Cached (50km)</p>
                    </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="h-full space-y-8 overflow-auto custom-scrollbar pr-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Success Rate</p>
                  <p className="text-3xl font-display font-black text-emerald-500">
                    {Math.round((requests.filter(r => r.status === 'completed').length / (requests.length || 1)) * 100)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Avg Response</p>
                  <p className="text-3xl font-display font-black text-brand-primary">12.4m</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Total Salvaged</p>
                  <p className="text-3xl font-display font-black text-orange-500">
                    {requests.reduce((acc, r) => acc + (Number(r.peopleCount) || 0), 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors border-l-4 border-l-red-500">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 text-red-500">Medical Triage</p>
                  <p className="text-3xl font-display font-black text-red-600">
                    {requests.reduce((acc, r) => acc + (Number(r.injuredCount) || 0), 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Fleet Load</p>
                  <p className="text-3xl font-display font-black text-brand-secondary">82%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <h3 className="font-bold flex items-center gap-2 mb-8 dark:text-white">
                    <BarChart3 className="w-5 h-5 text-brand-primary" />
                    Resource Deployment Analysis
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { name: 'Mon', water: 40, food: 24, medical: 24 },
                        { name: 'Tue', water: 30, food: 13, medical: 98 },
                        { name: 'Wed', water: 20, food: 98, medical: 39 },
                        { name: 'Thu', water: 27, food: 39, medical: 48 },
                        { name: 'Fri', water: 18, food: 48, medical: 38 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="water" stroke="#9F7AEA" strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="food" stroke="#63B3ED" strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="medical" stroke="#FEB2B2" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                  <h3 className="font-bold flex items-center gap-2 mb-8 dark:text-white">
                    <Activity className="w-5 h-5 text-orange-500" />
                    救援成功率趋势 (Rescue Success Trend)
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { time: '08:00', rate: 65 },
                        { time: '10:00', rate: 82 },
                        { time: '12:00', rate: 75 },
                        { time: '14:00', rate: 94 },
                        { time: '16:00', rate: 88 },
                      ]}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="rate" stroke="#10B981" fillOpacity={1} fill="url(#colorRate)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-brand-primary text-white p-8 rounded-[40px] shadow-xl shadow-brand-primary/20 relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10">
                  <Truck className="w-64 h-64 -translate-y-12 translate-x-12" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-display font-black mb-2">Fleet Manifest Export</h3>
                  <p className="opacity-80 text-sm mb-6 max-w-md">Download a complete CSV of all rescue missions, victim logs, and resource allocation for regulatory auditing.</p>
                  <button className="bg-white text-brand-primary px-8 py-3 rounded-2xl font-bold hover:scale-105 transition-transform">
                    GENERATE AUDIT REPORT
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'network' && (
            <div className="h-full flex flex-col">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm mb-8 transition-colors">
                <h2 className="font-bold flex items-center gap-2 mb-2 dark:text-white">
                  <GitBranch className="w-5 h-5 text-brand-primary" />
                  Fleet Connectivity Topology
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Real-time status of P2P mesh relay and relief coordination nodes.</p>
              </div>
              
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-colors">
                <NgoConnectivityGraph requests={requests} />
                <div className="absolute bottom-6 left-6 flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] bg-gray-50 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 font-bold transition-colors">
                    <div className="w-2 h-2 rounded-full bg-brand-primary" /> <span className="dark:text-gray-300">Crisis Core</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] bg-gray-50 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 font-bold transition-colors">
                    <div className="w-2 h-2 rounded-full bg-green-500" /> <span className="dark:text-gray-300">Active NGO</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] bg-gray-50 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 font-bold transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gray-400" /> <span className="dark:text-gray-300">Pending SOS</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'archive' && (
            <div className="h-full space-y-8 overflow-auto custom-scrollbar pr-4 pb-20">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-gray-100 dark:border-white/5 shadow-sm transition-colors mb-8">
                <h2 className="text-2xl font-display font-black flex items-center gap-3 mb-2 dark:text-white">
                  <HistoryIcon className="w-8 h-8 text-brand-primary" />
                  Crisis Lifecycle Archive
                </h2>
                <p className="text-gray-500 text-sm max-w-2xl">
                  Chronological "Time Lapse" series of disaster events. All reports are automatically saved and organized by crisis type to allow for post-response auditing and trend analysis.
                </p>
              </div>

              {/* Grouped by Disaster Name */}
              {Array.from(new Set(requests.map(r => r.disasterName || 'Unclassified Event'))).map((disaster, idx) => {
                const disasterRequests = requests
                  .filter(r => (r.disasterName || 'Unclassified Event') === disaster)
                  .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds); // Descending for latest first

                return (
                  <div key={disaster} className="space-y-6">
                    <div className="flex items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                      <div className="bg-brand-primary p-3 rounded-2xl">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black tracking-tight">{disaster}</h3>
                        <p className="text-[10px] opacity-60 uppercase font-black tracking-widest">{disasterRequests.length} Total Incidents Logged</p>
                      </div>
                      <div className="ml-auto flex gap-4">
                        <div className="text-right">
                          <p className="text-[10px] opacity-40 uppercase font-black">Survivors</p>
                          <p className="text-xl font-display font-black text-emerald-400">
                            {disasterRequests.reduce((acc, r) => acc + (Number(r.peopleCount) || 1), 0)}
                          </p>
                        </div>
                        <div className="text-right border-l border-white/10 pl-4">
                          <p className="text-[10px] opacity-40 uppercase font-black">Triage</p>
                          <p className="text-xl font-display font-black text-red-400">
                            {disasterRequests.reduce((acc, r) => acc + (Number(r.injuredCount) || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative pl-8 space-y-4 before:content-[''] before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100 dark:before:bg-white/5">
                      {disasterRequests.map((req, ridx) => {
                        const date = req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'Just now';
                        return (
                          <motion.div 
                            key={req.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: ridx * 0.05 }}
                            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative"
                          >
                            <div className="absolute -left-[25px] top-6 w-3 h-3 rounded-full bg-brand-primary border-4 border-white dark:border-slate-800" />
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                              <span className="text-[10px] font-mono font-black text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded whitespace-nowrap">
                                {date}
                              </span>
                              <div className="flex gap-2">
                                {req.urgency === 'HIGH' && (
                                  <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase pulse">CRITICAL</span>
                                )}
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${req.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                  {req.status}
                                </span>
                              </div>
                            </div>
                            <h4 className="font-bold text-sm dark:text-white">{req.victimName} • {req.location?.address}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">"{req.summary}"</p>
                            
                            <div className="mt-4 flex flex-wrap gap-2">
                               <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded text-[9px] font-bold text-blue-600 dark:text-blue-400">
                                  <Users className="w-3 h-3" /> {req.peopleCount || 1} People
                               </div>
                               {req.injuredCount > 0 && (
                                 <div className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded text-[9px] font-bold text-red-600 dark:text-red-400">
                                    <HeartPulse className="w-3 h-3" /> {req.injuredCount} Injured
                                 </div>
                               )}
                               {req.aiAnalysis?.recommendedNGO && (
                                 <div className="flex items-center gap-1 bg-brand-primary/10 px-2 py-1 rounded text-[9px] font-bold text-brand-primary">
                                    <Truck className="w-3 h-3" /> {req.aiAnalysis.recommendedNGO}
                                 </div>
                               )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {requests.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white dark:bg-slate-900 rounded-[40px] border border-dashed border-gray-200 dark:border-white/10">
                   <Ghost className="w-12 h-12 mb-4 opacity-20" />
                   <p className="font-bold">No historical records found for this sector.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Sub-component for D3 NGO Connectivity Graph
function NgoConnectivityGraph({ requests }: { requests: any[] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (requests.length > 0 && containerRef.current) {
      const containerSize = (containerRef.current as HTMLElement).getBoundingClientRect();
      const width = containerSize.width || 1000;
      const height = containerSize.height || 600;

      const svg = d3.select(containerRef.current)
        .html('')
        .append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'width: 100%; height: 100%;');

      const g = svg.append('g');

      const zoom: any = d3.zoom()
        .scaleExtent([0.5, 5])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      const nodes = [
        { id: 'NGO_CENTRAL', type: 'root', label: 'Crisis Core' },
        { id: 'NGO_A', type: 'ngo', label: 'MedRelief Node' },
        { id: 'NGO_B', type: 'ngo', label: 'FoodBank Node' },
        ...requests.slice(0, 20).map(r => ({ id: r.id, type: 'victim', label: r.victimName, status: r.status }))
      ];

      const links = requests.slice(0, 20).map(r => ({
        source: r.status === 'assigned' ? 'NGO_A' : (r.status === 'completed' ? 'NGO_B' : 'NGO_CENTRAL'),
        target: r.id
      }));

      const simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

      const link = g.append('g')
        .attr('stroke', '#E2E8F0')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', 1.5);

      const nodeGroup = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .call(d3.drag()
          .on('start', (event: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on('drag', (event: any) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on('end', (event: any) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          }) as any);

      nodeGroup.append('circle')
        .attr('r', (d: any) => d.type === 'root' ? 18 : (d.type === 'ngo' ? 12 : 8))
        .attr('fill', (d: any) => d.type === 'root' ? '#9F7AEA' : (d.type === 'ngo' ? '#10B981' : (d.status === 'completed' ? '#BFDBFE' : '#94A3B8')))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

      nodeGroup.append('text')
        .attr('dy', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', '#64748B')
        .style('pointer-events', 'none')
        .text((d: any) => d.label);

      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        nodeGroup.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
      });
    }
  }, [requests]);

  return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}
