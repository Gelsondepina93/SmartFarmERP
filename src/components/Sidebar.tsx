import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Bird, Trees as Cow, Wheat, Package, DollarSign, LogOut, Settings, Bell, Menu, X, Landmark, Activity, HeartPulse, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['Admin', 'Farm Manager', 'Director', 'Veterinarian', 'Operator'] },
    { name: 'Avicultura', icon: Bird, path: '/poultry', roles: ['Admin', 'Farm Manager', 'Operator'] },
    { name: 'Venda de Ovos', icon: DollarSign, path: '/egg-sales', roles: ['Admin', 'Farm Manager', 'Operator'] },
    { name: 'Ruminantes', icon: Cow, path: '/ruminants', roles: ['Admin', 'Farm Manager', 'Veterinarian', 'Operator'] },
    { name: 'Alimentos e Silos', icon: Wheat, path: '/feed', roles: ['Admin', 'Farm Manager', 'Operator'] },
    { name: 'Inventário', icon: Package, path: '/inventory', roles: ['Admin', 'Farm Manager'] },
    { name: 'Saúde e Veterinária', icon: HeartPulse, path: '/health', roles: ['Admin', 'Farm Manager', 'Veterinarian'] },
    { name: 'Financeiro', icon: Landmark, path: '/financials', roles: ['Admin', 'Director', 'Farm Manager'] },
    { name: 'Utilizadores', icon: Users, path: '/users', roles: ['Admin'] },
    { name: 'Configurações', icon: Settings, path: '/settings', roles: ['Admin', 'Farm Manager'] },
  ];

  const filteredItems = menuItems.filter(item => 
    profile?.role && item.roles.includes(profile.role)
  );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-dark-surface border-r border-dark-border transition-all duration-300",
        isOpen ? "w-64 translate-x-0" : "w-16 -translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between h-16 px-6 bg-dark-bg">
          {(isOpen || window.innerWidth < 1024) && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className={cn("flex items-center gap-3", !isOpen && "hidden lg:hidden")}
            >
              <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center font-bold text-white">UPR</div>
              <span className="text-lg font-semibold tracking-tight text-white">SmartFarm<span className="text-primary-500 underline underline-offset-4 decoration-2">ERP</span></span>
            </motion.div>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded-md text-gray-400 hover:bg-white/5 transition-colors">
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group text-sm font-medium",
                  isActive 
                    ? "bg-primary-600/10 text-primary-400" 
                    : "text-gray-300 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-primary-400" : "text-gray-400 group-hover:text-white")} />
                {isOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-dark-border bg-dark-bg">
          {isOpen && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Status do Sistema: Online</span>
              </div>
              <div className="text-xs text-gray-400/80">Sincronização Ativa • Baixa Latência</div>
            </div>
          )}
          <button 
            onClick={logout}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-gray-400 transition-colors",
              !isOpen && "justify-center"
            )}
          >
            <LogOut size={20} />
            {isOpen && <span className="font-medium text-sm">Sair</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
