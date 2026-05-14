import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Silo, Feed, FeedStockMovement, FeedConsumption, ChickenLot, Animal, Location as FarmLocation } from '../types';
import { Wheat, Plus, RefreshCw, ArrowUp, ArrowDown, Database, MapPin, AlertTriangle, Save, Bird, History, Zap, Trash2, ArrowLeft, Calendar, Settings2 } from 'lucide-react';
import { saveOffline } from '../lib/offlineService';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const FeedManagement = () => {
  const { profile } = useAuth();
  const [silos, setSilos] = useState<Silo[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [movements, setMovements] = useState<FeedStockMovement[]>([]);
  const [consumptions, setConsumptions] = useState<FeedConsumption[]>([]);
  const [lots, setLots] = useState<ChickenLot[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [view, setView] = useState<'grid' | 'movement' | 'consume' | 'add_silo' | 'edit_silo' | 'manage_feeds' | 'history'>('grid');
  const [selectedSilo, setSelectedSilo] = useState<Silo | null>(null);

  const permissions = profile?.permissions || {
    canCreate: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canEdit: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canDelete: profile?.role === 'Admin'
  };

  const handleEditSilo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSilo || !permissions.canEdit) return;
    const formData = new FormData(e.currentTarget);
    
    const updatedSilo: Partial<Silo> = {
      ...selectedSilo,
      name: formData.get('name') as string,
      location_id: formData.get('location_id') as string,
      capacity_kg: Number(formData.get('capacity_kg')),
      feed_id: formData.get('feed_id') as string,
    };

    await saveOffline('silos', updatedSilo, selectedSilo.id);
    setView('grid');
    setSelectedSilo(null);
  };
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeSilos = onSnapshot(collection(db, 'silos'), (snapshot) => {
      setSilos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Silo)));
    });

    const unsubscribeFeeds = onSnapshot(collection(db, 'feeds'), (snapshot) => {
      setFeeds(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Feed)));
    });

    const unsubscribeMoves = onSnapshot(query(collection(db, 'stock_movements'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeedStockMovement)));
    });

    const unsubscribeLocs = onSnapshot(query(collection(db, 'locations'), where('type', 'in', ['silo', 'aviary', 'barn'])), (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FarmLocation)));
    });

    const unsubscribeCons = onSnapshot(collection(db, 'feed_consumptions'), (snapshot) => {
      setConsumptions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeedConsumption)));
    });

    const unsubscribeLots = onSnapshot(query(collection(db, 'chicken_lots'), where('status', '==', 'active')), (snapshot) => {
      setLots(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChickenLot)));
    });

    const unsubscribeAnimals = onSnapshot(query(collection(db, 'animals'), where('status', '==', 'active')), (snapshot) => {
      setAnimals(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Animal)));
    });

    return () => {
      unsubscribeSilos();
      unsubscribeFeeds();
      unsubscribeMoves();
      unsubscribeCons();
      unsubscribeLots();
      unsubscribeAnimals();
      unsubscribeLocs();
    };
  }, []);

  const handleQuickSetup = async () => {
    if (!permissions.canCreate) return;
    if (!window.confirm('Isto irá criar automaticamente 2 Aviários, 4 Silos e 2 tipos de Ração. Deseja continuar?')) return;
    
    try {
      // 1. Create Default Feeds first
      const feed1Id = `feed-postura-${Date.now()}`;
      const feed2Id = `feed-broiler-${Date.now()}`;
      
      await saveOffline('feeds', { 
        name: 'UPR Postura Premium', 
        type: 'Avicultura', 
        protein_percentage: 17.5, 
        unit: 'kg', 
        cost_per_unit: 85,
        created_at: new Date().toISOString()
      }, feed1Id);
      
      await saveOffline('feeds', { 
        name: 'UPR Broiler Fase Final', 
        type: 'Avicultura', 
        protein_percentage: 19.0, 
        unit: 'kg', 
        cost_per_unit: 92,
        created_at: new Date().toISOString()
      }, feed2Id);

      // 2. Create Locations (Aviaries)
      const av1Id = `av-01-${Date.now()}`;
      const av2Id = `av-02-${Date.now()}`;
      
      await saveOffline('locations', { name: 'Aviário 01', type: 'aviary', capacity: 5000, status: 'active' }, av1Id);
      await saveOffline('locations', { name: 'Aviário 02', type: 'aviary', capacity: 5000, status: 'active' }, av2Id);
      
      // 3. Create 4 Silos with assigned feeds
      const silosToCreate = [
        { name: 'Silo A1-P', location_id: av1Id, capacity_kg: 10000, current_stock: 5000, feed_id: feed1Id },
        { name: 'Silo A1-B', location_id: av1Id, capacity_kg: 10000, current_stock: 5000, feed_id: feed2Id },
        { name: 'Silo A2-P', location_id: av2Id, capacity_kg: 10000, current_stock: 5000, feed_id: feed1Id },
        { name: 'Silo A2-B', location_id: av2Id, capacity_kg: 10000, current_stock: 5000, feed_id: feed2Id },
      ];
      
      for (const silo of silosToCreate) {
        const siloId = `silo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await saveOffline('silos', silo, siloId);
        
        // Add initial movement for visualization
        await saveOffline('stock_movements', {
          silo_id: siloId,
          movement_type: 'in',
          quantity: 5000,
          date: new Date().toISOString(),
          user_id: profile?.uid || 'init',
          notes: 'Stock de Abertura (Config. Rápida)'
        });
      }
      
      setView('grid');
    } catch (err) {
      console.error(err);
      setError('Erro na configuração rápida.');
    }
  };

  const handleCreateSilo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    const formData = new FormData(e.currentTarget);
    
    const newSilo: Partial<Silo> = {
      name: formData.get('name') as string,
      location_id: formData.get('location_id') as string,
      capacity_kg: Number(formData.get('capacity_kg')),
      current_stock: Number(formData.get('current_stock')),
      feed_id: formData.get('feed_id') as string,
    };

    await saveOffline('silos', newSilo);
    setView('grid');
  };

  const handleDeleteSilo = async (siloId: string) => {
    if (!permissions.canDelete) return;
    if (!window.confirm('Tem certeza que deseja eliminar este silo? Os dados de estoque serão perdidos.')) return;
    
    setIsDeleting(siloId);
    try {
      await saveOffline('silos', null, siloId, 'delete');
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const enrichedSilos = React.useMemo(() => {
    return silos.map(silo => {
      // 1. Calculate consumption based on associated lots (User formula: 0.112kg per bird)
      const associatedLots = lots.filter(lot => lot.silo_ids?.includes(silo.id));
      const totalBirds = associatedLots.reduce((acc, lot) => acc + (lot.current_quantity || 0), 0);
      const expectedDailyCons = totalBirds * 0.112;

      // 2. Fallback to historical consumption if no lots are associated
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const siloCons = (consumptions || []).filter(c => c.silo_id === silo.id);
      
      const recentCons = siloCons.filter(c => {
        if (!c.date) return false;
        const d = new Date(c.date);
        return !isNaN(d.getTime()) && d >= fourteenDaysAgo;
      });
      
      const totalHistCons = recentCons.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const daysWithConsumption = new Set(recentCons.map(c => c.date?.split('T')[0])).size || 1;
      const histAvg = totalHistCons / daysWithConsumption;

      // Final consumption to use: priority to lot-based calculation
      const dailyCons = expectedDailyCons > 0 ? expectedDailyCons : histAvg;
      const remaining = dailyCons > 0 ? Math.floor((silo.current_stock || 0) / dailyCons) : 0;
      
      return {
        ...silo,
        current_stock: silo.current_stock || 0,
        capacity_kg: silo.capacity_kg || 1000,
        daily_consumption_average: dailyCons,
        remaining_feed_days: remaining,
        associated_birds: totalBirds
      };
    });
  }, [silos, consumptions, lots]);

  const handleStockIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSilo || !permissions.canEdit) return;
    const formData = new FormData(e.currentTarget);
    const qty = Number(formData.get('quantity'));
    
    const movement: Partial<FeedStockMovement> = {
      silo_id: selectedSilo.id,
      movement_type: 'in',
      quantity: qty,
      date: new Date().toISOString(),
      user_id: profile?.uid || '',
      notes: formData.get('notes') as string
    };

    await saveOffline('stock_movements', movement);
    
    const updatedSilo: Partial<Silo> = {
      ...selectedSilo,
      current_stock: selectedSilo.current_stock + qty
    };
    await saveOffline('silos', updatedSilo, selectedSilo.id, 'update');
    
    setView('grid');
    setSelectedSilo(null);
  };

  const handleConsume = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSilo || !permissions.canCreate) return;
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const qty = Number(formData.get('quantity'));
    const targetType = formData.get('target_type') as 'lot' | 'animal';
    const targetId = formData.get('target_id') as string;

    if (qty > selectedSilo.current_stock) {
      setError('Quantidade indisponível no silo.');
      return;
    }

    const consumption: Partial<FeedConsumption> = {
      silo_id: selectedSilo.id,
      feed_id: selectedSilo.feed_id,
      quantity: qty,
      date: new Date().toISOString(),
      created_by: profile?.uid || '',
      lot_id: targetType === 'lot' ? targetId : undefined,
      animal_id: targetType === 'animal' ? targetId : undefined,
    };

    await saveOffline('feed_consumptions', consumption);
    
    const updatedSilo: Partial<Silo> = {
      ...selectedSilo,
      current_stock: selectedSilo.current_stock - qty
    };
    await saveOffline('silos', updatedSilo, selectedSilo.id, 'update');

    setView('grid');
    setSelectedSilo(null);
  };

  const handleCreateFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    const formData = new FormData(e.currentTarget);
    const newFeed: Partial<Feed> = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      protein_percentage: Number(formData.get('protein_percentage')),
      unit: 'kg',
      cost_per_unit: Number(formData.get('cost_per_unit'))
    };
    await saveOffline('feeds', newFeed);
    (e.target as HTMLFormElement).reset();
  };

  const handleDeleteFeed = async (id: string) => {
    if (!permissions.canDelete) return;
    if (!window.confirm('Eliminar esta ração?')) return;
    await saveOffline('feeds', null, id, 'delete');
  };

  const handleLevelColor = (percent: number) => {
    if (percent < 15) return 'bg-red-500';
    if (percent < 40) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-600/20">
            <Wheat size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Silos e Ração</h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide leading-tight">Logística Agro-Industrial UPRAnimal</p>
          </div>
        </div>
        <div className="flex gap-3">
          {enrichedSilos.length === 0 && permissions.canCreate && (
            <button 
              onClick={handleQuickSetup}
              className="px-6 py-3 bg-white/5 text-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/10 transition-all flex items-center gap-2 active:scale-95"
            >
              <Zap size={16} /> Config. Rápida (4 Silos)
            </button>
          )}
          <button 
            onClick={() => setView('manage_feeds')}
            className="px-6 py-3 bg-white/5 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95"
          >
            <Settings2 size={16} /> Gerir Rações
          </button>
          {permissions.canCreate && (
            <button 
              onClick={() => setView('add_silo')}
              className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} /> Novo Silo
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'grid' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-12"
          >
            {/* Quick Summary Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-dark-surface p-6 rounded-[2rem] border border-white/5 flex items-center gap-6 shadow-xl">
                <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                  <Database size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Capacidade Total</p>
                  <p className="text-2xl font-display font-bold text-white">{(enrichedSilos.reduce((acc, s) => acc + s.capacity_kg, 0) / 1000).toFixed(1)}t</p>
                </div>
              </div>
              <div className="bg-dark-surface p-6 rounded-[2rem] border border-white/5 flex items-center gap-6 shadow-xl">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center">
                  <Zap size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Estoque Consolidado</p>
                  <p className="text-2xl font-display font-bold text-white">{(enrichedSilos.reduce((acc, s) => acc + s.current_stock, 0) / 1000).toFixed(1)}t</p>
                </div>
              </div>
              <div className="bg-dark-surface p-6 rounded-[2rem] border border-white/5 flex items-center gap-6 shadow-xl">
                <div className="w-14 h-14 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center">
                  <History size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Autonomia Média</p>
                  <p className="text-2xl font-display font-bold text-white">
                    {Math.round(enrichedSilos.reduce((acc, s) => acc + (s.remaining_feed_days || 0), 0) / (enrichedSilos.length || 1))} Dias
                  </p>
                </div>
              </div>
            </div>

            {/* Silos Grouped by Location */}
            {Array.from(new Set(enrichedSilos.map(s => s.location_id))).map(locId => {
              const location = locations.find(l => l.id === locId);
              const locationSilos = enrichedSilos.filter(s => s.location_id === locId);
              
              return (
                <div key={locId} className="space-y-6">
                  <div className="flex items-center gap-4 px-2">
                    <MapPin size={18} className="text-amber-500" />
                    <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">
                      {location?.name || (locId === 'central_warehouse' ? 'Armazém Central' : locId)}
                    </h2>
                    <div className="h-px bg-white/5 flex-1 ml-4"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {locationSilos.map(silo => {
                      const percent = Math.min((silo.current_stock / silo.capacity_kg) * 100, 100);
                      const feed = feeds.find(f => f.id === silo.feed_id);
                      return (
                        <div 
                          key={silo.id}
                          className="bg-dark-surface rounded-[2.5rem] border border-white/5 p-6 shadow-2xl overflow-hidden relative group hover:border-amber-500/30 transition-all flex flex-col"
                        >
                          <div className="flex items-start justify-between mb-8">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                              <Database size={24} />
                            </div>
                           <div className="text-right flex flex-col items-end gap-2">
                               <div className="flex gap-2">
                                {permissions.canEdit && (
                                  <button 
                                    onClick={() => { setSelectedSilo(silo); setView('edit_silo'); }}
                                    className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-all border border-white/5"
                                    title="Editar"
                                  >
                                    <Settings2 size={14} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => { setSelectedSilo(silo); setView('history'); }}
                                  className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-all border border-white/5"
                                  title="Histórico"
                                >
                                  <History size={14} />
                                </button>
                                {permissions.canDelete && (
                                  <button 
                                    onClick={() => handleDeleteSilo(silo.id)}
                                    disabled={isDeleting === silo.id}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20 disabled:opacity-50"
                                    title="Eliminar"
                                  >
                                    {isDeleting === silo.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mb-6">
                            <h3 className="font-display font-bold text-white text-xl mb-1 truncate">{silo.name}</h3>
                            <div className="flex items-center gap-2">
                              <Wheat size={12} className="text-amber-500/50" />
                              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{feed?.name || 'Não Definido'}</p>
                            </div>
                          </div>

                          {/* Level Indicator Shell */}
                          <div className="relative h-56 bg-dark-bg/50 rounded-[2.5rem] overflow-hidden mb-8 border border-white/5 shadow-inner">
                            {/* Animated Level Liquid */}
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${percent}%` }}
                              className={`absolute bottom-0 w-full transition-all duration-1000 ${handleLevelColor(percent)} opacity-20 blur-xl`}
                            ></motion.div>
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${percent}%` }}
                              className={`absolute bottom-0 w-full transition-all duration-1000 ${handleLevelColor(percent)} shadow-[0_-10px_30px_rgba(245,158,11,0.3)]`}
                            >
                               {/* Liquid shine effect */}
                               <div className="absolute top-0 left-0 w-full h-4 bg-white/20 blur-[2px]"></div>
                            </motion.div>

                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                              <p className="text-5xl font-display font-black text-white drop-shadow-lg">{percent.toFixed(0)}%</p>
                              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mt-1">Capacidade Utilizada</p>
                            </div>
                          </div>

                          <div className="space-y-4 mb-8 bg-black/20 p-4 rounded-3xl border border-white/5">
                             <div className="flex justify-between items-center px-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estoque Real</span>
                               <span className="text-sm font-bold text-white">{silo.current_stock.toLocaleString()} kg</span>
                             </div>
                             <div className="flex justify-between items-center px-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capacidade Silo</span>
                               <span className="text-sm font-bold text-gray-400">{(silo.capacity_kg/1000).toFixed(1)}t</span>
                             </div>
                             <div className="flex justify-between items-center px-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Efetivo Associado</span>
                               <span className="text-sm font-bold text-white">{(silo as any).associated_birds || 0} Aves</span>
                             </div>
                             <div className="pt-3 border-t border-white/5 flex justify-between items-center px-1">
                               <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Autonomia</span>
                               <div className="flex items-center gap-2">
                                 {silo.remaining_feed_days < 5 && (silo as any).associated_birds > 0 && (
                                   <motion.div 
                                     animate={{ scale: [1, 1.1, 1] }} 
                                     transition={{ repeat: Infinity, duration: 2 }}
                                     className="p-1 bg-red-500 rounded-full"
                                   >
                                     <AlertTriangle size={10} className="text-white" />
                                   </motion.div>
                                 )}
                                 <span className={`text-sm font-bold ${silo.remaining_feed_days < 5 && (silo as any).associated_birds > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                   {silo.remaining_feed_days || '—'} Dias
                                 </span>
                               </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-auto">
                            {permissions.canEdit && (
                              <button 
                                onClick={() => { setSelectedSilo(silo); setView('movement'); }}
                                className="flex items-center justify-center gap-2 py-4 bg-emerald-600/10 text-emerald-500 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all active:scale-95 border border-emerald-500/20"
                              >
                                <ArrowUp size={14} /> Abastecer
                              </button>
                            )}
                            {permissions.canCreate && (
                              <button 
                                onClick={() => { setSelectedSilo(silo); setView('consume'); }}
                                className="flex items-center justify-center gap-2 py-4 bg-primary-600/10 text-primary-500 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all active:scale-95 border border-primary-500/20"
                              >
                                <ArrowDown size={14} /> Consumo
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {enrichedSilos.length === 0 && (
              <div className="py-32 text-center bg-dark-bg/30 border-2 border-dashed border-white/5 rounded-[3rem]">
                <Database size={60} className="mx-auto mb-6 text-gray-800" />
                <h3 className="text-xl font-display font-bold text-white mb-2 uppercase tracking-tight">Cofre de Logística Vazio</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto font-medium mb-8">Nenhum silo cadastrado no sistema. Inicie a configuração da sua infraestrutura de logística UPRAnimal.</p>
                <button 
                  onClick={() => setView('add_silo')}
                  className="px-10 py-5 bg-amber-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-amber-600/20 hover:bg-amber-500 transition-all"
                >
                  Criar Primeiro Silo
                </button>
              </div>
            )}
          </motion.div>
        )}

        {view === 'movement' && selectedSilo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl relative"
          >
            <button onClick={() => setView('grid')} className="absolute top-10 left-10 text-gray-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </button>
            <div className="pt-10 mb-10 text-center">
              <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Abastecer Silo</h2>
              <p className="text-emerald-500 font-bold uppercase text-[10px] tracking-[0.2em]">{selectedSilo.name}</p>
            </div>

            <form onSubmit={handleStockIn} className="space-y-8">
              <div className="space-y-3 text-center">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Quantidade em Quilogramas</label>
                <input required name="quantity" type="number" placeholder="5000" className="w-full h-24 bg-dark-bg border border-white/5 rounded-3xl text-5xl font-display font-bold text-emerald-500 text-center focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-gray-800" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-4">Observações do Recebimento</label>
                <textarea name="notes" rows={3} placeholder="ex: Carga do fornecedor X, qualidade verificada..." className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-gray-300 text-sm focus:ring-2 focus:ring-primary-500/20 transition-all"></textarea>
              </div>

              <button type="submit" className="w-full h-20 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-4">
                <Save size={20} />
                Registar Entrada
              </button>
            </form>
          </motion.div>
        )}

        {view === 'consume' && selectedSilo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl relative"
          >
            <button onClick={() => { setView('grid'); setError(null); }} className="absolute top-10 left-10 text-gray-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </button>
            <div className="pt-10 mb-10 text-center">
              <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Lançar Consumo</h2>
              <p className="text-primary-500 font-bold uppercase text-[10px] tracking-[0.2em]">{selectedSilo.name}</p>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[11px] font-black uppercase tracking-wider animate-shake">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleConsume} className="space-y-8">
              <div className="space-y-3 text-center">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Quantidade Retirada (kg)</label>
                <input required name="quantity" type="number" placeholder="250" className="w-full h-24 bg-dark-bg border border-white/5 rounded-3xl text-5xl font-display font-bold text-primary-500 text-center focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-gray-800" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Destino</label>
                  <select name="target_type" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold text-xs uppercase tracking-widest transition-all">
                    <option value="lot">Plantel (Lote)</option>
                    <option value="animal">Ruminante (Indiv)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">ID do Alvo</label>
                  <select name="target_id" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold text-xs tracking-widest transition-all">
                    {lots.map(l => <option key={`lot-${l.id}`} value={l.id}>{l.lot_name}</option>)}
                    {animals.map(a => <option key={`animal-${a.id}`} value={a.id}>{a.tag_number}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full h-20 bg-primary-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-primary-600/20 hover:bg-primary-500 transition-all active:scale-95 flex items-center justify-center gap-4">
                <Zap size={20} />
                Confirmar Saída
              </button>
            </form>
          </motion.div>
        )}

        {view === 'edit_silo' && selectedSilo && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl relative"
          >
            <button onClick={() => { setView('grid'); setSelectedSilo(null); }} className="absolute top-10 left-10 text-gray-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </button>
            <div className="pt-10 mb-10 text-center">
              <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Editar Silo</h2>
              <p className="text-amber-500 font-bold uppercase text-[10px] tracking-[0.2em]">{selectedSilo.name}</p>
            </div>

            <form onSubmit={handleEditSilo} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome do Silo</label>
                <input required name="name" type="text" defaultValue={selectedSilo.name} className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Capacidade (kg)</label>
                <input required name="capacity_kg" type="number" defaultValue={selectedSilo.capacity_kg} className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all font-display" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Localização</label>
                  <select required name="location_id" defaultValue={selectedSilo.location_id} className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all uppercase text-xs tracking-widest">
                    <option value="">Selecionar Localização</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                    <option value="central_warehouse">Armazém Central</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Tipo de Ração</label>
                  <select required name="feed_id" defaultValue={selectedSilo.feed_id} className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all uppercase text-xs tracking-widest">
                    <option value="">Selecionar Ração</option>
                    {feeds.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full h-20 bg-amber-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all active:scale-95 flex items-center justify-center gap-4 mt-4">
                <Save size={20} />
                Guardar Alterações
              </button>
            </form>
          </motion.div>
        )}

        {view === 'add_silo' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl mx-auto bg-dark-surface p-10 rounded-[3rem] border border-white/5 shadow-2xl relative"
          >
            <button onClick={() => setView('grid')} className="absolute top-10 left-10 text-gray-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </button>
            <div className="pt-10 mb-10 text-center">
              <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Novo Silo</h2>
              <p className="text-amber-500 font-bold uppercase text-[10px] tracking-[0.2em]">Configurar Unidade de Armazenamento</p>
            </div>

            <form onSubmit={handleCreateSilo} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome do Silo</label>
                <input required name="name" type="text" placeholder="Silo Norte 01" className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Capacidade (kg)</label>
                  <input required name="capacity_kg" type="number" placeholder="10000" className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all font-display" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Estoque Inicial (kg)</label>
                  <input required name="current_stock" type="number" defaultValue="0" className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all font-display" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Localização</label>
                  <select required name="location_id" className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all uppercase text-xs tracking-widest">
                    <option value="">Selecionar Localização</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                    <option value="central_warehouse">Armazém Central</option>
                    <option value="poultry_zone">Zona Avícola</option>
                    <option value="bovine_zone">Zona Ruminantes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Tipo de Ração</label>
                  <select required name="feed_id" className="w-full px-6 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold focus:ring-2 focus:ring-amber-500/20 transition-all uppercase text-xs tracking-widest">
                    <option value="">Selecionar Ração</option>
                    {feeds.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full h-20 bg-amber-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all active:scale-95 flex items-center justify-center gap-4 mt-4">
                <Save size={20} />
                Guardar Silo
              </button>
            </form>
          </motion.div>
        )}

        {view === 'manage_feeds' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1 bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <button onClick={() => setView('grid')} className="text-gray-400 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 mb-8">
                <ArrowLeft size={16} /> Voltar
              </button>
              <h2 className="text-2xl font-display font-bold text-white mb-8 uppercase tracking-tight">Criar Ração</h2>
              <form onSubmit={handleCreateFeed} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nome da Ração</label>
                  <input required name="name" type="text" placeholder="ex: Postura Fase 2" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Categoria</label>
                  <input required name="type" type="text" placeholder="ex: Avicultura" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">% Proteína</label>
                    <input name="protein_percentage" type="number" step="0.1" placeholder="17.5" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Custo/kg (CVE)</label>
                    <input name="cost_per_unit" type="number" step="0.01" placeholder="95.00" className="w-full px-5 py-4 bg-dark-bg border border-white/5 rounded-2xl text-white font-bold font-display text-sm" />
                  </div>
                </div>
                <button type="submit" className="w-full h-16 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all flex items-center justify-center gap-3">
                  <Save size={18} /> Guardar Produto
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Catálogo de Rações</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeds.map(feed => (
                  <div key={feed.id} className="bg-dark-surface p-6 rounded-[2rem] border border-white/5 shadow-xl flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white">{feed.name}</h3>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">{feed.type} • {feed.protein_percentage}% Prot.</p>
                      <p className="text-xs font-display font-medium text-amber-500/50 mt-2">{feed.cost_per_unit} CVE/kg</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteFeed(feed.id)}
                      className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {feeds.length === 0 && (
                  <div className="col-span-2 py-20 text-center text-gray-600 border-2 border-dashed border-white/5 rounded-[2rem]">
                    <Wheat size={40} className="mx-auto mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma ração cadastrada</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'history' && selectedSilo && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
             <div className="flex items-center justify-between bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-6">
                <button onClick={() => setView('grid')} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-white border border-white/5">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight uppercase">{selectedSilo.name}</h2>
                  <p className="text-amber-500 font-bold uppercase text-[10px] tracking-[0.2em]">Histórico de Movimentação</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <h3 className="text-xl font-display font-bold text-white mb-8 uppercase tracking-tight">Registo de Entradas e Saídas</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                          <th className="pb-4">Data</th>
                          <th className="pb-4">Tipo</th>
                          <th className="pb-4">Quantidade</th>
                          <th className="pb-4">Origem/Destino</th>
                          <th className="pb-4">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {/* Combine and sort movements and consumptions for this silo */}
                        {[
                          ...movements.filter(m => m.silo_id === selectedSilo.id).map(m => ({ ...m, type: 'mov' })),
                          ...consumptions.filter(c => c.silo_id === selectedSilo.id).map(c => ({ ...c, type: 'cons' }))
                        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((rec, idx) => (
                          <tr key={idx} className="group hover:bg-white/5 transition-colors">
                            <td className="py-4">
                              <p className="text-sm font-bold text-white">{format(new Date(rec.date), 'dd/MM/yyyy')}</p>
                              <p className="text-[9px] text-gray-500 font-black tracking-widest">{format(new Date(rec.date), 'HH:mm')}</p>
                            </td>
                            <td className="py-4">
                              <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${rec.type === 'mov' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary-500/10 text-primary-500'}`}>
                                {rec.type === 'mov' ? 'Entrada' : 'Saída'}
                              </span>
                            </td>
                            <td className="py-4 font-display font-bold text-white">
                              {rec.quantity.toLocaleString()} kg
                            </td>
                            <td className="py-4 text-xs font-bold text-gray-400 uppercase">
                              {(rec as any).lot_id ? `Lote: ${(rec as any).lot_id}` : (rec as any).animal_id ? `Indiv: ${(rec as any).animal_id}` : 'Abastecimento'}
                            </td>
                            <td className="py-4 text-xs text-gray-500 italic max-w-xs truncate">
                                {(rec as any).notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Métricas de Silo</p>
                  <div className="space-y-6">
                    <div>
                      <p className="text-3xl font-display font-bold text-white tracking-tight">{selectedSilo.current_stock.toLocaleString()} kg</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Stock Atual</p>
                    </div>
                    <div className="pt-6 border-t border-white/5">
                      <p className="text-3xl font-display font-bold text-white tracking-tight">{(enrichedSilos.find(s => s.id === selectedSilo.id) as any)?.associated_birds || 0}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Efetivo de Aves</p>
                    </div>
                    <div className="pt-6 border-t border-white/5">
                      <p className={`text-3xl font-display font-bold tracking-tight ${selectedSilo.remaining_feed_days < 5 && ((enrichedSilos.find(s => s.id === selectedSilo.id) as any)?.associated_birds || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {selectedSilo.remaining_feed_days || '—'} Dias
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Autonomia (0.112kg/ave)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeedManagement;
