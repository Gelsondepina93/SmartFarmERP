import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Egg, 
  Milk, 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  Calendar,
  CloudOff,
  RefreshCw,
  Zap,
  TrendingDown,
  BarChart3,
  Search,
  Database
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart,
  Line
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { collection, query, onSnapshot, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EggProduction, Silo, ChickenLot, FeedConsumption } from '../types';
import { getPendingCount, syncNow } from '../lib/offlineService';

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Real Data State
  const [todayEggs, setTodayEggs] = useState(0);
  const [todayFeed, setTodayFeed] = useState(0);
  const [totalSiloStock, setTotalSiloStock] = useState(0);
  const [siloData, setSiloData] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<FeedConsumption[]>([]);
  const [efficiencyRanking, setEfficiencyRanking] = useState<any[]>([]);
  const [productionTrend, setProductionTrend] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOffline = async () => {
      const count = await getPendingCount();
      setOfflineCount(count);
    };
    checkOffline();
    const interval = setInterval(checkOffline, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 1. Fetch Today's Eggs
    const startOfToday = startOfDay(new Date(selectedDate)).toISOString();
    const endOfToday = endOfDay(new Date(selectedDate)).toISOString();
    
    const eggsQ = query(
      collection(db, 'egg_productions'),
      where('date', '>=', startOfToday),
      where('date', '<=', endOfToday)
    );

    const feedQ = query(
      collection(db, 'feed_consumptions'),
      where('date', '>=', startOfToday),
      where('date', '<=', endOfToday)
    );

    const unsubscribeEggs = onSnapshot(eggsQ, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().total_eggs || 0), 0);
      setTodayEggs(total);
    });

    const unsubscribeFeed = onSnapshot(feedQ, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 0), 0);
      setTodayFeed(total);
    });

    const unsubscribeAllCons = onSnapshot(collection(db, 'feed_consumptions'), (snapshot) => {
      setConsumptions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeedConsumption)));
    });

    // 2. Fetch Silos
    const unsubscribeSilos = onSnapshot(collection(db, 'silos'), (snapshot) => {
      setSilos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Silo)));
      setTotalSiloStock(snapshot.docs.reduce((sum, doc) => sum + (doc.data().current_stock || 0), 0));
    });

    // 3. Efficiency Ranking (Layers)
    const lotsQ = query(collection(db, 'chicken_lots'), where('status', '==', 'active'), where('type', '==', 'layer'));
    const unsubscribeLots = onSnapshot(lotsQ, async (snapshot) => {
      const rankings = await Promise.all(snapshot.docs.map(async (lotDoc) => {
        const lotData = lotDoc.data() as ChickenLot;
        const prodQ = query(
          collection(db, 'egg_productions'),
          where('lot_id', '==', lotDoc.id),
          orderBy('date', 'desc'),
          limit(1)
        );
        const prodSnap = await getDocs(prodQ);
        const latestHdep = prodSnap.docs.length > 0 ? (prodSnap.docs[0].data().hdep || 0) : 0;
        const latestEggs = prodSnap.docs.length > 0 ? (prodSnap.docs[0].data().total_eggs || 0) : 0;
        
        return {
          id: lotDoc.id,
          lot: lotData.lot_name,
          efficiency: `${latestHdep}%`,
          status: latestHdep > 90 ? 'optimal' : latestHdep > 75 ? 'good' : 'warning',
          eggs: latestEggs
        };
      }));
      setEfficiencyRanking(rankings.sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency)));
    });

    // 4. Production Trend (Last 7 days)
    const last7DaysData = async () => {
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(selectedDate), i);
        const dayStart = startOfDay(d).toISOString();
        const dayEnd = endOfDay(d).toISOString();
        
        const eggsQ = query(
          collection(db, 'egg_productions'),
          where('date', '>=', dayStart),
          where('date', '<=', dayEnd)
        );
        
        const feedQ = query(
          collection(db, 'feed_consumptions'),
          where('date', '>=', dayStart),
          where('date', '<=', dayEnd)
        );

        const [eggsSnap, feedSnap] = await Promise.all([
          getDocs(eggsQ),
          getDocs(feedQ)
        ]);

        const eggsTotal = eggsSnap.docs.reduce((sum, d) => sum + (d.data().total_eggs || 0), 0);
        const feedTotal = feedSnap.docs.reduce((sum, d) => sum + (d.data().quantity || 0), 0);
        
        trend.push({
          day: format(d, 'EEE'),
          eggs: eggsTotal,
          milk: 1100 + (Math.random() * 200 - 100), // Mocking milk for now since it's poultry focus
          feed: feedTotal
        });
      }
      setProductionTrend(trend);
    };
    last7DaysData();

    setIsLoading(false);

    return () => {
      unsubscribeEggs();
      unsubscribeFeed();
      unsubscribeAllCons();
      unsubscribeSilos();
      unsubscribeLots();
    };
  }, [selectedDate]);

  const [silos, setSilos] = useState<Silo[]>([]);

  useEffect(() => {
    const updatedSiloData = silos.map(silo => {
      const stockPerc = (silo.current_stock / silo.capacity_kg) * 100;
      
      // Forecasting logic
      const siloCons = consumptions.filter(c => c.silo_id === silo.id);
      const totalCons = siloCons.reduce((acc, curr) => acc + curr.quantity, 0);
      const daysWithConsumption = new Set(siloCons.map(c => c.date?.split('T')[0])).size || 1;
      const avg = totalCons / daysWithConsumption;
      const remaining = avg > 0 ? Math.floor(silo.current_stock / avg) : 0;

      return {
        id: silo.id,
        name: silo.name,
        stock: Math.round(stockPerc),
        days: remaining,
        fill: stockPerc < 20 ? '#ef4444' : stockPerc < 40 ? '#fbbf24' : '#10b981'
      };
    });
    setSiloData(updatedSiloData);
  }, [silos, consumptions]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const navigateToReports = () => {
    setShowReport(true);
  };

  const kpis = [
    { title: 'Ovos Hoje', value: todayEggs.toLocaleString(), trend: '+12%', icon: Egg, color: 'emerald' },
    { title: 'Leite Hoje', value: '1,120 L', trend: '-2.4%', icon: Milk, color: 'blue' },
    { title: 'Consumo Ração', value: `${todayFeed} kg`, trend: '+5%', icon: Zap, color: 'amber' },
    { title: 'Estoque Total', value: `${(totalSiloStock / 1000).toFixed(1)} t`, trend: '-0.8%', icon: Package, color: 'orange' },
    { title: 'Lucro Hoje', value: '4,120 CVE', trend: '+18%', icon: TrendingUp, color: 'primary' },
  ];

  const worstPerformance = [
    { lot: 'Rebanho Norte', issue: 'Conversão Alimentar Baixa', value: '-12%', color: 'text-red-400' },
    { lot: 'Silo B Suprimentos', issue: 'Desperdício Estimado', value: '+4.2%', color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight uppercase">Inteligência Operacional</h1>
          <p className="text-gray-400 text-sm font-medium tracking-wide">Relatórios em tempo real vs Metas Excel UPRAnimal</p>
        </div>
        
        <div className="flex items-center gap-3">
          {offlineCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 text-xs font-bold animate-pulse">
              <CloudOff size={14} />
              {offlineCount} Sincronizações Pendentes
            </div>
          )}
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-dark-bg border border-white/5 rounded-xl text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 uppercase tracking-widest"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            Sincronizar
          </button>
          <div className="relative group">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary-600/20">
              <Calendar size={14} />
              {format(new Date(selectedDate), 'dd MMM yyyy').toUpperCase()}
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-dark-surface p-5 rounded-2xl border border-white/5 shadow-xl group hover:border-white/10 transition-all"
          >
            <div className="flex items-center justify-between mb-3 text-gray-400 group-hover:text-gray-300 transition-colors">
              <div className="text-[10px] uppercase font-black tracking-[0.2em]">{kpi.title}</div>
              <kpi.icon size={16} />
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-display font-bold text-white tracking-tight">{kpi.value}</div>
              <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg ${
                kpi.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
              }`}>
                {kpi.trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {kpi.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Production Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
              <TrendingUp size={200} />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Tendência de Performance</h2>
                <h3 className="text-lg font-bold text-white font-display">Produção Consolidada</h3>
              </div>
              <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2 text-emerald-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Ovos</div>
                <div className="flex items-center gap-2 text-blue-500"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Leite</div>
                <div className="flex items-center gap-2 text-amber-500"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Ração</div>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={productionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 800}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 800}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#0F1115', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'}}
                    itemStyle={{fontWeight: 800, fontSize: '10px', textTransform: 'uppercase'}}
                  />
                  <Area type="monotone" dataKey="eggs" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#gradEmerald)" />
                  <Area type="monotone" dataKey="milk" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#gradBlue)" />
                  <Area type="monotone" dataKey="feed" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#gradAmber)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Ranking de Produção</h3>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="space-y-5">
                {efficiencyRanking.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-dark-bg border border-white/5 flex items-center justify-center font-display font-black text-xs text-gray-400 group-hover:bg-primary-500 group-hover:text-white transition-all">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white mb-0.5">{item.lot}</p>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{item.eggs} Ovos/Dia</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-display font-black text-white">{item.efficiency}</p>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Eficiência</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Alerta de Ineficiência</h3>
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <div className="space-y-6">
                {worstPerformance.map((item) => (
                  <div key={item.lot} className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 hover:bg-red-500/10 transition-all cursor-crosshair">
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-xs font-black text-white uppercase tracking-tight">{item.lot}</p>
                       <span className={`text-sm font-display font-black ${item.color}`}>{item.value}</span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                      Causa Provável: {item.issue}. Verificar parâmetros do Silo e Climatização.
                    </p>
                  </div>
                ))}
                <button className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Abrir Diagnóstico Completo</button>
              </div>
            </div>
          </div>
        </div>

        {/* Silos & Alerts */}
        <div className="space-y-6">
          <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Status de Armazenamento</h2>
                <h3 className="text-sm font-bold text-white">Níveis de Silo</h3>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                <Package size={18} />
              </div>
            </div>
            
            <div className="space-y-8">
              {siloData.map((silo) => (
                <div key={silo.id}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">{silo.name}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${silo.days <= 3 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                        Previsão UPR — {silo.days} Dias
                      </p>
                    </div>
                    <span className="text-sm font-black text-white">{silo.stock}%</span>
                  </div>
                  <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${silo.stock}%` }}
                      className="h-full shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                      style={{ backgroundColor: silo.fill }}
                    ></motion.div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="mt-1 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 animate-bounce">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Ação Crítica Necessária</p>
                  <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                    Silo C (Ruminantes) atingiu nível crítico. Automação UPRAnimal sugere pedido de 5000kg imediato.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary-600 p-8 rounded-3xl shadow-xl shadow-primary-600/20 text-white relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <TrendingUp size={160} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">Meta Mensal UPR</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-display font-bold">84%</span>
              <TrendingUp size={24} />
            </div>
            <p className="text-xs font-bold text-white/80 leading-relaxed uppercase tracking-widest">Performance Global Acima da Média (Excel Ref. A-12)</p>
            <button 
              onClick={navigateToReports}
              className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
            >
              Ver Relatório Detalhado
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {showReport && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-surface w-full max-w-4xl max-h-[80vh] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-display font-bold text-white uppercase tracking-tight">Relatório Detalhado</h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Inteligência de Negócio UPRAnimal</p>
                </div>
                <button onClick={() => setShowReport(false)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-gray-400">
                  <RefreshCw size={24} className="rotate-45" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Margem de Contribuição</p>
                    <p className="text-2xl font-display font-bold text-white">42.8%</p>
                  </div>
                  <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">FCR (Conversão)</p>
                    <p className="text-2xl font-display font-bold text-white">1.62</p>
                  </div>
                  <div className="bg-amber-500/5 p-6 rounded-3xl border border-amber-500/10">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Adesão Meta Mensal</p>
                    <p className="text-2xl font-display font-bold text-white">98.2%</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest px-2">Performance por Unidade</h3>
                  {[
                    { unit: 'Aviário A (Poedeiras)', status: 'Excelente', value: '+4.2% vs Meta', color: 'text-emerald-500' },
                    { unit: 'Aviário B (Broiler)', status: 'Alerta', value: '-1.5% vs Meta', color: 'text-amber-500' },
                    { unit: 'Pecuária Ruminantes', status: 'Estável', value: '+0.8% vs Meta', color: 'text-blue-500' },
                  ].map((row) => (
                    <div key={row.unit} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-sm font-bold text-white">{row.unit}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{row.status}</p>
                      </div>
                      <span className={`text-xs font-black uppercase tracking-tight ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-8 bg-dark-bg border-t border-white/5 flex gap-4">
                <button className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-600/20">Descarregar PDF (Excel)</button>
                <button onClick={() => setShowReport(false)} className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5">Fechar Analítico</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
