import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import AppLayout from './AppLayout';
import Dashboard from './pages/Dashboard';

import Poultry from './pages/Poultry';
import FeedManagement from './pages/FeedManagement';
import Ruminants from './pages/Ruminants';
import Financials from './pages/Financials';
import Inventory from './pages/Inventory';
import Health from './pages/Health';
import Settings from './pages/Settings';
import Users from './pages/Users';
import EggSales from './pages/EggSales';

// Placeholder for other pages
const Placeholder = ({ name }: { name: string }) => (
  <div className="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
    <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">{name} Module</h2>
    <p className="text-slate-500 italic">This module is under development for UPRAnimal professional ERP requirements.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AuthGuard>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="poultry" element={<Poultry />} />
              <Route path="ruminants" element={<Ruminants />} />
              <Route path="feed" element={<FeedManagement />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="health" element={<Health />} />
              <Route path="financials" element={<Financials />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<Users />} />
              <Route path="egg-sales" element={<EggSales />} />
            </Route>
          </Routes>
        </AuthGuard>
      </HashRouter>
    </AuthProvider>
  );
}
