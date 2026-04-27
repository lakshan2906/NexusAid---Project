import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import VictimView from './views/VictimView';
import NgoView from './views/NgoView';
import DeveloperView from './views/DeveloperView';
import { Shield, Users, HeartPulse, HardHat, Terminal, Moon, Sun, SignalLow, Zap, GitBranch, CheckCircle, Menu, X } from 'lucide-react';

type Persona = 'victim' | 'ngo' | 'developer' | null;

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[40px] border border-brand-primary/5 dark:border-white/5 shadow-elegant hover:shadow-active transition-all group h-full">
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-accent dark:bg-white/5 rounded-2xl flex items-center justify-center text-brand-primary mb-5 sm:mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-display font-black text-neutral-dark dark:text-white uppercase mb-3 sm:mb-4 tracking-tight">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed font-medium">{description}</p>
    </div>
  );
}

export default function App() {
  const [persona, setPersona] = useState<Persona>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('nexusAidTheme') === 'dark';
  });
  
  // Dev Login State
  const [devAuth, setDevAuth] = useState({ username: '', password: '', isAuthenticated: false });
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      localStorage.setItem('nexusAidTheme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      localStorage.setItem('nexusAidTheme', 'light');
    }
  }, [isDarkMode]);

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (devAuth.username === 'ADMIN' && devAuth.password === 'ADMIN') {
      setDevAuth(prev => ({ ...prev, isAuthenticated: true }));
      setPersona('developer');
      setShowDevLogin(false);
    } else {
      setLoginError("Unauthorized: Invalid Crisis Core Credentials");
    }
  };

  const selectPersona = (p: Persona) => {
    if (p === 'developer' && !devAuth.isAuthenticated) {
      setShowDevLogin(true);
    } else {
      setPersona(p);
    }
  };

  const handleDevLogout = () => {
    setDevAuth({ username: '', password: '', isAuthenticated: false });
    setPersona(null);
  };

  return (
    <div id="nexus-aid-root" className={`min-h-screen ${isDarkMode ? 'dark' : ''} bg-neutral-light dark:bg-slate-950 text-neutral-dark dark:text-gray-100 font-sans transition-colors duration-500`}>
      <AnimatePresence mode="wait">
        {showDevLogin ? (
          <motion.div
            key="dev-login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="min-h-screen flex items-center justify-center p-6 bg-brand-accent dark:bg-slate-950 transition-colors"
          >
            <div className="max-w-md w-full bg-white dark:bg-slate-900 p-10 rounded-[48px] shadow-elegant border border-gray-100 dark:border-white/5">
              <div className="flex justify-center mb-8">
                <div className="bg-brand-primary p-5 rounded-[24px] shadow-lg shadow-brand-primary/20">
                  <Terminal className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-display font-black text-center mb-2 dark:text-white uppercase tracking-tight italic">Dev Command</h2>
              <p className="text-gray-400 dark:text-gray-500 text-center text-[10px] mb-10 font-black uppercase tracking-[0.3em]">Restricted Access :: Node #01</p>
              
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest mb-8 text-center"
                >
                  {loginError}
                </motion.div>
              )}

              <form onSubmit={handleDevLogin} className="space-y-6 font-mono text-[11px] font-black uppercase tracking-widest">
                <div>
                  <label className="text-gray-400 mb-2 block ml-1">Secure_UID</label>
                  <input 
                    type="text" 
                    value={devAuth.username}
                    onChange={(e) => setDevAuth(p => ({ ...p, username: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white transition-all placeholder:text-gray-300"
                    placeholder="ENTER_ID"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 mb-2 block ml-1">Access_Token</label>
                  <input 
                    type="password" 
                    value={devAuth.password}
                    onChange={(e) => setDevAuth(p => ({ ...p, password: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-brand-primary dark:text-white transition-all placeholder:text-gray-300"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowDevLogin(false)}
                    className="flex-1 text-gray-400 hover:text-neutral-dark dark:hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 bg-brand-primary text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Authenticate
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : !persona ? (
          <motion.div
            key="selector"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen pt-20 bg-neutral-light dark:bg-slate-950 transition-colors selection:bg-brand-primary/20"
          >
            {/* Header / Nav */}
            <nav className="fixed top-0 left-0 right-0 h-20 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl z-50 border-b border-brand-primary/5 px-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20">
                  <HeartPulse className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-black text-lg sm:text-xl tracking-tighter uppercase italic text-brand-primary">NexusAid</span>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="hidden md:flex items-center gap-8 lg:gap-10">
                  <a href="#features" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-brand-primary transition-colors">Features</a>
                  <a href="#architecture" className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-brand-primary transition-colors">Architecture</a>
                  <a href="#portals" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary hover:opacity-70 transition-all border-2 border-brand-primary/20 px-6 py-2 rounded-full">Launch Portal</a>
                </div>
                {/* Mobile Menu Button can go here if added later */}
              </div>
            </nav>

            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-primary/10 blur-[120px] rounded-full opacity-50" />
              <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 blur-[100px] rounded-full opacity-30" />
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(155, 107, 255, 0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              {/* Hero Section */}
              <div className="text-center py-20 md:py-40 overflow-hidden relative">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/5 rounded-full -z-10 blur-3xl"
                />
                <motion.div 
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center gap-3 px-4 sm:px-6 py-2 rounded-full border border-brand-primary/10 bg-brand-primary/5 mb-8 md:mb-10"
                >
                  <div className="w-1.5 h-1.5 sm:w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(155,107,255,1)]" />
                  <span className="font-display font-black text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase text-brand-primary">NexusAid Protocol v2.5 Online</span>
                </motion.div>
                
                <motion.h1 
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="text-4xl sm:text-7xl md:text-9xl font-display font-black tracking-tight text-neutral-dark dark:text-white mb-6 md:mb-8 leading-[1] sm:leading-[0.9] italic uppercase"
                >
                  Reinventing <br /> <motion.span 
                    initial={{ color: '#00000000' }}
                    animate={{ color: '#9b6bff' }}
                    transition={{ duration: 1.5, delay: 0.8 }}
                    className="text-brand-primary"
                  >Emergency</motion.span> <br /> Response
                </motion.h1>

                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="text-gray-500 dark:text-gray-400 max-w-3xl mx-auto text-base sm:text-xl md:text-2xl font-medium leading-relaxed mb-10 sm:mb-12 px-2"
                >
                  The Decentralized Emergency Mesh. AI-powered triage and fleet synchronization designed for the most critical situations on Earth.
                </motion.p>
                
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
                >
                  <a href="#portals" className="w-full sm:w-auto bg-brand-primary text-white px-8 sm:px-12 py-4 sm:py-5 rounded-[20px] sm:rounded-[24px] font-black uppercase tracking-widest text-[11px] sm:text-sm shadow-2xl shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all text-center">
                    Access System
                  </a>
                  <button 
                    onClick={() => {
                      const el = document.getElementById('briefing');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto text-neutral-dark dark:text-white border border-neutral-dark/10 dark:border-white/10 px-8 sm:px-12 py-4 sm:py-5 rounded-[20px] sm:rounded-[24px] font-black uppercase tracking-widest text-[11px] sm:text-sm hover:bg-neutral-dark/5 dark:hover:bg-white/5 transition-all"
                  >
                    Watch Briefing
                  </button>
                </motion.div>
              </div>

              {/* System Briefing Section */}
              <motion.div 
                id="briefing" 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8 }}
                className="py-24 scroll-mt-20"
              >
                <div className="bg-neutral-dark dark:bg-slate-900 rounded-[40px] sm:rounded-[64px] p-8 sm:p-20 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                  </div>
                  <div className="relative z-10 space-y-12 max-w-4xl">
                    <div className="space-y-4 text-center sm:text-left">
                      <motion.h2 
                        initial={{ x: -20, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-primary"
                      >Classified Briefing</motion.h2>
                      <p className="text-3xl sm:text-5xl font-display font-black uppercase italic leading-tight">NexusAid Protocol: <br /> The Second Response</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-20">
                      <div className="space-y-6">
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                          In the first 60 minutes of a crisis, information is as vital as oxygen. Standard systems fail because they are centralized—fragile nodes in a collapsing environment.
                        </p>
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                          NexusAid deploys a <span className="text-white italic">Self-Healing Mesh Protocol</span>. Every smartphone becomes a pulse point, every responder a strategic relay. Our AI-driven triage ensures that resources aren\'t just sent, but precisely targeted.
                        </p>
                      </div>
                      <div className="space-y-8">
                        {[
                          { title: 'NLP Extraction', value: 'Converts unstructured SMS to valid JSON coordinates in real-time, bypassing network congestion.' },
                          { title: 'Edge Persistence', value: 'Data persists across regional edge clusters, allowing local mesh-sync even during total ISP blackouts.' },
                          { title: 'Zero Trust Sync', value: 'Verified NGO identity synchronization ensures that sensitive victim data is only accessible to authenticated responders.' }
                        ].map((item, index) => (
                          <motion.div 
                            key={item.title} 
                            initial={{ x: 20, opacity: 0 }}
                            whileInView={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 + (index * 0.1) }}
                            className="space-y-2 border-l-2 border-brand-primary/30 pl-6"
                          >
                            <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">{item.title}</h4>
                            <p className="text-sm text-gray-400 font-medium">{item.value}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Features Grid */}
              <div id="features" className="py-24 space-y-16">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center space-y-4"
                >
                  <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-primary">Core Capabilities</h2>
                  <p className="text-3xl md:text-5xl font-display font-black dark:text-white uppercase italic">Built for Zero-Failure</p>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} viewport={{ once: true }}>
                    <FeatureItem 
                      icon={<SignalLow className="w-6 h-6" />}
                      title="Mesh Networking"
                      description="Decentralized p2p synchronization that remains active even when standard infrastructure fails."
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} viewport={{ once: true }}>
                    <FeatureItem 
                      icon={<Zap className="w-6 h-6" />}
                      title="AI Triage"
                      description="Proprietary NLP models analyze victim pulses to generate instant criticality prioritization."
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} viewport={{ once: true }}>
                    <FeatureItem 
                      icon={<GitBranch className="w-6 h-6" />}
                      title="Fleet Orchestration"
                      description="Real-time multi-NGO coordination to ensure zero overlap in relief distribution."
                    />
                  </motion.div>
                </div>
              </div>

              {/* Portals Section */}
              <div id="portals" className="py-24 scroll-mt-20 bg-brand-primary/5 dark:bg-white/5 rounded-[48px] md:rounded-[64px] px-6 md:px-12 my-12 md:my-20 border border-brand-primary/10 relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-64 h-64 bg-brand-primary/10 rounded-full -ml-32 -mt-32 blur-3xl pointer-events-none" />
                <div className="relative z-10 text-center mb-16 space-y-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-primary">Access Architecture</h2>
                  <p className="text-3xl md:text-5xl font-display font-black dark:text-white uppercase italic">Select Your Interface</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                  <PersonaCard 
                    title="Victim Portal"
                    description="Broadcast distress pulses via SMS-NLP. Intelligent triage routing to nearest NGO nodes."
                    icon={<Shield className="w-8 h-8" />}
                    color="bg-brand-primary"
                    onClick={() => selectPersona('victim')}
                    delay={0}
                  />
                  <PersonaCard 
                    title="NGO Dashboard"
                    description="Strategic command. Fleet orchestration, real-time demand mapping, and dispatch sync."
                    icon={<HardHat className="w-8 h-8" />}
                    color="bg-brand-secondary"
                    onClick={() => selectPersona('ngo')}
                    delay={0.1}
                  />
                  <PersonaCard 
                    title="Crisis Core"
                    description="Infrastructure telemetry. D3 visualization of mesh health and regional triage performance."
                    icon={<Terminal className="w-8 h-8" />}
                    color="bg-neutral-dark"
                    onClick={() => selectPersona('developer')}
                    delay={0.2}
                  />
                </div>
              </div>

              {/* Architecture Section */}
              <div id="architecture" className="py-24 border-t border-brand-primary/5">
                <div className="bg-white dark:bg-slate-900 rounded-[40px] md:rounded-[64px] p-8 md:p-20 overflow-hidden relative border border-gray-100 dark:border-white/5 shadow-elegant">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                  <div className="relative z-20 grid grid-cols-1 lg:grid-cols-2 lg:items-center gap-16 lg:gap-24">
                    <div className="space-y-10 md:space-y-12 text-center lg:text-left">
                      <div className="bg-brand-primary/10 text-brand-primary px-6 py-2 rounded-full inline-block text-[10px] font-black uppercase tracking-widest">
                        Neural Fabric v2.5
                      </div>
                      <h3 className="text-3xl sm:text-5xl lg:text-5xl xl:text-7xl font-display font-black dark:text-white uppercase leading-[0.95] italic -ml-1">
                        The Infrastructure <br className="hidden xl:block" /> of <span className="text-brand-primary">Empathy</span>
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg xl:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                        NexusAid isn't just a database. It's a living topology that connects disparate NGO nodes into a single, cohesive emergency brain. 
                      </p>
                      <ul className="space-y-4 inline-block text-left">
                        {['End-to-End Latency < 50ms', 'Multi-Regional Edge Distribution', 'Self-Healing Routing Protocols'].map((item) => (
                          <li key={item} className="flex items-center gap-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-dark dark:text-white">
                            <CheckCircle className="w-4 h-4 sm:w-5 h-5 text-brand-primary flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="relative aspect-square bg-slate-50 dark:bg-slate-950 rounded-[32px] sm:rounded-[48px] border border-gray-100 dark:border-white/5 overflow-hidden flex items-center justify-center p-8 sm:p-12 max-w-[380px] w-full justify-self-center lg:justify-self-end lg:translate-y-20">
                       <div className="absolute inset-0 opacity-10">
                         <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #9b6bff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                       </div>
                       <div className="relative w-full h-full flex items-center justify-center">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                            className="w-full h-full border-2 border-brand-primary/10 rounded-full flex items-center justify-center"
                          >
                             <div className="w-3/4 h-3/4 border-2 border-brand-primary/20 rounded-full flex items-center justify-center">
                                <div className="w-1/2 h-1/2 border-2 border-brand-primary/30 rounded-full" />
                             </div>
                          </motion.div>
                          <Terminal className="w-8 h-8 sm:w-16 h-16 text-brand-primary absolute" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="bg-white dark:bg-slate-900 border-t border-brand-primary/5 py-20 mt-24">
              <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
                  <div className="col-span-2 space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20">
                        <HeartPulse className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-display font-black text-xl tracking-tighter uppercase italic text-brand-primary">NexusAid</span>
                    </div>
                    <p className="text-gray-400 dark:text-gray-500 max-w-sm leading-relaxed font-medium">
                      Saving lives through decentralized intelligence. Join the global mesh network of responders today.
                    </p>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-dark dark:text-white">Platform</h4>
                    <ul className="space-y-4 text-sm font-medium text-gray-500 hover:text-brand-primary transition-colors cursor-pointer">
                      <li>Network Topology</li>
                      <li>AI Dispatch</li>
                      <li>Mesh Protocol</li>
                    </ul>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-dark dark:text-white">Global Nodes</h4>
                    <ul className="space-y-4 text-sm font-medium text-gray-500 hover:text-brand-primary transition-colors cursor-pointer">
                      <li>Status</li>
                      <li>Deployment Guide</li>
                      <li>Security Fabric</li>
                    </ul>
                  </div>
                </div>
                <div className="pt-10 border-t border-gray-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">© 2026 NEXUSAID GLOBAL CORE :: ALL CHANNELS SECURED</p>
                  <div className="flex gap-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <span>Privacy</span>
                    <span>TOS</span>
                    <span>Transparency</span>
                  </div>
                </div>
              </div>
            </footer>
          </motion.div>
        ) : (
          <motion.div
            key={persona}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative"
          >
            {persona === 'victim' && <VictimView onLogout={handleDevLogout} />}
            {persona === 'ngo' && <NgoView onLogout={handleDevLogout} />}
            {persona === 'developer' && <DeveloperView onLogout={handleDevLogout} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Controls */}
      <div className="fixed bottom-6 right-6 z-50 flex gap-4">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 rounded-full shadow-2xl border border-gray-200 dark:border-white/10 hover:scale-110 transition-transform group"
          title="Toggle Dark Mode"
        >
          {isDarkMode ? (
            <Sun className="w-6 h-6 text-amber-400 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-6 h-6 text-indigo-400 group-hover:-rotate-12 transition-transform" />
          )}
        </button>
      </div>
    </div>
  );
}

function PersonaCard({ title, description, icon, color, onClick, delay }: any) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -10 }}
      onClick={onClick}
      className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] text-left shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-none border border-gray-100 dark:border-white/5 hover:border-brand-primary/40 hover:shadow-[0_20px_50px_-20px_rgba(138,79,255,0.15)] transition-all flex flex-col h-full group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
      
      <div className={`${color} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white mb-6 sm:mb-8 shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl sm:text-2xl font-display font-black mb-3 text-neutral-dark dark:text-white tracking-tight uppercase italic">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed mb-8 sm:mb-10 flex-1 font-medium">{description}</p>
      
      <div className="flex items-center gap-2 text-[10px] font-black font-display uppercase tracking-[0.2em] text-brand-primary group-hover:gap-4 transition-all">
        Launch System 
        <span>→</span>
      </div>
    </motion.button>
  );
}

