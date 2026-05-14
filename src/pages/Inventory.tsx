import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem } from '../types';
import { Package, Plus, Search, Filter, AlertTriangle, ArrowUpRight, ArrowDownRight, Tablet as Medicine, Trash2, Save, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveOffline } from '../lib/offlineService';
import { useAuth } from '../contexts/AuthContext';

const Inventory = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'medicine' | 'equipment'>('all');
  const [view, setView] = useState<'list' | 'add'>('list');
  const [loading, setLoading] = useState(true);

  const permissions = profile?.permissions || {
    canCreate: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canEdit: profile?.role === 'Admin' || profile?.role === 'Farm Manager',
    canDelete: profile?.role === 'Admin'
  };

  useEffect(() => {
    const q = query(collection(db, 'inventories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryItem)));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    const formData = new FormData(e.currentTarget);
    const stock = Number(formData.get('stock'));
    const min_stock = Number(formData.get('min_stock'));
    
    const newItem: Partial<InventoryItem> = {
      name: formData.get('name') as string,
      type: formData.get('type') as 'medicine' | 'equipment',
      stock: stock,
      min_stock: min_stock,
      unit: formData.get('unit') as string,
      price: Number(formData.get('price')),
      status: stock <= min_stock ? (stock === 0 ? 'critical' : 'low') : 'good',
      created_by: profile?.uid,
      last_updated: new Date().toISOString()
    };

    await saveOffline('inventories', newItem);
    setView('list');
  };

  const updateStock = async (item: InventoryItem, delta: number) => {
    if (!permissions.canEdit) return;
    const newStock = Math.max(0, item.stock + delta);
    const updated: Partial<InventoryItem> = {
      ...item,
      stock: newStock,
      status: newStock <= item.min_stock ? (newStock === 0 ? 'critical' : 'low') : 'good',
      last_updated: new Date().toISOString()
    };
    await saveOffline('inventories', updated, item.id);
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    return item.type === activeTab;
  });

  const criticalItems = items.filter(i => i.status !== 'good');
  const inventoryValue = items.reduce((acc, curr) => acc + (curr.stock * curr.price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-600/20">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Inventário Técnico</h1>
            <p className="text-gray-400 text-sm font-medium">Controle de Insumos, Medicamentos e Ativos</p>
          </div>
        </div>
        
        {permissions.canCreate && (
          <button 
            onClick={() => setView('add')}
            className="flex items-center gap-3 bg-amber-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-amber-600/30 hover:bg-amber-500 transition-all active:scale-95"
          >
            <Plus size={18} />
            Novo Insumo
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="md:col-span-2 space-y-6">
              <div className="bg-dark-surface p-4 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-4 shadow-2xl">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Localizar no almoxarifado..." className="w-full pl-12 pr-4 py-4 bg-dark-bg border border-white/5 rounded-2xl text-sm text-white focus:ring-2 focus:ring-amber-500/20 transition-all font-bold" />
                </div>
                <div className="flex bg-dark-bg p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
                  {['all', 'medicine', 'equipment'].map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`flex-1 md:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-amber-600 text-white shadow-xl px-8' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      {tab === 'all' ? 'Ver Tudo' : tab === 'medicine' ? 'Veterinária' : 'Ferramentas'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-dark-surface rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="px-8 py-5">Recurso / Item</th>
                      <th className="px-8 py-5">Categoria</th>
                      <th className="px-8 py-5 text-center">Estatuto</th>
                      <th className="px-8 py-5 text-center">Quantidade</th>
                      <th className="px-8 py-5 text-right w-32">Operação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'medicine' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                               {item.type === 'medicine' ? <Medicine size={14} /> : <Package size={14} />}
                             </div>
                             <div>
                               <p className="font-bold text-white text-sm">{item.name}</p>
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Min: {item.min_stock} {item.unit}</p>
                             </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full border border-white/5 font-mono">
                             {item.type}
                           </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              item.status === 'good' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 
                              item.status === 'low' ? 'bg-amber-500/5 text-amber-500 border-amber-500/20' : 'bg-red-500/5 text-red-500 border-red-500/20'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <p className={`font-display font-bold text-lg ${item.stock <= item.min_stock ? 'text-red-400' : 'text-white'}`}>
                             {item.stock} <span className="text-[10px] text-gray-400 font-black uppercase">{item.unit}</span>
                           </p>
                        </td>
                        <td className="px-8 py-6">
                          {permissions.canEdit && (
                            <div className="flex items-center justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => updateStock(item, 1)} className="p-2.5 bg-dark-bg text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border border-white/5"><Plus size={16} /></button>
                              <button onClick={() => updateStock(item, -1)} className="p-2.5 bg-dark-bg text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-white/5"><ArrowDownRight size={16} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <AlertTriangle size={150} className="absolute -right-10 -bottom-10 text-red-500/5 -rotate-12 group-hover:scale-110 transition-transform" />
                <h3 className="flex items-center gap-3 font-black text-red-500 text-xs uppercase tracking-[0.2em] mb-6 relative">
                  <AlertTriangle size={18} />
                  Défice de Stock
                </h3>
                <div className="space-y-4 relative">
                  {criticalItems.length === 0 ? (
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center py-8">Todo o inventário está conforme.</p>
                  ) : criticalItems.map(item => (
                    <div key={item.id} className="p-4 bg-dark-surface/50 rounded-2xl border border-red-500/10 flex justify-between items-center group/item hover:bg-red-500/5 transition-all">
                      <div>
                        <p className="text-xs font-bold text-white mb-0.5">{item.name}</p>
                        <p className="text-[10px] text-red-500 font-black uppercase tracking-tighter">Estoque: {item.stock} {item.unit}</p>
                      </div>
                      <button className="p-2 bg-red-600 rounded-xl text-white opacity-0 group-item-hover:opacity-100 transition-all shadow-lg shadow-red-500/20">
                         <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl shadow-black/20">
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Valor Imobilizado</h3>
                 <div className="space-y-6">
                   <div className="flex justify-between items-center px-2">
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ativos Veterinários</span>
                     <span className="font-display font-bold text-white">{(inventoryValue * 0.62).toLocaleString()} CVE</span>
                   </div>
                   <div className="flex justify-between items-center px-2">
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ferramentaria</span>
                     <span className="font-display font-bold text-white">{(inventoryValue * 0.38).toLocaleString()} CVE</span>
                   </div>
                   <div className="pt-6 mt-2 border-t border-white/5 flex justify-between items-center px-2">
                     <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Total Estimado</span>
                     <span className="text-3xl font-display font-bold text-white tracking-tight">{inventoryValue.toLocaleString()} CVE</span>
                   </div>
                 </div>
                 <button className="w-full mt-10 py-5 bg-white/5 border border-white/5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-white transition-all">Relatório de Auditoria</button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="max-w-3xl mx-auto bg-dark-surface p-12 rounded-[3rem] border border-white/5 shadow-2xl"
          >
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-gray-400 mb-10 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition-all">
              <ArrowLeft size={16} /> Voltar para Lote
            </button>
            <h2 className="text-3xl font-display font-bold text-white mb-10 uppercase tracking-tight">Registar Novo Ativo</h2>
            <form onSubmit={handleAddItem} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome do Insumo / Equipamento</label>
                   <input required name="name" type="text" placeholder="ex: Vacina Aftosa 500ml" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold text-lg focus:ring-4 focus:ring-amber-500/10 transition-all font-display" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoria Técnica</label>
                   <select name="type" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-black text-[11px] uppercase tracking-widest focus:ring-4 focus:ring-amber-500/10 transition-all">
                     <option value="medicine">Medicamento / Veterinária</option>
                     <option value="equipment">Equipamento / Manutenção</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Unidade de Medida</label>
                   <input required name="unit" type="text" placeholder="ex: Frascos, Kilos, Unid." className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-bold focus:ring-4 focus:ring-amber-500/10 transition-all" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Quantidade Inicial</label>
                   <input required name="stock" type="number" placeholder="25" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-white font-display font-bold text-xl focus:ring-4 focus:ring-amber-500/10 transition-all" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nível Crítico (Aviso)</label>
                   <input required name="min_stock" type="number" placeholder="10" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-red-400 font-display font-bold text-xl focus:ring-4 focus:ring-red-500/10 transition-all" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Valor Unitário Médio (CVE)</label>
                   <input required name="price" step="0.01" type="number" placeholder="12.50" className="w-full px-6 py-5 bg-dark-bg border border-white/5 rounded-3xl text-emerald-500 font-display font-bold text-xl focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full h-20 bg-amber-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl shadow-amber-600/30 hover:bg-amber-500 transition-all mt-10 active:scale-[0.98] flex items-center justify-center gap-4">
                <Save size={20} />
                Adicionar ao Inventário
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
