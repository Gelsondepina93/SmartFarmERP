import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { saveOffline } from '../lib/offlineService';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, History, ArrowLeft, ArrowRight, AlertTriangle, Database, TrendingUp, ShoppingBag, BarChart3, Search, Trash2, Printer, FileText, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const EggSales = () => {
  const { profile } = useAuth();
  const [eggInventory, setEggInventory] = useState<number>(0);
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [saleValues, setSaleValues] = useState({ qty: 0, price: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  useEffect(() => {
    let unsubscribeEggInv: (() => void) | undefined;
    let unsubscribeSales: (() => void) | undefined;
    let unsubscribeCosts: (() => void) | undefined;

    const setupListeners = () => {
      unsubscribeEggInv = onSnapshot(doc(db, 'egg_inventory', 'central_stock'), (snapshot) => {
        if (snapshot.exists()) {
          setEggInventory(snapshot.data().total_stock || 0);
        } else if (profile?.role === 'Admin') {
          // Initialize if doesn't exist
          saveOffline('egg_inventory', {
            total_stock: 0,
            last_updated: new Date().toISOString()
          }, 'central_stock');
        }
      });

      unsubscribeSales = onSnapshot(
        query(collection(db, 'sales'), where('product_type', '==', 'eggs'), orderBy('date', 'desc'), limit(100)),
        (snapshot) => {
          setEggSales(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        }
      );

      unsubscribeCosts = onSnapshot(
        query(collection(db, 'costs'), orderBy('date', 'desc'), limit(100)),
        (snapshot) => {
          setCosts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        }
      );
    };

    if (profile) {
      setupListeners();
    }

    return () => {
      unsubscribeEggInv?.();
      unsubscribeSales?.();
      unsubscribeCosts?.();
    };
  }, [profile]);

  const chartData = React.useMemo(() => {
    const monthlyData: { [key: string]: { month: string; sales: number; costs: number } } = {};
    
    // Process Sales (last 6 months)
    eggSales.forEach(sale => {
      const date = new Date(sale.date);
      const monthKey = format(date, 'MMM yyyy');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, sales: 0, costs: 0 };
      }
      monthlyData[monthKey].sales += sale.total_amount || 0;
    });

    // Process Costs (last 6 months)
    costs.forEach(cost => {
      const date = new Date(cost.date);
      const monthKey = format(date, 'MMM yyyy');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, sales: 0, costs: 0 };
      }
      monthlyData[monthKey].costs += cost.amount || 0;
    });

    return Object.values(monthlyData).reverse().slice(-6);
  }, [eggSales, costs]);

  const permissions = profile?.permissions || {
    canCreate: ['Admin', 'Farm Manager', 'Operator', 'Director'].includes(profile?.role || ''),
    canEdit: ['Admin', 'Farm Manager', 'Operator'].includes(profile?.role || ''),
    canDelete: profile?.role === 'Admin'
  };

  const handleSellEggs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!permissions.canCreate) return;
    setIsSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);
    
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));
    const unitPrice = Number(formData.get('unit_price'));
    const customer = formData.get('customer') as string;

    console.log("Processing egg sale:", { quantity, unitPrice, customer, currentStock: eggInventory });

    if (isNaN(quantity) || quantity <= 0) {
      setFormError("A quantidade deve ser superior a zero.");
      setIsSubmitting(false);
      return;
    }

    if (quantity > eggInventory) {
      setFormError(`Quantidade insuficiente. Stock disponível: ${eggInventory}`);
      setIsSubmitting(false);
      return;
    }

    const sale = {
      date: new Date().toISOString(),
      product_type: 'eggs',
      quantity,
      unit_price: unitPrice,
      total_amount: quantity * unitPrice,
      customer,
      created_by: profile?.uid,
      farm_id: profile?.farm_id
    };

    try {
      // Record Sale
      await saveOffline('sales', sale);
      
      // Update Inventory
      await saveOffline('egg_inventory', {
        total_stock: eggInventory - quantity,
        last_updated: new Date().toISOString()
      }, 'central_stock');

      setSuccessMsg(`Venda de ${quantity} ovos registada com sucesso!`);
      (e.target as HTMLFormElement).reset();
      setSaleValues({ qty: 0, price: 0 });
    } catch (error) {
      console.error("Erro ao processar venda:", error);
      setFormError("Erro ao processar venda. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!['Admin', 'Farm Manager'].includes(profile?.role || '')) return;
    
    const formData = new FormData(e.currentTarget);
    const newStock = Number(formData.get('new_stock'));
    const reason = formData.get('reason') as string;

    try {
      await saveOffline('egg_inventory', {
        total_stock: newStock,
        last_updated: new Date().toISOString(),
        adjustment_reason: reason,
        adjusted_by: profile?.uid
      }, 'central_stock');
      
      setIsAdjustingStock(false);
      setSuccessMsg("Stock atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao ajustar stock:", error);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!permissions.canDelete) return;
    if (!window.confirm('Tem certeza que deseja eliminar este registo de venda? O stock não será reposto automaticamente.')) return;

    try {
      await saveOffline('sales', null, saleId, 'delete');
      setSuccessMsg("Venda eliminada com sucesso.");
      if (selectedSale?.id === saleId) setSelectedSale(null);
    } catch (error) {
      console.error("Erro ao eliminar venda:", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredSales = eggSales.filter(sale => {
    const matchesSearch = sale.customer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (startDate || endDate) {
      const saleDate = new Date(sale.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) {
        start.setHours(0, 0, 0, 0);
        if (saleDate < start) return false;
      }

      if (end) {
        end.setHours(23, 59, 59, 999);
        if (saleDate > end) return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-500/20">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Vendas de Ovos</h1>
            <p className="text-gray-400 text-sm font-medium">Gestão Comercial e Saída de Stock</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {['Admin', 'Farm Manager'].includes(profile?.role || '') && (
            <button 
              onClick={() => setIsAdjustingStock(!isAdjustingStock)}
              className={`p-3 rounded-2xl border border-white/5 transition-all ${isAdjustingStock ? 'bg-amber-500 text-white' : 'bg-dark-surface text-gray-400 hover:text-white'}`}
              title="Ajustar Stock"
            >
              <Database size={20} />
            </button>
          )}
          <div className="bg-dark-surface px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-4 shadow-xl">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Database size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Stock Central</p>
              <p className="text-xl font-display font-bold text-white tracking-tight">{eggInventory.toLocaleString()} <span className="text-[10px] text-gray-500">Unid.</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <AnimatePresence mode="wait">
            {isAdjustingStock ? (
              <motion.div 
                key="adjust"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl"
              >
                <h2 className="text-xl font-display font-bold text-white mb-6 uppercase tracking-tight flex items-center gap-3">
                  <Database size={20} className="text-amber-500" /> Corrigir Stock
                </h2>
                <form onSubmit={handleAdjustStock} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Novo Inventário Total</label>
                    <input required name="new_stock" type="number" defaultValue={eggInventory} className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white text-xl font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Motivo do Ajuste</label>
                    <input required name="reason" type="text" placeholder="ex: Contagem física, Erro de registo" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setIsAdjustingStock(false)} className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Confirmar</button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="sale"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-2xl"
              >
                <h2 className="text-xl font-display font-bold text-white mb-6 uppercase tracking-tight flex items-center gap-3">
                  <DollarSign size={20} className="text-emerald-500" /> Nova Venda
                </h2>

                {formError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[10px] font-black uppercase tracking-wider">
                    <AlertTriangle size={18} />
                    {formError}
                  </div>
                )}

                {successMsg && (
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
                    <TrendingUp size={18} />
                    {successMsg}
                  </div>
                )}

                <form onSubmit={handleSellEggs} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Quantidade (Ovos)</label>
                <input 
                  required 
                  name="quantity" 
                  type="number" 
                  placeholder="ex: 360" 
                  onChange={(e) => setSaleValues(prev => ({ ...prev, qty: Number(e.target.value) }))}
                  className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold text-xl" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Preço Unid (ESC)</label>
                <input 
                  required 
                  name="unit_price" 
                  type="number" 
                  step="0.01" 
                  placeholder="ex: 15.00" 
                  onChange={(e) => setSaleValues(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold text-xl" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Cliente / Empresa</label>
                <input required name="customer" type="text" placeholder="Nome do Cliente" className="w-full px-5 py-4 rounded-2xl bg-dark-bg border border-white/5 text-white focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold text-sm" />
              </div>

              <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Total Estimado</p>
                <p className="text-3xl font-display font-bold text-white tracking-tighter">
                  CVE <span className="text-emerald-500">{(saleValues.qty * saleValues.price).toLocaleString('pt-BR')}</span>
                </p>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || saleValues.qty > eggInventory}
                className="w-full h-16 flex items-center justify-center gap-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                <DollarSign size={18} />
                Confirmar Venda
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

          <div className="bg-dark-surface p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
             <div className="flex items-center justify-between mb-4">
               <div>
                 <p className="text-3xl font-display font-bold text-emerald-500">
                   {eggSales.reduce((acc, sale) => acc + (sale.total_amount || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'CVE' })}
                 </p>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Faturamento (Top 20)</p>
               </div>
               <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                 <TrendingUp size={24} />
               </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-dark-surface p-8 rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-3">
                  <BarChart3 size={20} className="text-emerald-500" /> Comparativo Mensal
                </h2>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Vendas vs Custos Totais</p>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 800 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 800 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                  <Bar dataKey="sales" name="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="costs" name="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-dark-surface p-8 rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/5 text-gray-400 rounded-2xl">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Histórico de Vendas</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Relatório detalhado de transações</p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">De</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-dark-bg border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold text-white focus:ring-1 focus:ring-emerald-500/50 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Até</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-dark-bg border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold text-white focus:ring-1 focus:ring-emerald-500/50 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar cliente..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-dark-bg border border-white/5 rounded-xl py-2 pl-10 pr-4 text-[11px] text-white focus:ring-1 focus:ring-emerald-500/50 transition-all font-bold placeholder:text-gray-600 outline-none"
                  />
                </div>

                {(searchTerm || startDate || endDate) && (
                  <button 
                    onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                    className="p-2 text-gray-500 hover:text-white transition-all"
                    title="Limpar Filtros"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto -mx-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5">Data</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5">Cliente</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5 text-right">Qtd (Unid)</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5 text-right">Preço Unid</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5 text-right">Total</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <ShoppingBag size={48} className="mx-auto text-gray-800 mb-4 opacity-20" />
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Nenhum registo encontrado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr 
                        key={sale.id} 
                        className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div>
                            <p className="text-[11px] font-bold text-white">{format(new Date(sale.date), 'dd/MM/yyyy')}</p>
                            <p className="text-[9px] text-gray-500 font-black uppercase mt-0.5">{format(new Date(sale.date), 'HH:mm')}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-[11px] font-bold text-gray-300 uppercase tracking-tight group-hover:text-emerald-400 transition-colors truncate max-w-[200px]">
                            {sale.customer}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <p className="text-[11px] font-bold text-white">{sale.quantity.toLocaleString()}</p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <p className="text-[11px] font-bold text-gray-400">{sale.unit_price?.toLocaleString()} <span className="text-[8px] opacity-50 ml-0.5">CVE</span></p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <p className="text-[11px] font-bold text-emerald-500">{sale.total_amount?.toLocaleString()} <span className="text-[8px] opacity-50 ml-0.5 whitespace-nowrap">CVE</span></p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}
                              className="p-2 text-gray-600 hover:text-white transition-all bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"
                              title="Ver Comprovativo"
                            >
                              <FileText size={14} />
                            </button>
                            {permissions.canDelete && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }}
                                className="p-2 text-gray-600 hover:text-red-500 transition-all bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"
                                title="Eliminar Registo"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedSale && (
          <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6 print:p-0 print:bg-white print:backdrop-blur-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-dark-surface w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden print:border-none print:shadow-none print:rounded-none print:bg-white print:text-black"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-lg font-display font-bold text-white uppercase tracking-tight">Detalhes da Venda</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint} className="p-2.5 text-gray-400 hover:text-white transition-all bg-white/5 rounded-xl">
                    <Printer size={20} />
                  </button>
                  <button onClick={() => setSelectedSale(null)} className="p-2.5 text-gray-400 hover:text-white transition-all bg-white/5 rounded-xl">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-10 space-y-8 print:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest print:text-gray-400">Cliente / Empresa</p>
                    <p className="text-3xl font-display font-bold text-white print:text-black uppercase tracking-tight">{selectedSale.customer}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest print:text-gray-400">Data da Venda</p>
                    <p className="text-sm font-bold text-white print:text-black">{format(new Date(selectedSale.date), 'dd MMMM yyyy • HH:mm')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Produto</p>
                    <p className="text-sm font-bold text-white print:text-black uppercase">Ovos Bovinos</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Quantidade</p>
                    <p className="text-sm font-bold text-white print:text-black">{selectedSale.quantity} Unid.</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 print:bg-gray-50 print:border-gray-200">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Preço Unitário</p>
                    <p className="text-sm font-bold text-white print:text-black">CVE {selectedSale.unit_price?.toLocaleString()}</p>
                  </div>
                  <div className="p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/10 print:bg-emerald-50 print:border-emerald-200">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Pago</p>
                    <p className="text-sm font-bold text-emerald-500 print:text-emerald-700">CVE {selectedSale.total_amount?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 space-y-4 print:border-gray-100">
                  <div className="flex items-center justify-between opacity-50">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">ID da Transação</p>
                    <p className="text-[9px] font-mono text-white print:text-black">{selectedSale.id}</p>
                  </div>
                  <div className="flex items-center justify-between opacity-50 print:mt-4">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Registado Por</p>
                    <p className="text-[9px] font-bold text-white print:text-black">{profile?.displayName || 'Sistema'}</p>
                  </div>
                </div>

                <div className="hidden print:block pt-12 text-center">
                  <div className="w-32 h-0.5 bg-gray-200 mx-auto mb-4"></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assinatura / Carimbo</p>
                  <p className="text-[8px] text-gray-400 mt-8">UPRAnimal - Gestão de Produção e Vendas</p>
                </div>
              </div>
              
              <div className="p-6 bg-emerald-600 flex items-center justify-center gap-3 print:hidden">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Comprovativo de Venda Digital</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EggSales;
