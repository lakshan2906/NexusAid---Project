import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { parseEmergencySMS } from '../services/geminiService';
import { reverseGeocode } from '../services/locationService';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MapPin, Package, HeartPulse, User, Phone, Signal, SignalLow, Bluetooth, AlertTriangle, X, CloudOff, Droplets, Navigation, Truck, MessageCircle, CheckCircle, Shield, Zap, Activity, HardHat } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet icon fix
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position);
  }, [position, map]);
  return null;
}

export default function VictimView({ onLogout }: { onLogout: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [smsText, setSmsText] = useState('');
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [peopleCount, setPeopleCount] = useState(1);
  const [injuredCount, setInjuredCount] = useState(0);
  const [disasterName, setDisasterName] = useState('Flood Response 2026'); // Default to a current era disaster
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false); // Default to online for full AI power
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);

  useEffect(() => {
    if (isRegistered && phone) {
      const q = query(
        collection(db, 'requests'),
        where('phone', '==', phone)
      );
      const unsubscribeRequests = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in memory to avoid needing composite index for where + orderBy
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setMyRequests(docs);
      }, (error) => {
        console.error("Firestore Listener Error (requests):", error);
        // Do not throw here to prevent app crash, just log it.
        // handleFirestoreError(error, OperationType.GET, 'requests');
      });

      const qDeliveries = query(collection(db, 'deliveries'));
      const unsubscribeDeliveries = onSnapshot(qDeliveries, (snapshot) => {
        setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Firestore Listener Error (deliveries):", error);
      });

      return () => {
        unsubscribeRequests();
        unsubscribeDeliveries();
      };
    }
  }, [isRegistered, phone]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone) setIsRegistered(true);
  };

  const handleLocate = async () => {
    setIsLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      const readableAddress = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setAddress(readableAddress);
    } catch (err) {
      alert("Please enable location permissions to use this feature.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText && selectedNeeds.length === 0) return;

    setIsSending(true);
    try {
      let extractedData: any = { 
        resourcesNeeded: [], 
        urgency: 'MEDIUM', 
        summary: 'Emergency Aid Request',
        injuredCount: 'Not specified',
        peopleAffected: 'Not specified',
        categories: [],
        recommendedNGO: 'General Relief NGO',
        allocationHint: 'Direct manual entry from victim dashboard.',
        location: address || 'Not specified'
      };

      try {
        if (smsText) {
          extractedData = await parseEmergencySMS(smsText, isOfflineMode);
        }
      } catch (aiError) {
        console.error("AI Parsing failed, falling back to basic data:", aiError);
      }
      
      const manualNeeds = {
        water: selectedNeeds.includes('water') ? 10 : 0,
        food: selectedNeeds.includes('food') ? 5 : 0,
        medical: selectedNeeds.includes('medical') ? 1 : 0,
        shelter: selectedNeeds.includes('shelter') ? 1 : 0,
        clothes: selectedNeeds.includes('clothes') ? 5 : 0,
      };

      let location = { lat: 0, lng: 0, address: address || extractedData.location || "Emergency Location" };
      
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true })
        );
        location.lat = pos.coords.latitude;
        location.lng = pos.coords.longitude;
        if (!address) {
          location.address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        }
      } catch (err) {
        console.warn("Geolocation failed, using manual address context only.");
        if (!location.lat) {
          location.lat = 28.6139 + (Math.random() - 0.5) * 0.05;
          location.lng = 77.2090 + (Math.random() - 0.5) * 0.05;
        }
      }

      // Helper to parse counts from AI or manual input
      const finalInjured = injuredCount > 0 ? injuredCount : (parseInt(extractedData.injuredCount) || 0);
      const finalPeople = peopleCount > 1 ? peopleCount : (parseInt(extractedData.peopleAffected) || 1);

      // Augment AI summary with manual counts for clearer "map summarisation"
      let finalSummary = extractedData.summary || `Help needed for ${finalPeople} people.`;
      if (!finalSummary.includes(`${finalPeople}`) && !finalSummary.includes('people')) {
         finalSummary = `[${finalPeople} People / ${finalInjured} Injured] ${finalSummary}`;
      }

      await addDoc(collection(db, 'requests'), {
        victimName: name,
        phone,
        text: smsText,
        needs: manualNeeds,
        aiAnalysis: extractedData,
        injuredCount: finalInjured,
        peopleCount: finalPeople,
        urgency: finalInjured > 0 ? 'HIGH' : extractedData.urgency,
        summary: finalSummary,
        location,
        disasterName,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'requests'));

      setSmsText('');
      setAddress('');
      setSelectedNeeds([]);
      setPeopleCount(1);
      setInjuredCount(0);
      setShowSuccess(true);
      // Auto-hide success after 8 seconds
      setTimeout(() => setShowSuccess(false), 8000);
    } catch (error) {
      console.error("Error sending request:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-neutral-light dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl w-full max-w-md border dark:border-white/5 transition-colors"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-brand-primary/20 p-4 rounded-full">
              <HeartPulse className="w-12 h-12 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-center mb-2 dark:text-white">NexusAid</h1>
          <p className="text-muted-foreground text-center mb-8 dark:text-gray-400">Disaster Response Quick Access</p>
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 dark:text-white border border-gray-100 dark:border-none rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input 
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 dark:text-white border border-gray-100 dark:border-none rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-colors"
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onLogout}
                className="flex-1 text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold uppercase transition-colors"
              >
                Back
              </button>
              <button 
                type="submit"
                className="flex-2 bg-brand-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
              >
                Start Rescue
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-500">
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-brand-primary/10 flex items-center justify-between px-4 sm:px-10 z-40 transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-110 transition-transform cursor-pointer">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-display font-black text-xl text-neutral-dark dark:text-white uppercase tracking-tight italic">NexusAid SOS</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={() => setIsOfflineMode(!isOfflineMode)}
             className={`flex items-center gap-3 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
               isOfflineMode 
               ? 'bg-amber-50/50 text-amber-700 border-amber-200' 
               : 'bg-brand-accent text-brand-primary border-brand-primary/10'
             }`}
           >
             <SignalLow className={`w-3 h-3 ${isOfflineMode ? 'animate-pulse text-amber-600' : 'text-brand-primary'}`} />
             {isOfflineMode ? 'Mesh Link' : 'Secure Sync'}
           </button>
           <button 
             onClick={onLogout}
             className="p-3 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-2xl transition-all"
           >
             <X className="w-6 h-6" />
           </button>
        </div>
      </header>

      <main className="flex-1 pt-28 pb-32 px-4 sm:px-6 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!showSuccess ? (
            <motion.div 
              key="sos-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[40px] sm:rounded-[56px] border border-brand-primary/5 dark:border-white/5 shadow-elegant relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
                
                <div className="flex justify-between items-center mb-10 relative z-10">
                  <div>
                    <h2 className="text-3xl font-display font-black dark:text-white uppercase tracking-tight italic text-brand-primary">Emergency SOS</h2>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] font-mono mt-1">Status: Broadcasting Protocol</p>
                  </div>
                  <div className="bg-red-50 text-red-600 p-3.5 rounded-[20px] border border-red-100 shadow-sm animate-pulse">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <form onSubmit={handleSubmitRequest} className="space-y-8 relative z-10">
                  {/* Location Context */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Verified Location</label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <MapPin className="absolute left-4 top-4 w-5 h-5 text-brand-primary" />
                        <input 
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Detecting coordinates..."
                          className="w-full pl-12 pr-4 py-4 bg-brand-accent/50 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleLocate}
                        disabled={isLocating}
                        className="bg-brand-primary p-4 rounded-2xl text-white shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        {isLocating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Navigation className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Impact Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">People at Location</label>
                      <input 
                        type="number"
                        min="1"
                        value={peopleCount}
                        onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white text-center font-black"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] ml-1">Injuries Reported</label>
                      <input 
                        type="number"
                        min="0"
                        value={injuredCount}
                        onChange={(e) => setInjuredCount(parseInt(e.target.value) || 0)}
                        className="w-full bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-red-500 text-center font-black text-red-600"
                      />
                    </div>
                  </div>

                  {/* Needs Grid */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Critical Relief Required</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {[
                        { id: 'water', label: 'Water', icon: <Droplets /> },
                        { id: 'food', label: 'Food', icon: <Package /> },
                        { id: 'medical', label: 'Medical', icon: <HeartPulse /> },
                        { id: 'shelter', label: 'Shelter', icon: <X /> },
                        { id: 'clothes', label: 'Clothing', icon: <User /> },
                        { id: 'evac', label: 'Evac', icon: <Truck /> },
                      ].map(need => (
                        <button 
                          key={need.id}
                          type="button"
                          onClick={() => {
                            if (selectedNeeds.includes(need.id)) {
                              setSelectedNeeds(selectedNeeds.filter(n => n !== need.id));
                            } else {
                              setSelectedNeeds([...selectedNeeds, need.id]);
                            }
                          }}
                          className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${
                            selectedNeeds.includes(need.id)
                            ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-105'
                            : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-white/5 text-gray-400 hover:border-brand-primary/30'
                          }`}
                        >
                          {React.cloneElement(need.icon as React.ReactElement, { className: 'w-5 h-5' })}
                          <span className="text-[9px] font-black uppercase tracking-widest">{need.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Context */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Situation Summary</label>
                    <textarea 
                      value={smsText}
                      onChange={(e) => setSmsText(e.target.value)}
                      placeholder="Briefly describe the emergency context..."
                      className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white text-sm h-32 resize-none transition-all placeholder:text-gray-300 font-medium leading-relaxed"
                    />
                  </div>

                  <button 
                    disabled={isSending || (!smsText && selectedNeeds.length === 0)}
                    className="w-full bg-red-600 text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] shadow-xl shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-4"
                  >
                    {isSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-5 h-5" />}
                    Broadcast Signal
                  </button>
                </form>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] ml-4">Broadcast History</h3>
                <div className="space-y-6">
                  {myRequests.map((req) => (
                    <motion.div 
                      key={req.id} 
                      className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-brand-primary/5 dark:border-white/5 shadow-elegant relative overflow-hidden group transition-all"
                    >
                       <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-white shadow-lg ${
                               req.status === 'completed' ? 'bg-emerald-500 shadow-emerald-500/20' :
                               req.status === 'assigned' ? 'bg-brand-primary shadow-brand-primary/20' : 'bg-orange-500 shadow-orange-500/20'
                             }`}>
                               {req.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : 
                                req.status === 'assigned' ? <Truck className="w-6 h-6" /> : 
                                <Activity className="w-6 h-6" />}
                             </div>
                             <div>
                               <h4 className="font-display font-black text-lg dark:text-white uppercase tracking-tight italic">{req.status}</h4>
                               <p className="text-[9px] text-gray-400 uppercase tracking-widest font-mono">ID: {req.id.slice(-6)}</p>
                             </div>
                          </div>
                          <div className="text-[10px] text-brand-primary font-black uppercase tracking-widest bg-brand-accent px-3 py-1.5 rounded-xl">
                            {new Date(req.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                       </div>
                       <p className="text-sm dark:text-gray-300 leading-relaxed font-medium mb-2 italic">"{req.summary}"</p>
                       <div className="flex flex-wrap gap-2 mt-4">
                         {req.peopleCount > 1 && (
                           <span className="bg-blue-50 text-blue-600 text-[10px] px-3 py-1 rounded-lg font-black uppercase">{req.peopleCount} People</span>
                         )}
                         {req.injuredCount > 0 && (
                           <span className="bg-red-50 text-red-600 text-[10px] px-3 py-1 rounded-lg font-black uppercase">{req.injuredCount} Injured</span>
                         )}
                       </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 p-8 sm:p-16 rounded-[40px] sm:rounded-[60px] border border-emerald-100 dark:border-emerald-900/30 shadow-active text-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-50/20 dark:bg-emerald-900/10 pointer-events-none" />
              <div className="relative z-10">
                <div className="w-28 h-28 bg-emerald-100 dark:bg-emerald-500/20 rounded-[40px] flex items-center justify-center mx-auto mb-12 shadow-xl shadow-emerald-500/10">
                  <CheckCircle className="w-14 h-14 text-emerald-500" />
                </div>
                <h2 className="text-5xl font-display font-black mb-6 dark:text-white tracking-tighter uppercase italic leading-[0.85]">Signal<br /><span className="text-emerald-500">Optimized</span></h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-12 font-medium leading-relaxed">
                  Broadcast success. Response fleets in your sector have been synchronized.
                </p>
                <button 
                  onClick={() => setShowSuccess(false)}
                  className="w-full bg-brand-primary text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Status Indicator */}
      {myRequests.length > 0 && !showSuccess && (
         <motion.div 
           initial={{ y: 100 }}
           animate={{ i: 0 }}
           className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-lg z-40"
         >
            <div className="bg-neutral-dark/95 dark:bg-slate-900/95 text-white p-5 px-10 rounded-[40px] shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-2xl">
               <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,1)]" />
                    <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-50" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 font-mono mb-0.5">Crisis_Mesh Status</p>
                    <p className="text-[11px] font-black font-display uppercase tracking-widest text-emerald-400">Tactical Optimization Active</p>
                  </div>
               </div>
               <div className="flex -space-x-3">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-8 h-8 rounded-full border-2 border-neutral-dark bg-brand-primary/30 backdrop-blur-sm flex items-center justify-center text-[10px] font-black shadow-lg">
                     {i}
                   </div>
                 ))}
               </div>
            </div>
         </motion.div>
      )}
    </div>
  );
}
