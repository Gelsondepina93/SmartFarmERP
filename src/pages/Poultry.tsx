import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit, getDocs, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChickenLot, EggProduction, WeightRecord, Silo, HealthRecord, Location as FarmLocation, Feed, FeedConsumption } from '../types';
import { Bird, Plus, List, BarChart3, Pill, ArrowLeft, Save, Trash2, Calendar, Target, Users, HeartPulse, ShieldCheck, AlertTriangle, Weight, RefreshCw, Database, ChevronRight, CheckCircle2, DollarSign, Settings2, X, History } from 'lucide-react';
import { saveOffline } from '../lib/offlineService';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { calculateEggMetrics, validateProduction, calculateBroilerMetrics, calculateAgeDays, calculateCumulativePerformance } from '../lib/erpLogic';

const Poultry = () => {
  const { profile } = useAuth();
  const [view, setView] = useState<'list' | 'add_lot' | 'edit_lot' | 'production' | 'history' | 'lot_dashboard'>('list');
  const [lots, setLots] = useState<ChickenLot[]>([]);
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [silos, setSilos] = useState<Silo[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [eggInventory, setEggInventory] = useState<number>(0);
  const [selectedLot, setSelectedLot] = useState<ChickenLot | null>(null);
  const [eggHistory, setEggHistory] = useState<EggProduction[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightRecord[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [feedConsumptions, setFeedConsumptions] = useState<FeedConsumption[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isAddingHealth, setIsAddingHealth] = useState(false);
  const [showClosingSummary, setShowClosingSummary] = useState<ChickenLot | null>(null);
  const [cumulativeMetrics, setCumulativeMetrics] = useState<{ fcr: number; total_gain: number; survivability: number; total_eggs?: number } | null>(null);
  const [selectedSiloIds, setSelectedSiloIds] = useState<string[]>([]);
  const [isQuickAddingSilo, setIsQuickAddingSilo] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'chicken_lots'), orderBy('entry_date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChickenLot));
      setLots(docs);
    });

    const unsubscribeLocs = onSnapshot(query(collection(db, 'locations'), where('type', '==', 'aviary')), (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FarmLocation)));
    });

    const unsubscribeSilos = onSnapshot(collection(db, 'silos'), (snapshot) => {
      setSilos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Silo)));
    });

    const unsubscribeFeeds = onSnapshot(collection(db, 'feeds'), (snapshot) => {
      setFeeds(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Feed)));
    });

    const unsubscribeEggInv = onSnapshot(doc(db, 'egg_inventory', 'central_stock'), (snapshot) => {
      if (snapshot.exists()) {
        setEggInventory(snapshot.data().total_stock || 0);
      } else if (profile?.role === 'Admin') {
        saveOffline('egg_inventory', {
          total_stock: 0,
          last_updated: new Date().toISOString()
        }, 'central_stock');
      }
    });

    return () => {
      unsubscribe();
      unsubscribeLocs();
      unsubscribeSilos();
      unsubscribeFeeds();
      unsubscribeEggInv();
    };
  }, []);

  const permissions = profile?.permissions || {
    canCreate: ['Admin', 'Farm Manager', 'Operator'].includes(profile?.role || ''),
    canEdit: ['Admin', 'Farm Manager', 'Operator'].includes(profile?.role || ''),
    canDelete: profile?.role === 'Admin'
  };

  const handleAddLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    const formData = new FormData(e.currentTarget);
    const newLot: Partial<ChickenLot> = {
      lot_name: formData.get('lot_name') as string,
      type: formData.get('type') as 'layer' | 'broiler',
      breed: formData.get('breed') as string,
      initial_quantity: Number(formData.get('quantity')),
      current_quantity: Number(formData.get('quantity')),
      entry_date: new Date().toISOString(),
      location_id: formData.get('location_id') as string,
      status: 'active',
      age_days: 0,
      cumulative_mortality: 0,
      silo_ids: selectedSiloIds
    };
    
    await saveOffline('chicken_lots', newLot);
    setView('list');
    setSelectedSiloIds([]);
  };

  const handleEditLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLot || !permissions.canEdit) return;
    const formData = new FormData(e.currentTarget);
    const updatedLot: Partial<ChickenLot> = {
      ...selectedLot,
      lot_name: formData.get('lot_name') as string,
      type: formData.get('type') as 'layer' | 'broiler',
      breed: formData.get('breed') as string,
      location_id: formData.get('location_id') as string,
      silo_ids: selectedSiloIds
    };
    
    await saveOffline('chicken_lots', updatedLot, selectedLot.id);
    setView('list');
    setSelectedLot(null);
    setSelectedSiloIds([]);
  };

  const handleQuickAddSilo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSilo: Partial<Silo> = {
      name: formData.get('name') as string,
      location_id: formData.get('location_id') as string,
      capacity_kg: Number(formData.get('capacity_kg')),
      feed_id: formData.get('feed_id') as string,
      current_stock: 0
    };
    
    const siloId = `silo-${Date.now()}`;
    await saveOffline('silos', newSilo, siloId);
    setSelectedSiloIds(prev => [...prev, siloId]);
    setIsQuickAddingSilo(false);
  };

  const [eggCounts, setEggCounts] = useState({
    good: 0,
    broken: 0,
    xl: 0,
    s: 0,
    dirty: 0
  });

  const totalEggsCalc = eggCounts.good + eggCounts.broken + eggCounts.xl + eggCounts.s + eggCounts.dirty;
  const currentHDEP = selectedLot ? (eggCounts.good / selectedLot.current_quantity) * 100 : 0;

  useEffect(() => {
    if (view === 'production' && selectedLot?.type === 'layer') {
      setEggCounts({ good: 0, broken: 0, xl: 0, s: 0, dirty: 0 });
    }
  }, [view, selectedLot]);

  const handleEggCountChange = (field: keyof typeof eggCounts, value: string) => {
    setEggCounts(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleRecordProduction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLot || !permissions.canCreate) return;
    setFormError(null);
    
    const formData = new FormData(e.currentTarget);
    const mortality = Number(formData.get('mortality'));

    if (mortality > selectedLot.current_quantity) {
      setFormError('A mortalidade não pode ser superior à quantidade atual de aves.');
      return;
    }

    const feedUsed = Number(formData.get('feed_consumed'));
    const waterUsed = Number(formData.get('water_consumed'));
    const siloId = formData.get('silo_id') as string;

    if (feedUsed > 0 && siloId) {
      const silo = silos.find(s => s.id === siloId);
      if (silo && feedUsed > silo.current_stock) {
        setFormError(`Quantidade de ração insuficiente no silo ${silo.name}. Disponível: ${silo.current_stock}kg`);
        return;
      }

      // Record Feed Consumption
      await saveOffline('feed_consumptions', {
        date: new Date().toISOString(),
        silo_id: siloId,
        lot_id: selectedLot.id,
        quantity: feedUsed,
        created_by: profile?.uid
      });

      // Update Silo Stock
      if (silo) {
        await saveOffline('silos', { ...silo, current_stock: silo.current_stock - feedUsed }, silo.id);
      }
    }

    if (selectedLot.type === 'layer') {
      const total = totalEggsCalc;
      const good = eggCounts.good;
      const broken = eggCounts.broken;
      const eggsS = eggCounts.s;
      const eggsXL = eggCounts.xl;
      const eggsDirty = eggCounts.dirty;

      if (!validateProduction(total, good, broken, eggsS, eggsXL, eggsDirty)) {
        setFormError('Erro na validação das categorias de ovos.');
        return;
      }

      const eggWeight = Number(formData.get('avg_egg_weight'));

      const { egg_quality_rate, eggs_per_chicken, hdep, lay_percentage, mortality_rate } = calculateEggMetrics(
        { total_eggs: total, good_eggs: good, broken_eggs: broken, mortality, average_egg_weight: eggWeight },
        selectedLot
      );

      const production: Partial<EggProduction> = {
        date: new Date().toISOString(),
        lot_id: selectedLot.id,
        total_eggs: total,
        good_eggs: good,
        broken_eggs: broken,
        eggs_s: eggsS,
        eggs_xl: eggsXL,
        eggs_dirty: eggsDirty,
        average_egg_weight: eggWeight,
        mortality,
        feed_consumed: feedUsed,
        water_consumed: waterUsed,
        notes: formData.get('notes') as string,
        created_by: profile?.uid,
        egg_quality_rate,
        eggs_per_chicken,
        hdep,
        lay_percentage,
        mortality_rate
      };

      await saveOffline('egg_productions', production);

      // Update central egg inventory
      await saveOffline('egg_inventory', {
        total_stock: eggInventory + good
      }, 'central_stock');
    } else {
      // Broiler Weight Record
      const avgWeight = Number(formData.get('avg_weight'));
      const sampleSize = Number(formData.get('sample_size'));

      // Fetch last record for gain calculation
      const lastQ = query(
        collection(db, 'weight_records'),
        where('lot_id', '==', selectedLot.id),
        orderBy('date', 'desc'),
        limit(1)
      );
      const lastSnapshot = await getDocs(lastQ);
      const lastRecord = lastSnapshot.docs.length > 0 ? lastSnapshot.docs[0].data() as WeightRecord : undefined;

      const weightRecord: Partial<WeightRecord> = {
        date: new Date().toISOString(),
        lot_id: selectedLot.id,
        average_weight: avgWeight,
        sample_size: sampleSize,
        mortality,
        feed_consumed: feedUsed,
        water_consumed: waterUsed,
        notes: formData.get('notes') as string,
        created_by: profile?.uid
      };

      // Calculate Metrics
      const { fcr, weight_gain } = calculateBroilerMetrics(weightRecord, lastRecord);
      weightRecord.fcr = fcr;
      weightRecord.weight_gain = weight_gain;

      await saveOffline('weight_records', weightRecord);
    }
    
    // Auto-update lot quantity
    const updatedLot: Partial<ChickenLot> = {
      ...selectedLot,
      current_quantity: selectedLot.current_quantity - mortality,
      cumulative_mortality: (selectedLot.cumulative_mortality || 0) + mortality
    };
    await saveOffline('chicken_lots', updatedLot, selectedLot.id);

    setView('list');
    setSelectedLot(null);
  };

  const handleDeleteLot = async (lotId: string) => {
    if (!permissions.canDelete) return;
    if (!window.confirm('Tem certeza que deseja eliminar este lote permanentemente?')) return;
    setIsDeleting(lotId);
    try {
      await saveOffline('chicken_lots', null, lotId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleStatus = async (lot: ChickenLot) => {
    if (lot.status === 'active') {
      if (!permissions.canEdit) return;
      // If closing, fetch history first to show summary
      const lotId = lot.id;
      const collectionName = lot.type === 'layer' ? 'egg_productions' : 'weight_records';
      const q = query(collection(db, collectionName), where('lot_id', '==', lotId));
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => doc.data());
      
      if (lot.type === 'layer') {
        const eHistory = docs as EggProduction[];
        const totalEggs = eHistory.reduce((sum, r) => sum + r.total_eggs, 0);
        const totalMortality = eHistory.reduce((sum, r) => sum + r.mortality, 0);
        const survivability = ((lot.initial_quantity - totalMortality) / lot.initial_quantity) * 100;
        setCumulativeMetrics({ fcr: 0, total_gain: 0, survivability: Number(survivability.toFixed(2)), total_eggs: totalEggs });
      } else {
        const wHistory = docs as WeightRecord[];
        setCumulativeMetrics(calculateCumulativePerformance(wHistory, lot.initial_quantity));
      }
      setShowClosingSummary(lot);
    } else {
      if (!window.confirm(`Deseja reativar este lote?`)) return;
      await saveOffline('chicken_lots', { ...lot, status: 'active' }, lot.id);
    }
  };

  const confirmCloseLot = async () => {
    if (!showClosingSummary) return;
    await saveOffline('chicken_lots', { ...showClosingSummary, status: 'inactive' }, showClosingSummary.id);
    setShowClosingSummary(null);
    setSelectedLot(null);
    setView('list');
  };

  const fetchHistory = async (lotId: string) => {
    setIsLoadingHistory(true);
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;

    const collectionName = lot.type === 'layer' ? 'egg_productions' : 'weight_records';
    
    const q = query(
      collection(db, collectionName), 
      where('lot_id', '==', lotId),
      orderBy('date', 'desc'),
      limit(50)
    );

    const healthQ = query(
      collection(db, 'health_records'),
      where('lot_id', '==', lotId),
      orderBy('date', 'desc')
    );

    const consQ = query(
      collection(db, 'feed_consumptions'),
      where('lot_id', '==', lotId),
      orderBy('date', 'desc')
    );

    try {
      const [snapshot, healthSnapshot, consSnapshot] = await Promise.all([
        getDocs(q), 
        getDocs(healthQ),
        getDocs(consQ)
      ]);
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const healthDocs = healthSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HealthRecord));
      const consDocs = consSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeedConsumption));
      
      setHealthRecords(healthDocs);
      setFeedConsumptions(consDocs);

      if (lot.type === 'layer') {
        const eHistory = docs as EggProduction[];
        setEggHistory(eHistory);
        const totalEggs = eHistory.reduce((sum, r) => sum + r.total_eggs, 0);
        const totalMortality = eHistory.reduce((sum, r) => sum + r.mortality, 0);
        const survivability = ((lot.initial_quantity - totalMortality) / lot.initial_quantity) * 100;
        
        setCumulativeMetrics({
          fcr: 0,
          total_gain: 0,
          survivability: Number(survivability.toFixed(2)),
          total_eggs: totalEggs
        });
      } else {
        const wHistory = docs as WeightRecord[];
        setWeightHistory(wHistory);
        setCumulativeMetrics(calculateCumulativePerformance(wHistory, lot.initial_quantity));
      }
      setView('lot_dashboard');
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-600 text-white rounded-lg shadow-lg shadow-primary-500/20">
            <Bird size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Plantel Avícola</h1>
            <p className="text-gray-400 text-sm font-medium">Controle de Lotes e Produção Inteligente</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="bg-dark-surface px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-4 shadow-xl">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Database size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Stock de Ovos</p>
              <p className="text-lg font-display font-bold text-white tracking-tight">{eggInventory.toLocaleString()} <span className="text-[10px] text-gray-500">Unid.</span></p>
            </div>
          </div>
          
          {view === 'list' && (profile?.role === 'Admin' || profile?.role === 'Farm Manager') && (
            <button 
              onClick={() => setView('add_lot')}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary-600/30 hover:bg-primary-700 transition-all active:scale-95"
            >
              <Plus size={18} />
              Novo Lote
            </button>
          )}
        </div>
      </div>

      {view === 'list' && (
        <div className="flex gap-2">
           {['active', 'inactive', 'all'].map((f) => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white/10 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
             >
               {f === 'active' ? 'Ativos' : f === 'inactive' ? 'Encerrados' : 'Ver Todos'}
             </button>
           ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {lots.filter(l => filter === 'all' ? true : l.status === filter).map(lot => (
              <div key={lot.id} className="bg-dark-surface rounded-3xl border border-white/5 shadow-2xl overflow-hidden group hover:border-primary-500/30 transition-all relative">
                {lot.status === 'active' && (
                  <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex gap-2 mb-2">
                        <span className={`text-[10px] uppercase font-black tracking-[0.2em] px-3 py-1 rounded-full ${
                          lot.type === 'layer' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {lot.type === 'layer' ? 'Poedeira' : 'Broiler'}
                        </span>
                        <button 
                          onClick={() => handleToggleStatus(lot)}
                          className={`text-[10px] uppercase font-black tracking-[0.2em] px-3 py-1 rounded-full border ${lot.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}
                        >
                          {lot.status === 'active' ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                      <button 
                        onClick={() => { setSelectedLot(lot); fetchHistory(lot.id); }}
                        className="text-2xl font-display font-bold text-white mt-1 tracking-tight hover:text-primary-400 transition-colors text-left"
                      >
                        {lot.lot_name}
                      </button>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Local: {lot.location_id}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-3">
                      <div className="flex gap-2">
                        {permissions.canEdit && (
                          <button 
                            onClick={() => { 
                              setSelectedLot(lot); 
                              setSelectedSiloIds(lot.silo_ids || []);
                              setView('edit_lot'); 
                            }}
                            className="p-2.5 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 transition-all border border-white/5 disabled:opacity-50 active:scale-90"
                            title="Editar Lote"
                          >
                            <Settings2 size={14} />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button 
                            onClick={() => handleDeleteLot(lot.id)}
                            disabled={isDeleting === lot.id}
                            className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 disabled:opacity-50 active:scale-90"
                          >
                             {isDeleting === lot.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="text-3xl font-display font-bold text-white tracking-tighter leading-none">{lot.current_quantity}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Efetivo</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-6 border-y border-white/5 mb-6">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] flex items-center gap-2">
                        <Calendar size={12} /> Idade
                      </p>
                      <p className="text-sm font-bold text-gray-200">{calculateAgeDays(lot.entry_date)} <span className="text-[10px] text-gray-400 font-medium">DIAS</span></p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] flex items-center gap-2">
                        <HeartPulse size={12} /> Mortalidade
                      </p>
                      <p className="text-sm font-bold text-red-400">{(lot.cumulative_mortality || 0)} <span className="text-[10px] text-red-900/40 font-medium">TOTAL</span></p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {permissions.canCreate && (
                      <button 
                        onClick={() => { setSelectedLot(lot); setView('production'); }}
                        className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border active:scale-95 ${
                          lot.type === 'layer' 
                          ? 'bg-amber-600/10 text-amber-500 border-amber-600/20 hover:bg-amber-600 hover:text-white shadow-lg shadow-amber-600/5' 
                          : 'bg-blue-600/10 text-blue-400 border-blue-600/20 hover:bg-blue-600 hover:text-white shadow-lg shadow-blue-600/5'
                        }`}
                      >
                        {lot.type === 'layer' ? <ShieldCheck size={14} /> : <Weight size={14} />}
                        Registrar Produção
                      </button>
                    )}
                    <button 
                      onClick={() => { setSelectedLot(lot); fetchHistory(lot.id); }}
                      className="flex-1 flex items-center justify-center gap-2 h-12 bg-white/5 text-gray-400 border border-white/10 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-white hover:text-dark-bg transition-all active:scale-95 shadow-lg shadow-black/20"
                    >
                      <BarChart3 size={14} />
                      Dashboard
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {view === 'add_lot' && (
          <motion.div 
            key="add_lot"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl bg-dark-surface p-10 rounded-[2.5rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-400 mb-8 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
              <ArrowLeft size={18} /> Voltar para Plantel
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-10 uppercase tracking-tight">Iniciar Novo Lote</h2>
            <form onSubmit={handleAddLot} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Identificação</label>
                  <input required name="lot_name" type="text" placeholder="ex: LOT-2026-X" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Tipo / Linhagem</label>
                  <select name="type" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold">
                    <option value="layer">Poedeira (Postura)</option>
                    <option value="broiler">Broiler (Corte)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Linhagem / Breed</label>
                  <input name="breed" type="text" placeholder="ex: Lohmann Brown" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Efetivo Inicial</label>
                  <input required name="quantity" type="number" placeholder="2500" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">ID do Aviário</label>
                  <select required name="location_id" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold uppercase text-xs tracking-widest">
                    <option value="">Selecionar Aviário</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                    <option value="AV-CENTRAL">Aviário Central</option>
                    <option value="AV-LAB">Aviário Laboratório</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Silos Associados</label>
                    <button 
                      type="button"
                      onClick={() => setIsQuickAddingSilo(true)}
                      className="text-[9px] font-black text-primary-500 uppercase tracking-widest hover:text-primary-400 transition-all flex items-center gap-1"
                    >
                      <Plus size={12} /> Criar Novo Silo
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {silos.map(silo => (
                      <button
                        key={silo.id}
                        type="button"
                        onClick={() => {
                          setSelectedSiloIds(prev => 
                            prev.includes(silo.id) 
                              ? prev.filter(id => id !== silo.id) 
                              : [...prev, silo.id]
                          );
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          selectedSiloIds.includes(silo.id)
                            ? 'bg-primary-500/10 border-primary-500/50 text-white'
                            : 'bg-dark-bg border-white/5 text-gray-500 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Database size={14} className={selectedSiloIds.includes(silo.id) ? 'text-primary-500' : ''} />
                          <p className="text-xs font-bold truncate">{silo.name}</p>
                        </div>
                        <p className="text-[9px] font-medium opacity-50 truncate">{feeds.find(f => f.id === silo.feed_id)?.name || 'Sem Ração'}</p>
                      </button>
                    ))}
                    {silos.length === 0 && (
                      <div className="col-span-full py-4 text-center border-2 border-dashed border-white/5 rounded-2xl">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Nenhum silo disponível</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full h-16 flex items-center justify-center gap-3 bg-primary-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all border border-primary-500/20 active:scale-95">
                <Bird size={20} />
                Registar Alojamento
              </button>
            </form>
          </motion.div>
        )}

        {view === 'production' && selectedLot && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl relative"
          >
            <div className="flex items-center justify-between mb-10 text-gray-400">
              <button onClick={() => { setView('list'); setFormError(null); }} className="flex items-center gap-2 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest">
                <ArrowLeft size={16} /> Cancelar
              </button>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Operando Lote</p>
                <p className="font-display font-bold text-white text-lg tracking-tight">{selectedLot.lot_name}</p>
              </div>
            </div>

            <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">
              {selectedLot.type === 'layer' ? 'Registro de Ovos' : 'Pesagem de Lote'}
            </h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-8">Gestão de Produção UPRAnimal</p>

            {formError && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[11px] font-bold uppercase tracking-wider">
                <AlertTriangle size={18} />
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordProduction} className="space-y-8">
              {selectedLot.type === 'layer' ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1 text-center">Produção Total Bruta</label>
                      <div className="w-full h-16 bg-dark-bg border border-white/5 rounded-2xl text-2xl font-display font-bold text-white flex items-center justify-center shadow-inner">
                        {totalEggsCalc}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1 block ml-1 text-center">HDEP (% Postura)</label>
                      <div className="w-full h-16 bg-white/5 border border-primary-500/20 rounded-2xl text-2xl font-display font-bold text-primary-500 flex items-center justify-center shadow-inner">
                        {currentHDEP.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest block ml-1 text-center">Bons (Padrão)</label>
                    <input required name="good_eggs" type="number" placeholder="0" value={eggCounts.good || ''} onChange={(e) => handleEggCountChange('good', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-emerald-500/10 text-emerald-500 text-xl font-bold text-center focus:bg-white/5 transition-all font-display" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-500/50 uppercase tracking-widest block ml-1 text-center">Quebrados / Perda</label>
                    <input required name="broken_eggs" type="number" placeholder="0" value={eggCounts.broken || ''} onChange={(e) => handleEggCountChange('broken', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-red-500/10 text-red-500 text-xl font-bold text-center focus:bg-white/5 transition-all font-display" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest block ml-1 text-center">Ovos XL</label>
                    <input name="eggs_xl" type="number" placeholder="0" value={eggCounts.xl || ''} onChange={(e) => handleEggCountChange('xl', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-blue-400 text-xl font-bold text-center focus:bg-white/5 transition-all font-display" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-500/50 uppercase tracking-widest block ml-1 text-center">Ovos S</label>
                    <input name="eggs_s" type="number" placeholder="0" value={eggCounts.s || ''} onChange={(e) => handleEggCountChange('s', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-indigo-400 text-xl font-bold text-center focus:bg-white/5 transition-all font-display" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest block ml-1 text-center">Ovos Casca Suja</label>
                    <input name="eggs_dirty" type="number" placeholder="0" value={eggCounts.dirty || ''} onChange={(e) => handleEggCountChange('dirty', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-amber-500/10 text-amber-500 text-xl font-bold text-center focus:bg-white/5 transition-all font-display" />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1 text-center">Peso Médio Ovo (Gramas)</label>
                    <input name="avg_egg_weight" type="number" step="0.1" placeholder="62.5" className="w-full px-6 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white font-bold text-xl text-center focus:bg-white/5 transition-all" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1 text-center">Peso Médio (Gramas)</label>
                    <input required name="avg_weight" type="number" placeholder="1850" className="w-full h-20 bg-dark-bg border border-white/5 rounded-3xl text-4xl font-display font-bold text-white text-center focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-gray-800" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1 text-center">Amostragem (Nº Aves)</label>
                    <input required name="sample_size" type="number" defaultValue="50" className="w-full px-6 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white font-bold text-xl text-center focus:bg-white/5 transition-all" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Silo de Ração</label>
                    <select name="silo_id" className="w-full px-4 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white font-bold text-xs uppercase tracking-widest">
                      <option value="">Selecionar Silo</option>
                      {silos.filter(s => !selectedLot.silo_ids || selectedLot.silo_ids.length === 0 || selectedLot.silo_ids.includes(s.id)).map(s => {
                        const feed = feeds.find(f => f.id === s.feed_id);
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} - {feed?.name || 'Vazio'} ({s.current_stock}kg)
                          </option>
                        );
                      })}
                    </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Consumo Ração (kg)</label>
                   <input name="feed_consumed" type="number" step="0.1" placeholder="0.0" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white text-xl font-bold text-center" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-blue-400/50 uppercase tracking-widest block ml-1">Consumo Água (L)</label>
                   <input name="water_consumed" type="number" step="0.1" placeholder="0.0" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-blue-500/10 text-blue-500 text-xl font-bold text-center appearance-none" />
                 </div>
              </div>

              <div className="p-6 bg-red-500/5 rounded-3xl border border-red-500/10 transition-all">
                <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <HeartPulse size={14} className="animate-pulse" />
                  Mortalidade Detectada
                </label>
                <div className="flex items-center gap-4">
                  <input required name="mortality" type="number" defaultValue="0" className="flex-1 bg-transparent text-3xl font-display font-bold text-red-500 focus:outline-none" />
                  <div className="text-[10px] text-red-500 font-bold uppercase py-2 px-3 bg-red-500/10 rounded-xl">Registo ERP</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block ml-1">Notas da Colheita / Pesagem</label>
                <textarea name="notes" rows={3} placeholder="Condições sanitárias, humidade, comportamento..." className="w-full px-6 py-4 rounded-3xl bg-dark-bg border border-white/5 text-gray-300 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all font-medium"></textarea>
              </div>

              <button type="submit" className="w-full h-20 flex items-center justify-center gap-4 bg-white text-dark-bg rounded-[2rem] font-black text-sm uppercase tracking-[0.4em] shadow-2xl hover:bg-primary-600 hover:text-white transition-all transform active:scale-[0.98]">
                <Save size={20} />
                Finalizar Registo
              </button>
            </form>
          </motion.div>
        )}

        {view === 'edit_lot' && selectedLot && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl bg-dark-surface p-10 rounded-[2.5rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => { setView('list'); setSelectedLot(null); }} className="flex items-center gap-2 text-gray-400 mb-8 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
              <ArrowLeft size={18} /> Voltar para Plantel
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Editar Lote</h2>
            <p className="text-primary-500 font-bold uppercase text-[10px] tracking-widest mb-10">{selectedLot.lot_name}</p>
            
            <form onSubmit={handleEditLot} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Identificação</label>
                  <input required name="lot_name" type="text" defaultValue={selectedLot.lot_name} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Tipo / Linhagem</label>
                  <select name="type" defaultValue={selectedLot.type} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold">
                    <option value="layer">Poedeira (Postura)</option>
                    <option value="broiler">Broiler (Corte)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Linhagem / Breed</label>
                  <input name="breed" type="text" defaultValue={selectedLot.breed} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">ID do Aviário</label>
                  <select required name="location_id" defaultValue={selectedLot.location_id} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold uppercase text-xs tracking-widest">
                    <option value="">Selecionar Aviário</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                    <option value="AV-CENTRAL">Aviário Central</option>
                    <option value="AV-LAB">Aviário Laboratório</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Silos Associados</label>
                    <button 
                      type="button"
                      onClick={() => setIsQuickAddingSilo(true)}
                      className="text-[9px] font-black text-primary-500 uppercase tracking-widest hover:text-primary-400 transition-all flex items-center gap-1"
                    >
                      <Plus size={12} /> Criar Novo Silo
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {silos.map(silo => (
                      <button
                        key={silo.id}
                        type="button"
                        onClick={() => {
                          setSelectedSiloIds(prev => 
                            prev.includes(silo.id) 
                              ? prev.filter(id => id !== silo.id) 
                              : [...prev, silo.id]
                          );
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          selectedSiloIds.includes(silo.id)
                            ? 'bg-primary-500/10 border-primary-500/50 text-white'
                            : 'bg-dark-bg border-white/5 text-gray-500 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Database size={14} className={selectedSiloIds.includes(silo.id) ? 'text-primary-500' : ''} />
                          <p className="text-xs font-bold truncate">{silo.name}</p>
                        </div>
                        <p className="text-[9px] font-medium opacity-50 truncate">{feeds.find(f => f.id === silo.feed_id)?.name || 'Sem Ração'}</p>
                      </button>
                    ))}
                    {silos.length === 0 && (
                      <div className="col-span-full py-4 text-center border-2 border-dashed border-white/5 rounded-2xl">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Nenhum silo disponível</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full h-16 flex items-center justify-center gap-3 bg-white text-dark-bg rounded-[1.25rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-primary-600 hover:text-white transition-all border border-primary-500/20 active:scale-95">
                <Save size={20} />
                Guardar Alterações
              </button>
            </form>
          </motion.div>
        )}

        {view === 'lot_dashboard' && selectedLot && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Header & Main Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-6">
                <button onClick={() => setView('list')} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-white border border-white/5">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-4xl font-display font-bold text-white tracking-tight">{selectedLot.lot_name}</h2>
                    <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full ${selectedLot.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'}`}>
                      {selectedLot.status === 'active' ? 'Ativo' : 'Encerrado'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Database size={12} /> {selectedLot.type === 'layer' ? 'Lote de Postura' : 'Lote de Corte'} • {selectedLot.location_id}
                  </p>
                  
                  {/* Associated Silos Display */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(selectedLot.silo_ids || []).map(sId => {
                      const silo = silos.find(s => s.id === sId);
                      if (!silo) return null;
                      const percent = (silo.current_stock / silo.capacity_kg) * 100;
                      return (
                        <div key={sId} className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg/50 border border-white/5 rounded-xl">
                          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">{silo.name}</span>
                          <span className="text-[10px] font-black text-primary-500">{percent.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                    {(selectedLot.silo_ids || []).length === 0 && (
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">Nenhum silo associado</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedLot.status === 'active' && (
                  <>
                    {permissions.canCreate && (
                      <button 
                        onClick={() => setView('production')}
                        className="h-14 px-8 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all flex items-center gap-3"
                      >
                        {selectedLot.type === 'layer' ? <ShieldCheck size={18} /> : <Weight size={18} />}
                        Registrar Produção
                      </button>
                    )}
                    <button 
                      onClick={() => setView('history')}
                      className="h-14 px-8 bg-white/5 text-gray-400 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-dark-bg transition-all flex items-center gap-3"
                    >
                      <List size={18} />
                      Ver Histórico
                    </button>
                    {permissions.canEdit && (
                      <button 
                        onClick={() => handleToggleStatus(selectedLot)}
                        className="h-14 px-8 bg-amber-600/10 text-amber-500 border border-amber-500/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-amber-600 hover:text-white transition-all flex items-center gap-3"
                      >
                        <CheckCircle2 size={18} />
                        Encerrar Lote
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            {(() => {
              const totalFeedCost = feedConsumptions.reduce((total, cons) => {
                const silo = silos.find(s => s.id === cons.silo_id);
                const feed = feeds.find(f => f.id === (cons.feed_id || silo?.feed_id));
                return total + (cons.quantity * (feed?.cost_per_unit || 0));
              }, 0);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">
                      {selectedLot.type === 'layer' ? 'Produção Total' : 'Eficiência Biológica'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-white mb-1">
                          {selectedLot.type === 'layer' 
                            ? `${(eggHistory[0]?.lay_percentage || eggHistory[0]?.hdep || 0).toFixed(1)}%`
                            : (cumulativeMetrics?.fcr || '0.00')}
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                          {selectedLot.type === 'layer' ? '% Postura (Hoje)' : 'FCR Cumulativo'}
                        </p>
                      </div>
                      <div className={`p-4 rounded-2xl ${selectedLot.type === 'layer' ? 'bg-amber-500/5 text-amber-500' : 'bg-blue-500/5 text-blue-500'}`}>
                        {selectedLot.type === 'layer' ? <ShieldCheck size={24} /> : <BarChart3 size={24} />}
                      </div>
                    </div>
                  </div>

                  <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Investimento Ração</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-primary-500 mb-1">
                          {totalFeedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'CVE' })}
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Custo Total Acumulado</p>
                      </div>
                      <div className="p-4 bg-primary-500/5 text-primary-500 rounded-2xl">
                        <DollarSign size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Sanidade & Vida</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-emerald-500 mb-1">
                          {cumulativeMetrics?.survivability || 100}%
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Survivabilidade</p>
                      </div>
                      <div className="p-4 bg-emerald-500/5 text-emerald-500 rounded-2xl">
                        <HeartPulse size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Cronologia</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-white mb-1">{calculateAgeDays(selectedLot.entry_date)}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Dias de Vida</p>
                      </div>
                      <div className="p-4 bg-white/5 text-gray-400 rounded-2xl">
                        <Calendar size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Efetivo Atual</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-white mb-1">{selectedLot.current_quantity}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Aves Ativas</p>
                      </div>
                      <div className="p-4 bg-primary-500/5 text-primary-500 rounded-2xl">
                        <Bird size={24} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Main History Table */}
              <div className="xl:col-span-2 bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold text-white uppercase tracking-tight">Histórico de Performance</h3>
                  <button onClick={() => setView('history')} className="text-[10px] font-black text-primary-400 uppercase tracking-widest hover:text-white transition-colors">Ver Completo</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                        <th className="pb-4">Data</th>
                        {selectedLot.type === 'layer' ? (
                          <>
                            <th className="pb-4 text-center">Produção</th>
                            <th className="pb-4 text-center">% Postura</th>
                          </>
                        ) : (
                          <>
                            <th className="pb-4 text-center">Peso</th>
                            <th className="pb-4 text-center">FCR ID</th>
                          </>
                        )}
                        <th className="pb-4 text-right">Mortalidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedLot.type === 'layer' ? (
                        eggHistory.slice(0, 10).map(rec => (
                          <tr key={rec.id} className="group">
                            <td className="py-4 text-sm font-bold text-white">{format(new Date(rec.date), 'dd/MM')}</td>
                            <td className="py-4 text-center font-display font-bold text-white">{rec.total_eggs}</td>
                            <td className="py-4 text-center">
                              <span className="text-[11px] font-black px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg">{(rec.lay_percentage || rec.hdep || 0).toFixed(1)}%</span>
                            </td>
                            <td className="py-4 text-right">
                              <span className={`font-bold ${rec.mortality > 0 ? 'text-red-400' : 'text-gray-500'}`}>{rec.mortality}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        weightHistory.slice(0, 10).map(rec => (
                          <tr key={rec.id} className="group">
                            <td className="py-4 text-sm font-bold text-white">{format(new Date(rec.date), 'dd/MM')}</td>
                            <td className="py-4 text-center font-display font-bold text-white">{rec.average_weight}g</td>
                            <td className="py-4 text-center">
                              <span className={`text-[11px] font-black px-2 py-1 rounded-lg ${(rec.fcr || 0) < 1.6 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {rec.fcr || '—'}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <span className={`font-bold ${rec.mortality > 0 ? 'text-red-400' : 'text-gray-500'}`}>{rec.mortality}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Health and Sanitization */}
              <div className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold text-white uppercase tracking-tight">Sanidade</h3>
                  <Pill size={18} className="text-primary-500" />
                </div>
                <div className="space-y-6">
                  {healthRecords.length === 0 ? (
                    <div className="p-12 text-center text-gray-700">
                      <HeartPulse size={40} className="mx-auto mb-4 opacity-10" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Sem alertas sanitários</p>
                    </div>
                  ) : healthRecords.map(rec => (
                    <div key={rec.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{rec.service}</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${rec.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                          {rec.status === 'completed' ? 'REALIZADO' : 'PENDENTE'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white mb-1">{rec.notes || 'Sem observações'}</p>
                      <p className="text-[9px] text-gray-500 font-medium">{format(new Date(rec.date), 'dd/MM/yyyy')}</p>
                    </div>
                  ))}
                  {permissions.canEdit && (
                    <button 
                      onClick={() => setIsAddingHealth(true)}
                      className="w-full py-4 bg-primary-600/10 border border-primary-600/20 rounded-2xl text-[10px] font-black text-primary-400 uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Novo Evento Sanitário
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'history' && selectedLot && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-10">
              <button onClick={() => setView('lot_dashboard')} className="flex items-center gap-2 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
                <ArrowLeft size={18} /> Voltar para Dashboard
              </button>
              <div className="text-right">
                <h3 className="text-2xl font-display font-bold text-white tracking-tight">{selectedLot.lot_name}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                  {selectedLot.type === 'layer' ? 'Histórico Completo de Produção' : 'Histórico Completo de Pesagens'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <th className="px-6 py-4 text-center">Data</th>
                        {selectedLot.type === 'layer' ? (
                          <>
                            <th className="px-6 py-4 text-center">Total</th>
                            <th className="px-6 py-4 text-center">Bons/S/XL/Sujos/Queb</th>
                            <th className="px-6 py-4 text-center">% Postura</th>
                            <th className="px-6 py-4 text-center">Qualidade</th>
                          </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-center">Peso Médio</th>
                        <th className="px-6 py-4 text-center">Consumo (kg/L)</th>
                        <th className="px-6 py-4 text-center">Ganho</th>
                        <th className="px-6 py-4 text-center">FCR (Conversão)</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-center">Mortalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selectedLot.type === 'layer' ? (
                    eggHistory.length === 0 ? (
                      <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhum registo encontrado.</td></tr>
                    ) : eggHistory.map((record) => (
                      <tr key={record.id} className="group hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-white mb-0.5">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{format(new Date(record.date), 'HH:mm')}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-display font-bold text-white">{record.total_eggs}</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                           <div className="flex flex-col gap-1">
                             <p className="text-xs text-gray-400 font-bold">
                               <span className="text-emerald-500">{record.good_eggs}</span> / 
                               <span className="text-indigo-400"> {record.eggs_s || 0}</span> / 
                               <span className="text-blue-400"> {record.eggs_xl || 0}</span> / 
                               <span className="text-amber-500"> {record.eggs_dirty || 0}</span> /
                               <span className="text-red-500"> {record.broken_eggs || 0}</span>
                             </p>
                             <p className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">Bons / S / XL / Sujos / Queb</p>
                           </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-display font-bold text-primary-400">{(record.lay_percentage || record.hdep || 0).toFixed(1)}%</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                              (record.egg_quality_rate || 0) > 95 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {(record.egg_quality_rate || 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-sm font-display font-bold ${record.mortality > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {record.mortality}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    weightHistory.length === 0 ? (
                      <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhum registo encontrado.</td></tr>
                    ) : weightHistory.map((record) => (
                      <tr key={record.id} className="group hover:bg-white/5 transition-colors">
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-white mb-0.5">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-display font-bold text-white">{record.average_weight}g</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <p className="text-xs text-gray-400 font-bold">{record.feed_consumed || 0}kg / {record.water_consumed || 0}L</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-display font-bold text-emerald-500">+{record.weight_gain || 0}g</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                            (record.fcr || 0) < 1.6 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {record.fcr || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-sm font-display font-bold ${record.mortality > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {record.mortality}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {isAddingHealth && selectedLot && (
          <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md bg-dark-surface p-10 rounded-[3rem] border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Evento Sanitário</h3>
                <button onClick={() => setIsAddingHealth(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                await saveOffline('health_records', {
                  date: new Date().toISOString(),
                  lot_id: selectedLot.id,
                  service: formData.get('service') as string,
                  notes: formData.get('notes') as string,
                  status: 'completed',
                  created_by: profile?.uid
                });
                setIsAddingHealth(false);
                fetchHistory(selectedLot.id);
              }} className="space-y-6">
                <input required name="service" placeholder="Vacinação, Desinfecção..." className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold" />
                <textarea name="notes" placeholder="Detalhes, lote da vacina..." className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white text-sm" rows={4} />
                <button type="submit" className="w-full h-16 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-500 transition-all">Registar Evento</button>
              </form>
            </motion.div>
          </div>
        )}

        {isQuickAddingSilo && (
          <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md bg-dark-surface p-10 rounded-[3rem] border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Rápido Silo</h3>
                <button onClick={() => setIsQuickAddingSilo(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleQuickAddSilo} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome do Silo</label>
                  <input required name="name" className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capacidade (kg)</label>
                  <input required name="capacity_kg" type="number" className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Localização</label>
                  <select required name="location_id" className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold uppercase text-xs tracking-widest">
                    <option value="AV-CENTRAL">Aviário Central</option>
                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ração Associada</label>
                  <select required name="feed_id" className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold uppercase text-xs tracking-widest">
                    <option value="">Selecionar Ração</option>
                    {feeds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full h-16 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-500 transition-all mt-4 font-display">Criar e Associar Silo</button>
              </form>
            </motion.div>
          </div>
        )}

        {showClosingSummary && (
          <div className="fixed inset-0 bg-dark-bg/90 backdrop-blur-xl z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl bg-dark-surface p-10 rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden relative"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
               <h3 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Relatório de Encerramento</h3>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-10">Lote: {showClosingSummary.lot_name}</p>
               
               <div className="grid grid-cols-2 gap-6 mb-10">
                 <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Ovos produzidos</p>
                    <p className="text-2xl font-display font-bold text-white">{showClosingSummary.type === 'layer' ? (cumulativeMetrics?.total_eggs || 0).toLocaleString() : 'N/A'}</p>
                 </div>
                 <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Mortalidade Final</p>
                    <p className="text-2xl font-display font-bold text-red-500">{showClosingSummary.cumulative_mortality || 0}</p>
                 </div>
                 <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">FCR (Conversão) Final</p>
                    <p className="text-2xl font-display font-bold text-primary-400">{showClosingSummary.type === 'broiler' ? cumulativeMetrics?.fcr : 'N/A'}</p>
                 </div>
                 <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Taxa de Sobrevivência</p>
                    <p className="text-2xl font-display font-bold text-emerald-500">{cumulativeMetrics?.survivability}%</p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <button onClick={() => setShowClosingSummary(null)} className="flex-1 py-5 bg-white/5 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-white/10 transition-all">Cancelar</button>
                 <button onClick={confirmCloseLot} className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all">Confirmar Encerramento</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Poultry;
