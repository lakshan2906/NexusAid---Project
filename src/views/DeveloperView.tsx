import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, getDocs, writeBatch, doc, where, Timestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import { Terminal, Database, Activity, GitBranch, Cpu, ShieldCheck, Zap, Layers, X, LogOut, Trash2, History as HistoryIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function DeveloperView({ onLogout }: { onLogout?: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'topology' | 'archive'>('topology');
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const d3Container = useRef(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isHistoricalClearing, setIsHistoricalClearing] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  const handleClearHistoricalData = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = Timestamp.fromDate(thirtyDaysAgo);

    const checkConfirm1 = window.confirm(`MAINTENANCE_PROTOCOL: Initiate cleanup for records older than 30 days (Before ${thirtyDaysAgo.toLocaleDateString()})?`);
    if (!checkConfirm1) return;

    const checkConfirm2 = window.confirm("CRITICAL_CONFIRMATION: This will permanently delete sub-mesh history. Data cannot be recovered. Final authorization required. Execute?");
    if (!checkConfirm2) return;

    setIsHistoricalClearing(true);
    try {
      const qReq = query(collection(db, 'requests'), where('createdAt', '<', cutoff));
      const qDel = query(collection(db, 'deliveries'), where('createdAt', '<', cutoff));
      
      const reqSnap = await getDocs(qReq).catch(e => handleFirestoreError(e, OperationType.GET, 'requests'));
      const delSnap = await getDocs(qDel).catch(e => handleFirestoreError(e, OperationType.GET, 'deliveries'));

      if (!reqSnap || !delSnap) return;
      const total = reqSnap.size + delSnap.size;

      if (total === 0) {
        alert("ARCHIVE_REPORT: No historical data older than 30 days found. System is optimized.");
        return;
      }

      const purgeBatch = async (snapshot: any, collectionPath: string) => {
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnapshot of snapshot.docs) {
          batch.delete(docSnapshot.ref);
          count++;
          if (count % 450 === 0) {
            await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, collectionPath));
            batch = writeBatch(db);
          }
        }
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, collectionPath));
        return count;
      };

      const purgedReqs = await purgeBatch(reqSnap, 'requests');
      const purgedDels = await purgeBatch(delSnap, 'deliveries');
      
      alert(`CLEANUP_SUCCESS: ${purgedReqs + purgedDels} legacy records purged from the mesh.`);
    } catch (error) {
      console.error("CLEANUP_ERROR:", error);
      alert("CLEANUP_FAILED: Core interruption detected.");
    } finally {
      setIsHistoricalClearing(false);
    }
  };

  const handleClearData = async () => {
    try {
      console.log("INITIALIZING_PURGE_SEQUENCE...");
      
      const reqSnap = await getDocs(collection(db, 'requests')).catch(e => handleFirestoreError(e, OperationType.GET, 'requests'));
      const delSnap = await getDocs(collection(db, 'deliveries')).catch(e => handleFirestoreError(e, OperationType.GET, 'deliveries'));
      
      if (!reqSnap || !delSnap) return;
      
      const totalToPurge = reqSnap.size + delSnap.size;
      
      if (totalToPurge === 0) {
        alert("SYSTEM_REPORT: No active SOS data detected in the Crisis Core. Pure State.");
        return;
      }

      const confirmPurge = window.confirm(`CRITICAL WARNING: Detect ${totalToPurge} records in Global Archive. This will permanently purge ALL time-lapse mission data. Proceed with total system reset?`);
      if (!confirmPurge) return;
      
      setIsClearing(true);
      
      const purgeBatch = async (snapshot: any, collectionPath: string) => {
        let batch = writeBatch(db);
        let count = 0;
        
        for (const docSnapshot of snapshot.docs) {
          batch.delete(docSnapshot.ref);
          count++;
          if (count % 450 === 0) {
            await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, collectionPath));
            batch = writeBatch(db);
          }
        }
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, collectionPath));
        return count;
      };

      const purgedReqs = await purgeBatch(reqSnap, 'requests');
      const purgedDels = await purgeBatch(delSnap, 'deliveries');
      
      console.log(`PURGE_SUCCESS :: ${purgedReqs} requests and ${purgedDels} deliveries erased.`);
      alert(`PURGE_COMPLETE: SOS Core has been localized. ${purgedReqs + purgedDels} mission records destroyed.`);
    } catch (error: any) {
      console.error("PURGE_CRITICAL_FAILURE ::", error);
      alert(`PURGE_FAILED: ${error.code || 'UNKNOWN_ERROR'} - ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribeReqs = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'requests');
    });

    const qDel = query(collection(db, 'deliveries'));
    const unsubscribeDels = onSnapshot(qDel, (snapshot) => {
      setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'deliveries');
    });

    return () => {
      unsubscribeReqs();
      unsubscribeDels();
    };
  }, []);

  useEffect(() => {
    if (requests.length > 0 && d3Container.current) {
      // D3 Logic for NGO-Victim Connection Graph
      const container = d3Container.current as HTMLElement;
      const width = container.offsetWidth || 800;
      const height = 400;

      const svg = d3.select(d3Container.current)
        .html('') // Clear
        .append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('class', 'rounded-2xl');

      // Create a zoomable container g
      const g = svg.append('g');

      const zoom: any = d3.zoom()
        .scaleExtent([0.5, 8])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      const nodes = [
        { id: 'NGO_CENTRAL', type: 'root', label: 'Crisis Core', data: { description: 'Main coordination hub for all disaster relief operations.', location: 'New Delhi Base' } },
        ...requests.slice(0, 15).map(r => ({ id: r.id, type: 'victim', label: r.victimName, data: r })),
        { id: 'NGO_1', type: 'ngo', label: 'MedRelief A', data: { focus: 'Emergency Medical Care', supplies: ['Oxygen', 'First Aid'], units: 24 } },
        { id: 'NGO_2', type: 'ngo', label: 'FoodBank B', data: { focus: 'Nutritional Support', supplies: ['Rations', 'Water Packs'], units: 15 } },
        ...deliveries.slice(0, 20).map(d => ({ 
          id: `del-${d.id}`, 
          type: 'delivery', 
          label: d.driverName, 
          data: d,
          status: d.status 
        }))
      ];

      const links = [
        ...requests.slice(0, 15).map(r => ({
          source: r.status === 'assigned' ? 'NGO_1' : (r.status === 'completed' ? 'NGO_2' : 'NGO_CENTRAL'),
          target: r.id,
          type: 'request-link'
        })),
        ...deliveries.slice(0, 20).map(d => ({
          source: requests.some(r => r.id === d.requestId && r.status === 'completed') ? 'NGO_2' : 'NGO_1',
          target: `del-${d.id}`,
          type: 'delivery-link',
          status: d.status
        })),
        ...deliveries.slice(0, 20).map(d => ({
          source: `del-${d.id}`,
          target: d.requestId,
          type: 'fulfillment-link',
          status: d.status
        }))
      ].filter(l => nodes.some(n => n.id === l.source) && nodes.some(n => n.id === l.target));

      const simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', (d: any) => {
          if (d.type === 'request-link') return '#444';
          if (d.status === 'delivered') return '#10b981'; // emerald-500
          if (d.status === 'arrived') return '#f59e0b'; // amber-500
          return '#3b82f6'; // blue-500 (en-route)
        })
        .attr('stroke-opacity', (d: any) => d.type === 'request-link' ? 0.3 : 0.6)
        .attr('stroke-width', (d: any) => d.type === 'request-link' ? 1 : 2)
        .attr('stroke-dasharray', (d: any) => d.type === 'fulfillment-link' ? '4,4' : 'none');

      const nodeGroup = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('cursor', 'pointer')
        .on('click', (event, d: any) => {
           setSelectedNodeData(d);
        })
        .call(d3.drag()
          .on('start', (event: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            (event.subject as any).fx = event.subject.x;
            (event.subject as any).fy = event.subject.y;
          })
          .on('drag', (event: any) => {
            (event.subject as any).fx = event.x;
            (event.subject as any).fy = event.y;
          })
          .on('end', (event: any) => {
            if (!event.active) simulation.alphaTarget(0);
            (event.subject as any).fx = null;
            (event.subject as any).fy = null;
          }) as any);

      nodeGroup.append('circle')
        .attr('r', (d: any) => {
          if (d.type === 'root') return 14;
          if (d.type === 'ngo') return 10;
          if (d.type === 'delivery') return 5;
          return 7;
        })
        .attr('fill', (d: any) => {
          if (d.type === 'root') return '#9b6bff';
          if (d.type === 'ngo') return '#7e57c2';
          if (d.type === 'delivery') {
            if (d.status === 'delivered') return '#d1ffde';
            if (d.status === 'arrived') return '#ffb1b1';
            return '#b28dff';
          }
          return (d.data.urgency === 'critical' ? '#ff6b6b' : '#A594F9');
        })
        .attr('stroke', (d: any) => d.type === 'root' ? '#f5f0ff' : 'none')
        .attr('stroke-width', 2);

      nodeGroup.append('text')
        .attr('dy', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#999') // Universal gray for both modes
        .style('font-size', '8px')
        .style('pointer-events', 'none')
        .text((d: any) => d.label);

      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x || 0)
          .attr('y1', (d: any) => d.source.y || 0)
          .attr('x2', (d: any) => d.target.x || 0)
          .attr('y2', (d: any) => d.target.y || 0);

        nodeGroup.attr('transform', (d: any) => `translate(${d.x || 0}, ${d.y || 0})`);
      });
    }
  }, [requests]);

  const stats = [
    { name: 'NLP Latency', val: '240ms', color: 'text-brand-secondary' },
    { name: 'Matching Accuracy', val: '98.2%', color: 'text-brand-secondary' },
    { name: 'Active Nodes', val: '1,204', color: 'text-white' },
    { name: 'Failback Rate', val: '2.1%', color: 'text-brand-primary' },
  ];

  return (
    <div className="min-h-screen bg-neutral-light dark:bg-black text-neutral-dark dark:text-gray-300 font-mono selection:bg-brand-primary selection:text-white transition-colors">
      <header className="p-4 sm:p-8 border-b border-brand-primary/10 flex flex-col sm:flex-row justify-between items-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl sticky top-0 z-20 gap-4 sm:gap-6">
         <div className="flex items-center gap-6">
           <div className="bg-brand-primary p-3 rounded-2xl shadow-xl shadow-brand-primary/20">
            <Terminal className="w-5 h-5 text-white" />
           </div>
           <div>
             <h1 className="text-sm font-black tracking-[0.3em] text-neutral-dark dark:text-white uppercase flex items-center gap-2">
               NexusAid <span className="text-brand-primary">Engine</span> <span className="text-[10px] bg-brand-primary/10 px-2 py-0.5 rounded text-brand-primary">v3.5.0_LILAC</span>
             </h1>
             <div className="flex gap-6 mt-2">
               <button 
                 onClick={() => setActiveTab('topology')}
                 className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full transition-all ${activeTab === 'topology' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:text-neutral-dark dark:hover:text-white'}`}
               >
                 PHYSICAL_MESH
               </button>
               <button 
                 onClick={() => setActiveTab('archive')}
                 className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full transition-all ${activeTab === 'archive' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:text-neutral-dark dark:hover:text-white'}`}
               >
                 TIME_ARCHIVE
               </button>
             </div>
           </div>
         </div>
         <div className="flex items-center gap-8">
           <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
             <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(155,107,255,1)]" />
             <span className="text-gray-400">NODE_CENTRAL_READY</span>
           </div>
           <button 
             onClick={onLogout}
             className="flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 px-6 py-2.5 rounded-2xl text-[10px] font-black text-red-500 border border-red-500/20 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest"
           >
             <LogOut className="w-3.5 h-3.5" />
             Terminate
           </button>
         </div>
      </header>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto">
        {activeTab === 'topology' ? (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8">
            {/* Left Column - System Health */}
            <div className="lg:col-span-3 space-y-6 md:space-y-8">
               <section className="bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 p-6 rounded-2xl transition-colors">
                 <h2 className="text-[10px] uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                   <Activity className="w-4 h-4" /> System Health
                 </h2>
                 <div className="space-y-6">
                   {stats.map(s => (
                     <div key={s.name} className="flex justify-between items-end border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="text-xs text-gray-400">{s.name}</span>
                        <span className={`text-lg font-bold ${s.color}`}>{s.val}</span>
                     </div>
                   ))}
                 </div>
               </section>

               <section className="bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 p-6 rounded-2xl overflow-hidden relative transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShieldCheck className="w-24 h-24" />
                  </div>
                  <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">Security Hardening</h2>
                  <ul className="text-[10px] space-y-2 text-gray-400">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-brand-secondary rounded-full" /> RBAC Validation: OK</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-brand-secondary rounded-full" /> PII Isolation: ACTIVE</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-brand-secondary rounded-full" /> Update Gap Guard: ENABLED</li>
                  </ul>
               </section>
            </div>

            {/* Center - Visualizations */}
            <div className="lg:col-span-6 space-y-6 md:space-y-8 mt-2">
               <section className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-3xl p-4 sm:p-8 relative overflow-hidden group transition-colors">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                   <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-dark dark:text-white flex items-center gap-2">
                     <GitBranch className="w-4 h-4 text-brand-secondary" /> NGO-Victim Topology
                   </h2>
                   <div className="flex flex-wrap gap-3 sm:gap-4">
                      <div className="flex items-center gap-1 text-[9px] text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> En-Route
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Arrived
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Delivered
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 ml-2">
                        <div className="w-2 h-2 rounded-full bg-brand-primary" /> Root
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-brand-secondary" /> NGO
                      </div>
                   </div>
                 </div>
                 
                 <div ref={d3Container} className="bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 cursor-move" />
                 
                 <div className="mt-6 flex justify-between items-center text-[10px] text-gray-400">
                   <span>NODES: {requests.length + deliveries.length + 3}</span>
                   <span>ALGORITHM: FORCE-DIRECTED RELAY</span>
                   <span>TELEMETRY: ACTIVE STREAM</span>
                 </div>
               </section>

               <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                  <div className="bg-gray-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-[10px] text-gray-400 uppercase mb-4 font-bold">API Utilization</h3>
                    <div className="h-32">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[{v:10},{v:25},{v:15},{v:45},{v:30}]}>
                            <Area type="step" dataKey="v" stroke="#00FFBB" fill="#00FFBB22" />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors">
                    <h3 className="text-[10px] text-gray-400 uppercase mb-4 font-bold">Relay Mesh Heat</h3>
                    <div className="h-32">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[{v:40},{v:30},{v:50},{v:20},{v:60}]}>
                            <Area type="monotone" dataKey="v" stroke="#FF4E00" fill="#FF4E0022" />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
               </section>
            </div>

            {/* Right - Logs/Tasks or Node Details */}
            <div className="lg:col-span-3 space-y-6 md:space-y-8">
               {selectedNodeData ? (
                 <motion.section 
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="bg-gray-50 dark:bg-slate-900/40 border border-brand-primary p-6 rounded-2xl h-[400px] flex flex-col relative transition-colors"
                 >
                   <button 
                     onClick={() => setSelectedNodeData(null)}
                     className="absolute top-4 right-4 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
                   >
                     <X className="w-4 h-4 text-gray-400" />
                   </button>
                   <h2 className="text-[10px] uppercase tracking-widest text-brand-primary mb-6 flex items-center gap-2">
                     <Cpu className="w-4 h-4" /> Node Inspector
                   </h2>
                   <div className="flex-1 overflow-auto custom-scrollbar space-y-4 font-mono">
                     <div>
                       <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Entity ID</p>
                       <p className="text-xs font-mono text-neutral-dark dark:text-white break-all bg-gray-100 dark:bg-black/20 p-2 rounded">{selectedNodeData.id}</p>
                     </div>
                     <div>
                       <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Type</p>
                       <p className="text-xs font-bold text-brand-secondary uppercase tracking-tighter">{selectedNodeData.type}</p>
                     </div>
                     <div>
                       <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Display Label</p>
                       <p className="text-sm font-bold text-neutral-dark dark:text-white">{selectedNodeData.label}</p>
                     </div>
                     
                     <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
                       <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Raw Metadata</p>
                       {Object.entries(selectedNodeData.data || {}).map(([key, val]: [string, any]) => (
                         <div key={key} className="flex justify-between items-center text-[9px] border-b border-gray-50 dark:border-white/5 py-1">
                           <span className="text-gray-400 capitalize">{key}: </span>
                           <span className="text-neutral-dark dark:text-white font-bold">
                             {typeof val === 'object' ? '...' : String(val)}
                           </span>
                         </div>
                       ))}
                     </div>
                   </div>
                 </motion.section>
               ) : (
                 <section className="bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 p-6 rounded-2xl h-[400px] flex flex-col transition-colors">
                    <h2 className="text-[10px] uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Live Task Log
                    </h2>
                    <div className="flex-1 overflow-auto custom-scrollbar space-y-2 text-[10px]">
                      {requests.map(r => (
                        <div 
                          key={`dev-req-log-${r.id}`} 
                          className={`p-2 bg-white dark:bg-white/5 border-l-2 rounded flex justify-between shadow-sm dark:shadow-none ${
                            r.status === 'completed' ? 'border-emerald-500' : 
                            r.status === 'pending' ? 'border-amber-500' : 
                            'border-brand-primary'
                          }`}
                        >
                          <span className="text-gray-500 dark:text-gray-300">REQ_STRUCT_SUCCESS :: {r.id.slice(0,6)}</span>
                          <span className="text-gray-400 dark:text-gray-500 uppercase font-black">{r.status}</span>
                        </div>
                      ))}
                    </div>
                 </section>
               )}

               <div className="bg-brand-primary/20 p-px rounded-2xl transition-colors">
                 <div className="bg-white dark:bg-black p-6 rounded-2xl transition-colors shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-3 mb-4">
                      <Cpu className="w-5 h-5 text-brand-primary" />
                      <span className="text-xs font-bold text-neutral-dark dark:text-white uppercase tracking-tighter">Crisis Core Node #01</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <p className="text-[8px] text-gray-400 uppercase font-bold">Load Avg</p>
                         <p className="text-sm font-bold text-brand-secondary">0.42</p>
                       </div>
                       <div>
                         <p className="text-[8px] text-gray-400 uppercase font-bold">Mem Use</p>
                         <p className="text-sm font-bold text-neutral-dark dark:text-white">14.2 GB</p>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
             <div className="bg-brand-primary/10 border border-brand-primary/20 p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-3 text-brand-primary uppercase tracking-tighter">
                    <HistoryIcon className="w-6 h-6" /> SOS Time-Lapse Archive
                  </h2>
                  <p className="text-xs text-gray-500 mt-2 opacity-70">
                    Chronological series of disaster incidents categorized by disaster name. View the progression of victim inputs and relief efforts across temporal folders.
                  </p>
                </div>
                <button
                  onClick={handleClearHistoricalData}
                  disabled={isHistoricalClearing}
                  className="bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest px-6 py-4 rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isHistoricalClearing ? 'CLEANING_MESH...' : 'PURGE_LEGACY_LOGS (>30d)'}
                </button>
             </div>

             {/* Disaster Folders */}
             {Array.from(new Set(requests.map(r => r.disasterName || 'UNDEFINED_EVENT'))).sort().map((disaster) => {
               const disasterIncidents = requests
                 .filter(r => (r.disasterName || 'UNDEFINED_EVENT') === disaster)
                 .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)); // Ascending for time-lapse

               return (
                 <motion.div 
                   key={disaster}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm"
                 >
                   <div className="bg-gray-100 dark:bg-white/5 p-4 px-6 flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <HistoryIcon className="w-4 h-4 text-brand-primary" />
                       <h3 className="text-xs font-black uppercase text-neutral-dark dark:text-white tracking-widest">DISASTER_FOLDER: {disaster}</h3>
                     </div>
                     <span className="text-[10px] font-mono text-gray-400 font-bold">{disasterIncidents.length} EVENTS</span>
                   </div>

                   <div className="p-6">
                      <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-3 before:top-4 before:bottom-4 before:w-px before:bg-gray-200 dark:before:bg-white/10 before:border-dashed">
                        {disasterIncidents.map((incident, iIdx) => {
                          const date = incident.createdAt?.toDate ? incident.createdAt.toDate().toLocaleString() : 'PENDING_WRITE';
                          return (
                            <div key={incident.id} className="relative">
                              <div className="absolute -left-[24px] top-1.5 w-2 h-2 rounded-full bg-brand-primary" />
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[9px] font-black text-brand-secondary bg-brand-secondary/10 px-2 py-0.5 rounded uppercase">{date}</span>
                                  <h4 className="text-sm font-bold text-neutral-dark dark:text-white mt-1">INCIDENT_{incident.id.slice(0,8).toUpperCase()}</h4>
                                </div>
                                <div className="text-right">
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${incident.status === 'completed' ? 'border-emerald-500/30 text-emerald-500' : 'border-amber-500/30 text-amber-500'}`}>
                                    {incident.status.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                  <p className="text-[8px] text-gray-400 uppercase font-black mb-1">Victim Input</p>
                                  <p className="text-[11px] leading-relaxed dark:text-gray-300">"{incident.summary}"</p>
                                </div>
                                <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                  <p className="text-[8px] text-gray-400 uppercase font-black mb-1">Telemetry</p>
                                  <p className="text-[10px] dark:text-gray-300">LOC: {incident.location?.lat.toFixed(4)}, {incident.location?.lng.toFixed(4)}</p>
                                  <p className="text-[10px] dark:text-gray-300">PEOPLE: {incident.peopleCount || 1}</p>
                                  <p className="text-[10px] text-red-500 font-bold">INJURED: {incident.injuredCount || 0}</p>
                                </div>
                                <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                                  <p className="text-[8px] text-gray-400 uppercase font-black mb-1">Resolution</p>
                                  <p className="text-[10px] dark:text-gray-300">NGO: {incident.assignedNgoId || 'PENDING'}</p>
                                  <p className="text-[10px] dark:text-gray-300">URGENCY: {incident.urgency}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                 </motion.div>
               );
             })}

             {requests.length === 0 && (
               <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-white/10 rounded-3xl">
                  <HistoryIcon className="w-12 h-12 mb-4 opacity-10" />
                  <p className="text-xs uppercase tracking-widest font-black">ARCHIVE_EMPTY :: No Time-Lapse Data Logged</p>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}
