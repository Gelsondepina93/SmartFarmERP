import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Animal, MilkProduction } from '../types';
import { Trees as Cow, Plus, List, Milk, History, Search, Filter, ArrowLeft, ChevronRight, Weight, Activity, Save } from 'lucide-react';
import { saveOffline } from '../lib/offlineService';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const Ruminants = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [view, setView] = useState<'list' | 'detail' | 'add' | 'milk'>('list');
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  const permissions = profile?.permissions || {
    canCreate: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canEdit: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canDelete: profile?.role === 'Admin'
  };

  useEffect(() => {
    const q = query(collection(db, 'animals'), orderBy('tag_number', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnimals(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Animal)));
    });
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-600/20">
            <Cow size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white tracking-tight uppercase">Produção de Ruminantes</h1>
            <p className="text-gray-400 text-sm">Registros individuais de animais e produção de leite.</p>
          </div>
        </div>
        
        {view === 'list' && permissions.canCreate && (
          <button 
            onClick={() => setView('add')}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-95"
          >
            <Plus size={16} />
            Registrar Animal
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="bg-dark-surface p-4 rounded-xl border border-dark-border flex flex-col md:flex-row gap-4 items-center shadow-xl shadow-black/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Pesquisar por brinco..." className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-dark-border rounded-lg text-sm text-white focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-500" />
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 border border-dark-border rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all text-gray-300">
                  <Filter size={14} /> Filtros
                </button>
              </div>
            </div>

            <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden shadow-xl shadow-black/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/30 border-b border-dark-border">
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brinco / ID</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Peso</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {animals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic font-medium">Nenhum animal registrado ainda.</td>
                    </tr>
                  ) : (
                    animals.map(animal => (
                      <tr key={animal.id} className="hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={() => { setSelectedAnimal(animal); setView('detail'); }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                              {animal.animal_type.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-200">#{animal.tag_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-400 capitalize">{animal.animal_type} / {animal.breed}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            animal.status === 'active' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-500'
                          }`}>
                            {animal.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-bold text-gray-300 text-sm">
                            <Weight size={14} className="text-gray-400" />
                            {animal.weight} kg
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-gray-400 group-hover:text-blue-400 transition-colors">
                            <ChevronRight size={20} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {animals.length === 0 && permissions.canCreate && (
              <button 
                onClick={async () => {
                  const demo = [
                    { tag_number: 'CAB-001', animal_type: 'cow', breed: 'Holstein', sex: 'female', weight: 520, status: 'active', location_id: 'Barn-A' },
                    { tag_number: 'CAB-002', animal_type: 'cow', breed: 'Jersey', sex: 'female', weight: 480, status: 'active', location_id: 'Barn-A' },
                    { tag_number: 'GAT-105', animal_type: 'goat', breed: 'Alpine', sex: 'female', weight: 65, status: 'active', location_id: 'Barn-B' },
                  ];
                  for(const d of demo) await saveOffline('animals', d);
                }}
                className="w-full p-4 bg-gray-800/50 border border-dashed border-dark-border rounded-xl text-gray-500 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all text-[10px]"
              >
                + Inicializar conjunto de dados demonstrativos de animais para CV UPRAnimal
              </button>
            )}
          </motion.div>
        )}

        {view === 'detail' && selectedAnimal && (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
           className="space-y-6"
         >
           <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors uppercase text-[10px] font-bold tracking-widest">
             <ArrowLeft size={16} /> Voltar para Lista do Rebanho
           </button>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 space-y-6">
                <div className="bg-dark-surface p-8 rounded-2xl border border-dark-border shadow-xl shadow-black/20 text-center">
                  <div className="w-24 h-24 bg-blue-900/30 rounded-3xl mx-auto flex items-center justify-center text-blue-400 mb-6 border-4 border-gray-800 shadow-2xl shadow-black/40">
                    <Cow size={48} />
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white tracking-tight uppercase">#{selectedAnimal.tag_number}</h2>
                  <p className="text-blue-500 font-bold text-xs uppercase tracking-widest mt-2">{selectedAnimal.animal_type === 'cow' ? 'Vaca' : 'Cabra'}</p>
                  
                  <div className="mt-8 pt-8 border-t border-dashed border-dark-border space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Raça</span>
                      <span className="font-bold text-gray-200">{selectedAnimal.breed}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sexo</span>
                      <span className="font-bold text-gray-200 capitalize">{selectedAnimal.sex === 'female' ? 'Fêmea' : 'Macho'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Status</span>
                      <span className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full text-[10px] font-bold uppercase">{selectedAnimal.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 border border-dark-border p-6 rounded-2xl text-white">
                  <h3 className="font-bold flex items-center gap-2 mb-4 uppercase text-xs tracking-widest text-primary-400">
                    <Milk size={18} />
                    Ações Rápidas
                  </h3>
                  <div className="space-y-3">
                    {permissions.canCreate && (
                      <button 
                        onClick={() => setView('milk')}
                        className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all text-left px-5 flex items-center justify-between group">
                        Registrar Produção de Leite <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-400" />
                      </button>
                    )}
                    <button 
                      onClick={() => navigate('/health')}
                      className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all text-left px-5 flex items-center justify-between group">
                      Registros Médicos <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-400" />
                    </button>
                    <button className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all text-left px-5 flex items-center justify-between group">
                      Registro de Peso <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-400" />
                    </button>
                  </div>
                </div>
             </div>

             <div className="lg:col-span-2 space-y-6">
                <div className="bg-dark-surface rounded-2xl border border-dark-border shadow-xl shadow-black/20 overflow-hidden">
                  <div className="p-6 border-b border-dark-border flex items-center justify-between bg-gray-800/10">
                    <h3 className="font-bold text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                      <History size={18} className="text-blue-500" />
                      Atividade Recente
                    </h3>
                  </div>
                  <div className="p-8">
                    <div className="space-y-8">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-5">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-dark-border z-10 relative">
                              <Activity size={18} />
                            </div>
                            {i < 3 && <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-12 bg-dark-border"></div>}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-white">Vacinação: Reforço de Febre Aftosa</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">05 de Maio, 2026</p>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">Administrado pelo Dr. Mendes. Próximo reforço em 6 meses.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-dark-surface p-6 rounded-2xl border border-dark-border shadow-xl shadow-black/20">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-display">Média de Leite Diária</p>
                    <p className="text-3xl font-bold text-white font-display tracking-tight">18.5 <span className="text-xs text-gray-400">Litros</span></p>
                  </div>
                  <div className="bg-dark-surface p-6 rounded-2xl border border-dark-border shadow-xl shadow-black/20">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-display">Peso Atual</p>
                    <p className="text-3xl font-bold text-white font-display tracking-tight">{selectedAnimal.weight} <span className="text-xs text-gray-400">kg</span></p>
                  </div>
                </div>
             </div>
           </div>
         </motion.div>
        )}
        {view === 'milk' && selectedAnimal && (
          <motion.div 
            key="milk"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl bg-dark-surface p-10 rounded-[2.5rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => setView('detail')} className="flex items-center gap-2 text-gray-400 mb-8 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
              <ArrowLeft size={18} /> Voltar para Detalhes
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tight">Produção de Leite</h2>
            <p className="text-primary-500 font-bold uppercase text-[10px] tracking-widest mb-10">#{selectedAnimal.tag_number} - {selectedAnimal.breed}</p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                animal_id: selectedAnimal.id,
                date: new Date().toISOString(),
                liters: Number(formData.get('liters')),
                milking_shift: formData.get('shift'),
                created_by: profile?.uid
              };
              await saveOffline('milk_productions', data);
              setView('detail');
            }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Quantidade (Litros)</label>
                  <input required name="liters" type="number" step="0.1" placeholder="0.0" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Turno</label>
                  <select name="shift" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold">
                    <option value="morning">Manhã</option>
                    <option value="evening">Tarde/Noite</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full h-16 flex items-center justify-center gap-3 bg-primary-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all border border-primary-500/20 active:scale-95">
                <Save size={20} />
                Registrar Produção
              </button>
            </form>
          </motion.div>
        )}

        {view === 'add' && (
          <motion.div 
            key="add"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl bg-dark-surface p-10 rounded-[2.5rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-400 mb-8 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
              <ArrowLeft size={18} /> Cancelar Registo
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-10 uppercase tracking-tight">Novo Animal</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                tag_number: formData.get('tag_number'),
                animal_type: formData.get('type'),
                breed: formData.get('breed'),
                sex: formData.get('sex'),
                weight: Number(formData.get('weight')),
                status: 'active',
                birth_date: new Date().toISOString(),
                location_id: 'Barn-A'
              };
              await saveOffline('animals', data);
              setView('list');
            }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Nº do Brinco</label>
                   <input required name="tag_number" type="text" placeholder="Ex: ABC-123" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Tipo</label>
                  <select name="type" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold">
                    <option value="cow">Vaca / Bovino</option>
                    <option value="goat">Cabra / Caprino</option>
                    <option value="sheep">Ovelha / Ovino</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Raça</label>
                  <input required name="breed" type="text" placeholder="Ex: Holstein" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Peso Inicial (kg)</label>
                  <input required name="weight" type="number" placeholder="0" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-primary-500/20 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Sexo</label>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center p-4 bg-dark-bg border border-white/5 rounded-xl cursor-pointer has-[:checked]:bg-primary-600/20 has-[:checked]:border-primary-500 transition-all">
                      <input type="radio" name="sex" value="female" defaultChecked className="hidden" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Fêmea</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center p-4 bg-dark-bg border border-white/5 rounded-xl cursor-pointer has-[:checked]:bg-primary-600/20 has-[:checked]:border-primary-500 transition-all">
                      <input type="radio" name="sex" value="male" className="hidden" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Macho</span>
                    </label>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full h-16 flex items-center justify-center gap-3 bg-white text-dark-bg rounded-[1.25rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-primary-600 hover:text-white transition-all border border-primary-500/20 active:scale-95">
                <Plus size={20} />
                Concluir Registo
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ruminants;
