import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HealthRecord, Animal, ChickenLot } from '../types';
import { HeartPulse, Plus, Calendar, Search, Filter, Activity, Clock, CheckCircle2, AlertCircle, Save, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveOffline } from '../lib/offlineService';
import { useAuth } from '../contexts/AuthContext';

const Health = () => {
  const { profile } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [lots, setLots] = useState<ChickenLot[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [view, setView] = useState<'list' | 'add'>('list');

  const permissions = profile?.permissions || {
    canCreate: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canEdit: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canDelete: profile?.role === 'Admin'
  };

  useEffect(() => {
    const q = query(collection(db, 'health_records'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HealthRecord)));
    });

    const unsubscribeAnimals = onSnapshot(query(collection(db, 'animals'), where('status', '==', 'active')), (snapshot) => {
      setAnimals(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Animal)));
    });

    const unsubscribeLots = onSnapshot(query(collection(db, 'chicken_lots'), where('status', '==', 'active')), (snapshot) => {
      setLots(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChickenLot)));
    });

    return () => {
      unsubscribe();
      unsubscribeAnimals();
      unsubscribeLots();
    };
  }, []);

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    const formData = new FormData(e.currentTarget);
    const targetType = formData.get('target_type') as 'animal' | 'lot';
    
    const newRecord: Partial<HealthRecord> = {
      date: formData.get('date') as string,
      service: formData.get('service') as string,
      provider: formData.get('provider') as string,
      status: 'pending',
      notes: formData.get('notes') as string,
      created_by: profile?.uid,
      animal_id: targetType === 'animal' ? formData.get('target_id') as string : undefined,
      lot_id: targetType === 'lot' ? formData.get('target_id') as string : undefined,
    };

    await saveOffline('health_records', newRecord);
    setView('list');
  };

  const upcoming = records.filter(r => r.status === 'pending');
  const history = records.filter(r => r.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-600/20">
            <HeartPulse size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Veterinária e Climatologia</h1>
            <p className="text-gray-400 text-sm font-medium">Controlo Sanitário e Protocolos de Bio-Segurança</p>
          </div>
        </div>
        
        {permissions.canCreate && (
          <button 
            onClick={() => setView('add')}
            className="flex items-center gap-3 bg-red-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-red-600/30 hover:bg-red-500 transition-all active:scale-95"
          >
            <Plus size={18} />
            Agendar Intervenção
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-dark-surface p-1.5 rounded-2xl border border-white/5 flex shadow-2xl">
                <button 
                  onClick={() => setActiveTab('upcoming')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all ${activeTab === 'upcoming' ? 'bg-red-600 text-white shadow-xl px-10' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  <Calendar size={16} /> Próximas Ações
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all ${activeTab === 'history' ? 'bg-red-600 text-white shadow-xl px-10' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  <Clock size={16} /> Histórico Clínico
                </button>
              </div>

              <div className="space-y-4">
                {(activeTab === 'upcoming' ? upcoming : history).map(event => (
                  <motion.div 
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-dark-surface p-6 rounded-[2rem] border border-white/5 hover:border-red-500/30 transition-all group cursor-pointer shadow-xl relative overflow-hidden"
                  >
                    <div className="flex items-center gap-6 relative">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${event.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {event.status === 'completed' ? <CheckCircle2 size={24} /> : <Activity size={24} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-display font-bold text-white text-lg tracking-tight">{event.service}</h3>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{event.date}</p>
                             <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${event.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>{event.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
                          <span className="text-red-500/80">Alvo: <span className="text-gray-200">{event.animal_id || event.lot_id || 'Global'}</span></span>
                          <span className="text-gray-400">Especialista: <span className="text-gray-200">{event.provider}</span></span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {(activeTab === 'upcoming' ? upcoming : history).length === 0 && (
                   <div className="py-20 text-center bg-dark-bg/30 rounded-[3rem] border border-dashed border-white/5">
                      <Clock size={48} className="mx-auto text-gray-800 mb-4" />
                      <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sem registos para esta categoria</p>
                   </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                   <AlertCircle size={16} className="text-amber-500 animate-pulse" />
                   Vigilância Regional (FAO)
                 </h3>
                 <div className="space-y-6">
                   <div className="p-5 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                     <p className="text-xs font-bold text-amber-500 mb-2 font-display uppercase tracking-tight">ALERTA BIOSSEGURANÇA</p>
                     <p className="text-[10px] text-gray-400 leading-relaxed font-bold uppercase tracking-widest">Reforçar pedilúvios e controlo de acesso de veículos externos.</p>
                   </div>
                 </div>
              </div>

              <div className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl shadow-black/20">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Snapshot Sanitário</h3>
                 <div className="space-y-6">
                   <div>
                     <div className="flex justify-between items-end mb-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taxa de Morbilidade</span>
                       <span className="text-2xl font-display font-bold text-white">0.8%</span>
                     </div>
                     <div className="w-full h-1.5 bg-dark-bg rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[15%]" />
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between items-end mb-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adesão Plano Vacinal</span>
                       <span className="text-2xl font-display font-bold text-white">94%</span>
                     </div>
                     <div className="w-full h-1.5 bg-dark-bg rounded-full overflow-hidden">
                       <div className="h-full bg-primary-600 w-[94%]" />
                     </div>
                   </div>
                 </div>
                 <button className="w-full mt-10 py-5 bg-white/5 border border-white/5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-white transition-all">Exportar Boletim Sanitário</button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-3xl mx-auto bg-dark-surface p-12 rounded-[3.5rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
              <ArrowLeft size={16} /> Voltar para Dashboard
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-10 uppercase tracking-tight">Agendar Ação Sanitária</h2>
            <form onSubmit={handleAddRecord} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Serviço / Intervenção</label>
                   <input required name="service" type="text" placeholder="ex: Vacinação contra Newcastle" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold text-lg focus:ring-4 focus:ring-red-500/10 transition-all font-display" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Data Planeada</label>
                   <input required name="date" type="date" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold focus:ring-4 focus:ring-red-500/10 transition-all" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Veterinário / Equipa</label>
                   <input required name="provider" type="text" placeholder="ex: Dr. Carlos Silva" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold focus:ring-4 focus:ring-red-500/10 transition-all" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Tipo de Alvo</label>
                   <select name="target_type" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-black text-[11px] uppercase tracking-widest transition-all">
                     <option value="lot">Plantel (Lote)</option>
                     <option value="animal">Ruminante (Indivi)</option>
                     <option value="all">Global</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">ID do Alvo</label>
                   <select name="target_id" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold focus:ring-4 focus:ring-red-500/10 transition-all">
                     {lots.map(l => <option key={`lot-${l.id}`} value={l.id}>{l.lot_name}</option>)}
                     {animals.map(a => <option key={`animal-${a.id}`} value={a.id}>{a.tag_number}</option>)}
                   </select>
                </div>
                <div className="col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Observações Clínicas</label>
                   <textarea name="notes" rows={3} placeholder="Instruções pós-operatórias, medicamentos a administrar..." className="w-full px-8 py-5 bg-dark-bg border border-white/5 rounded-[2rem] text-white text-sm focus:ring-4 focus:ring-red-500/10 transition-all"></textarea>
                </div>
              </div>
              <button type="submit" className="w-full h-20 bg-red-600 text-white rounded-[2.25rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-red-600/30 hover:bg-red-500 transition-all mt-10 active:scale-[0.98] flex items-center justify-center gap-4">
                <Save size={20} />
                Registar Agendamento
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Health;
