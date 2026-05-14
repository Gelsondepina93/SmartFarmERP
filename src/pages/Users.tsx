import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Shield, 
  Trash2, 
  Mail, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Search,
  Filter,
  UserCheck,
  UserX,
  BadgeAlert,
  Plus,
  Settings2,
  X,
  RefreshCw
} from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
  const { profile: currentUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const roles: UserRole[] = ['Admin', 'Farm Manager', 'Veterinarian', 'Operator', 'Director'];

  useEffect(() => {
    const q = query(collection(db, 'profiles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      const userRef = doc(db, 'profiles', uid);
      await updateDoc(userRef, { role: newRole });
      setIsEditing(null);
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handlePermissionToggle = async (uid: string, permission: 'canCreate' | 'canEdit' | 'canDelete') => {
    try {
      const user = users.find(u => u.uid === uid);
      if (!user) return;
      
      const currentPermissions = user.permissions || { 
        canCreate: user.role === 'Admin' || user.role === 'Farm Manager',
        canEdit: user.role === 'Admin' || user.role === 'Farm Manager',
        canDelete: user.role === 'Admin'
      };

      const userRef = doc(db, 'profiles', uid);
      await updateDoc(userRef, {
        permissions: {
          ...currentPermissions,
          [permission]: !currentPermissions[permission]
        }
      });
    } catch (error) {
      console.error('Error updating permission:', error);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === currentUserProfile?.uid) {
      alert('Você não pode apagar seu próprio perfil.');
      return;
    }
    
    if (!window.confirm('Tem certeza que deseja remover este utilizador? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setIsDeleting(uid);
      await deleteDoc(doc(db, 'profiles', uid));
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAddUserProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as UserRole;

    try {
      const tempId = `temp_${Date.now()}`;
      await setDoc(doc(db, 'profiles', tempId), {
        uid: tempId,
        email: email.toLowerCase(),
        displayName: name,
        role: role,
        permissions: {
          canCreate: role === 'Admin' || role === 'Farm Manager',
          canEdit: role === 'Admin' || role === 'Farm Manager',
          canDelete: role === 'Admin'
        }
      });
      setIsAddingUser(false);
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Admin': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Director': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Farm Manager': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Veterinarian': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-white/5';
    }
  };

  if (currentUserProfile?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
          <BadgeAlert size={40} />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase tracking-tight">Acesso Restrito</h2>
        <p className="text-gray-500 max-w-md font-medium">Apenas administradores podem gerir os utilizadores do sistema. Contacte o administrador para obter permissões.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">Controle de Utilizadores</h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Gestão de Acessos e Níveis de Permissão</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddingUser(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-500 transition-all shadow-xl shadow-primary-600/20 active:scale-95"
          >
            <UserPlus size={16} /> Registar Utilizador
          </button>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar utilizador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-dark-surface border border-white/5 rounded-2xl text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 transition-all w-full md:w-80"
            />
          </div>
        </div>
      </div>

      <div className="bg-dark-surface rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700"></div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Utilizador</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Email</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Função / Nível</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Permissões (C | E | D)</th>
                <th className="px-8 py-6 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={user.uid} 
                    className="group hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-dark-bg border border-white/5 flex items-center justify-center font-display font-black text-lg text-primary-400 shadow-inner">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white mb-0.5">{user.displayName || 'Utilizador sem nome'}</p>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                            <CheckCircle2 size={10} /> Ativo
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
                        <Mail size={14} className="opacity-50" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {isEditing === user.uid ? (
                        <select 
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                          onBlur={() => setIsEditing(null)}
                          autoFocus
                          className="bg-dark-bg border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary-500 outline-none transition-all"
                        >
                          {roles.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <button 
                          onClick={() => setIsEditing(user.uid)}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 ${getRoleBadgeColor(user.role)}`}
                        >
                          {user.role}
                        </button>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-4">
                        {[
                          { key: 'canCreate' as const, label: 'C' },
                          { key: 'canEdit' as const, label: 'E' },
                          { key: 'canDelete' as const, label: 'D' }
                        ].map((p) => {
                          const hasPerm = user.permissions ? user.permissions[p.key] : (
                            p.key === 'canCreate' ? (user.role === 'Admin' || user.role === 'Farm Manager') :
                            p.key === 'canEdit' ? (user.role === 'Admin' || user.role === 'Farm Manager') :
                            (user.role === 'Admin')
                          );
                          
                          return (
                            <button
                              key={p.key}
                              onClick={() => handlePermissionToggle(user.uid, p.key)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                hasPerm 
                                ? 'bg-primary-500/20 text-primary-500 border border-primary-500/30' 
                                : 'bg-white/5 text-gray-600 border border-white/5 opacity-50'
                              }`}
                              title={`${hasPerm ? 'Remover' : 'Conceder'} permissão de ${p.key}`}
                            >
                              <span className="text-[10px] font-black">{p.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setIsEditing(user.uid)}
                          className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${isEditing === user.uid ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
                        >
                          <Shield size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.uid)}
                          disabled={user.uid === currentUserProfile?.uid || isDeleting === user.uid}
                          className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${
                            user.uid === currentUserProfile?.uid 
                            ? 'bg-white/5 text-gray-700 cursor-not-allowed opacity-30' 
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                          }`}
                        >
                          {isDeleting === user.uid ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><RefreshCw size={16} /></motion.div> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && !loading && (
          <div className="p-20 text-center">
            <UsersIcon size={48} className="text-gray-700 mx-auto mb-4 opacity-20" />
            <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Nenhum utilizador encontrado com este critério.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl flex items-center gap-6 group hover:border-primary-500/30 transition-all">
          <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
             <UserCheck size={28} />
          </div>
          <div>
            <p className="text-2xl font-display font-black text-white">{users.length}</p>
            <p className="text-gray-500 font-bold uppercase text-[9px] tracking-[0.2em]">Total de Utilizadores</p>
          </div>
        </div>

        <div className="bg-dark-surface p-8 rounded-[2rem] border border-white/5 shadow-xl flex items-center gap-6 group hover:border-red-500/30 transition-all">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
             <Shield size={28} />
          </div>
          <div>
            <p className="text-2xl font-display font-black text-white">{users.filter(u => u.role === 'Admin').length}</p>
            <p className="text-gray-500 font-bold uppercase text-[9px] tracking-[0.2em]">Administradores</p>
          </div>
        </div>

        <div className="bg-emerald-600/10 p-8 rounded-[2rem] border border-emerald-500/20 shadow-xl flex items-center gap-6 group hover:bg-emerald-600/20 transition-all">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
             <UserPlus size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-tight">Novo Convidado?</p>
            <p className="text-gray-500 font-bold uppercase text-[9px] tracking-tight mt-1 leading-relaxed">Novos utilizadores são registados após o primeiro login com Google.</p>
          </div>
        </div>
      </div>

      {isAddingUser && (
        <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-dark-surface p-10 rounded-[3rem] border border-white/10 shadow-2xl relative"
          >
            <button 
              onClick={() => setIsAddingUser(false)}
              className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-xl transition-all text-gray-500"
            >
              <X size={20} />
            </button>

            <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mb-2">Novo Utilizador</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mb-8">Pre-registo de credenciais e permissões</p>

            <form onSubmit={handleAddUserProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required
                  name="name"
                  type="text"
                  placeholder="Ex: João Silva"
                  className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold placeholder:text-gray-700 outline-none focus:border-primary-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Profissional</label>
                <input 
                  required
                  name="email"
                  type="email"
                  placeholder="Ex: joao@upr.cv"
                  className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold placeholder:text-gray-700 outline-none focus:border-primary-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Função de Acesso</label>
                <select 
                  name="role"
                  className="w-full px-6 py-4 bg-dark-bg border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-primary-500/50 transition-all uppercase text-[10px] tracking-widest"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit"
                className="w-full h-16 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary-600/20 hover:bg-primary-500 transition-all active:scale-95"
              >
                Concluir Registo
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Users;
