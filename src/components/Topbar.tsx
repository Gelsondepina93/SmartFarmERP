import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Search, User, Menu } from 'lucide-react';

interface TopbarProps {
  onMenuClick: () => void;
}

const Topbar = ({ onMenuClick }: TopbarProps) => {
  const { profile } = useAuth();

  const roleMap: Record<string, string> = {
    'Admin': 'Administrador',
    'Farm Manager': 'Gerente da Fazenda',
    'Director': 'Diretor',
    'Veterinarian': 'Veterinário',
    'Operator': 'Operador'
  };

  return (
    <header className="h-16 border-b border-dark-border px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 bg-dark-bg/80 backdrop-blur-md">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors lg:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold text-white hidden md:block">Visão Executiva</h1>
        <h1 className="text-lg font-bold text-white md:hidden">UPR SmartFarm</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-red-500/20">
          <span className="animate-pulse">●</span> 3 ALERTAS CRÍTICOS
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm text-white font-medium">{profile?.displayName}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{profile?.role ? (roleMap[profile.role] || profile.role) : ''}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-dark-surface border border-white/10 flex items-center justify-center text-gray-400 overflow-hidden">
            {profile?.displayName?.charAt(0) || <User size={20} />}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
