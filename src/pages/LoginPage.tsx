import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

const LoginPage = () => {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-dark-surface rounded-2xl shadow-2xl shadow-black/50 border border-dark-border overflow-hidden">
          <div className="p-10 pb-6 text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-8 transform -rotate-6 shadow-xl shadow-primary-600/30">
              <span className="text-3xl font-bold font-display">U</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight mb-2 uppercase">UPR SmartFarm</h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide">Plataforma ERP Agrícola Empresarial</p>
          </div>

          <div className="p-10 pt-4">
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-gray-800 border border-dark-border py-4 px-4 rounded-xl font-bold text-white hover:bg-gray-700 hover:border-gray-600 transition-all active:scale-95 shadow-lg shadow-black/20 uppercase text-xs tracking-widest"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-90" />
              Entrar com Google
            </button>

            <div className="mt-10 pt-8 border-t border-dark-border">
              <p className="text-[10px] text-center text-gray-500 leading-relaxed uppercase tracking-widest font-bold">
                Projetado para UPRAnimal<br />Cabo Verde
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-50">© 2026 UPR SmartFarm ERP. Edição Profissional.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
