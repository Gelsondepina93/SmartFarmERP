import React from 'react';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, PieChart, TrendingUp, Filter, Download, Egg, Milk, Zap, History, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Financials = () => {
  const data = [
    { name: 'Jan', revenue: 45000, costs: 32000, profit: 13000 },
    { name: 'Fev', revenue: 52000, costs: 34000, profit: 18000 },
    { name: 'Mar', revenue: 48000, costs: 31000, profit: 17000 },
    { name: 'Abr', revenue: 61000, costs: 38000, profit: 23000 },
    { name: 'Mai', revenue: 58000, costs: 35000, profit: 23000 },
  ];

  const erpMetrics = [
    { label: 'Custo por Ovo', value: '0.082 CVE', sub: 'Meta: 0.075 CVE', icon: Egg, color: 'text-amber-500' },
    { label: 'Custo por Litro', value: '0.421 CVE', sub: 'Meta: 0.400 CVE', icon: Milk, color: 'text-blue-500' },
    { label: 'Custo Ração Médio', value: '1.12 CVE/kg', sub: 'Consolidação Silos', icon: Zap, color: 'text-emerald-500' },
    { label: 'ROI Operacional', value: '42.5%', sub: 'vs 38% Trimestral', icon: TrendingUp, color: 'text-primary-400' },
  ];

  const transactions = [
    { id: 1, date: '2026-05-10', desc: 'Venda de Ovos - Pedido em Massa', type: 'revenue', amount: 4500, category: 'Ovos' },
    { id: 2, date: '2026-05-09', desc: 'Compra de Ração - Reabastecimento Silo Alpha', type: 'cost', amount: 1200, category: 'Ração' },
    { id: 3, date: '2026-05-08', desc: 'Venda de Leite - Entrega Diária', type: 'revenue', amount: 820, category: 'Leite' },
    { id: 4, date: '2026-05-07', desc: 'Honorários Veterinários - Exame do Rebanho', type: 'cost', amount: 350, category: 'Veterinária' },
  ];

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
            <DollarSign size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Dashboard Financeiro</h1>
            <p className="text-gray-400 text-sm font-medium">Análise de ROI e Custos de Produção UPRAnimal</p>
          </div>
        </div>
        
        <button className="flex items-center gap-2 bg-dark-surface border border-white/5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 hover:bg-white/5 transition-all shadow-xl">
          <Download size={16} />
          Exportar Relatório Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {erpMetrics.map((m) => (
          <div key={m.label} className="bg-dark-surface p-5 rounded-3xl border border-white/5 shadow-xl group hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-3 text-gray-400">
              <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
              <m.icon size={14} className={m.color} />
            </div>
            <p className="text-2xl font-display font-bold text-white mb-1">{m.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-surface p-7 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <ArrowUpCircle size={120} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Faturação Total</p>
          <p className="text-4xl font-display font-bold text-white tracking-tight leading-none mb-2">264,000 CVE</p>
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-black uppercase tracking-widest">
            <TrendingUp size={14} /> +14.2% <span className="text-gray-400">vs Trim. Ant.</span>
          </div>
        </div>

        <div className="bg-dark-surface p-7 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform text-red-500">
            <ArrowDownCircle size={120} />
          </div>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">OPEX Consolidados</p>
          <p className="text-4xl font-display font-bold text-white tracking-tight leading-none mb-2">170,000 CVE</p>
          <div className="flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-widest">
            <TrendingDown size={14} /> +8.1% <span className="text-gray-400">Inflação Ração</span>
          </div>
        </div>

        <div className="bg-primary-600 p-8 rounded-[2.5rem] shadow-2xl shadow-primary-500/20 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <DollarSign size={150} />
          </div>
          <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em] mb-4">EBIDTA Líquido</p>
          <p className="text-5xl font-display font-bold text-white tracking-tight leading-none mb-3">94,000 CVE</p>
          <div className="pt-6 mt-4 border-t border-white/10 flex justify-between items-center">
            <div>
               <p className="text-[10px] font-black uppercase opacity-60">Margem Operacional</p>
               <p className="text-xl font-bold">35.6%</p>
            </div>
            <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Ideal</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-bg/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-10">
             <div>
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Análise de Fluxo</h3>
               <h4 className="text-lg font-bold text-white">Receita vs Custos</h4>
             </div>
             <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
               <div className="flex items-center gap-2 text-emerald-500"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Receita</div>
               <div className="flex items-center gap-2 text-red-500"><div className="w-2 h-2 rounded-full bg-red-400"></div> Custos</div>
             </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 800}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 800}} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#0F1115', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 1)'}}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
                <Bar dataKey="costs" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-dark-surface p-8 rounded-[3rem] border border-white/5 shadow-2xl">
           <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Lançamentos Recentes</h3>
            <History size={16} className="text-gray-400" />
          </div>
          <div className="space-y-4">
            {transactions.map(t => (
              <div key={t.id} className="p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group group-hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${
                    t.type === 'revenue' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {t.type === 'revenue' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                  </div>
                  <p className={`font-display text-sm font-black ${t.type === 'revenue' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {t.type === 'revenue' ? '+' : '-'}{t.amount.toLocaleString()} CVE
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white mb-1">{t.desc}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.category}</p>
                    <p className="text-[10px] font-bold text-gray-500">{t.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-all">Ver Histórico Completo</button>
        </div>
      </div>
    </div>
  );
};

export default Financials;
