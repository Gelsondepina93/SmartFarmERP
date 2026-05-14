import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, AlertTriangle, CheckCircle2, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { clearOfflineData } from '../lib/offlineService';

const Settings = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectionsToClear = [
    'farms',
    'locations',
    'chicken_lots',
    'egg_productions',
    'weight_records',
    'animals',
    'animal_weights',
    'reproductions',
    'lactation_cycles',
    'milk_productions',
    'feeds',
    'silos',
    'stock_movements',
    'feed_consumptions',
    'inventories',
    'health_records',
    'vaccinations',
    'costs',
    'sales'
  ];

  const resetDatabase = async () => {
    if (!window.confirm('TEM CERTEZA? Esta ação irá apagar TODOS os registros de produção, animais, silos e histórico financeiro. Esta ação não pode ser desfeita.')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(false);

    try {
      for (const collectionName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        if (querySnapshot.empty) continue;

        const batch = writeBatch(db);
        querySnapshot.docs.forEach((document) => {
          batch.delete(doc(db, collectionName, document.id));
        });
        await batch.commit();
      }
      
      await clearOfflineData();
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error resetting database:', err);
      setError('Ocorreu um erro ao tentar zerar a base de dados. Por favor, verifique sua conexão.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">Configurações</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Gerenciamento do Sistema ERP</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Danger Zone */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/5 rounded-[2.5rem] border border-red-500/20 p-10 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <AlertTriangle size={120} className="text-red-500" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-2xl text-red-500">
                <Trash2 size={24} />
              </div>
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Zona de Perigo</h2>
            </div>
            
            <p className="text-gray-400 font-medium max-w-xl mb-10 leading-relaxed">
              Utilize esta opção somente se desejar limpar todos os dados de teste e começar uma operação real. 
              Isso apagará permanentemente todos os lotes, animais, produções, estoques e transações financeiras.
            </p>

            <button
              onClick={resetDatabase}
              disabled={isDeleting}
              className={`
                group relative px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all
                ${isDeleting 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20 active:scale-95'}
              `}
            >
              <span className="flex items-center gap-3">
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Apagando dados...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Zerar Base de Dados
                  </>
                )}
              </span>
            </button>

            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-6 flex items-center gap-3 text-emerald-500 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20"
              >
                <CheckCircle2 size={18} />
                Base de dados zerada com sucesso!
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-6 flex items-center gap-3 text-red-400 font-bold text-xs uppercase tracking-widest bg-red-500/10 p-4 rounded-xl border border-red-500/20"
              >
                <AlertTriangle size={18} />
                {error}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Info Box */}
        <div className="bg-dark-surface p-10 rounded-[2.5rem] border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary-500/20 rounded-2xl text-primary-400">
               <SettingsIcon size={24} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Manutenção</h2>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            O sistema UPRAnimal está pronto para operações reais. Recomenda-se zerar a base caso existam lotes 
            de teste com datas inconsistentes ou produções simuladas que afetem os indicadores de desempenho (KPIs).
          </p>
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
               <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Versão do Sistema</p>
               <p className="text-white font-bold">1.0.5-PRO</p>
             </div>
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
               <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">Ambiente</p>
               <p className="text-primary-400 font-bold uppercase tracking-tighter">Produção Pronta</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
