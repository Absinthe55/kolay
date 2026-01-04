
import React from 'react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: 'tasks' | 'add' | 'profile';
  setActiveTab: (tab: 'tasks' | 'add' | 'profile') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  if (!user) return <div className="min-h-screen bg-slate-900">{children}</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 sticky top-0 z-50 transition-all">
        <div className="container mx-auto max-w-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <i className="fas fa-oil-can text-lg"></i>
            </div>
            <div className="leading-tight">
                <h1 className="font-black text-slate-800 tracking-tight text-lg">HİDROGÖREV</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bakım Birimi</p>
            </div>
            </div>
            <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{user.role === 'AMIR' ? 'YÖNETİCİ' : 'TEKNİK PERSONEL'}</p>
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
            </div>
            <button onClick={onLogout} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center">
                <i className="fas fa-power-off text-sm"></i>
            </button>
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-lg">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center p-3 pb-6 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-50">
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'tasks' ? 'text-blue-600 -translate-y-1' : 'text-slate-300 hover:text-slate-500'}`}
        >
          <i className={`fas fa-list-check text-2xl ${activeTab === 'tasks' ? 'drop-shadow-lg' : ''}`}></i>
          <span className={`text-[10px] font-bold ${activeTab === 'tasks' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Görevler</span>
        </button>

        {user.role === 'AMIR' && (
          <button 
            onClick={() => setActiveTab('add')}
            className={`group relative flex flex-col items-center justify-center w-16 h-16 rounded-full transition-transform active:scale-95 ${activeTab === 'add' ? '-translate-y-6 scale-110' : '-translate-y-4'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-xl shadow-blue-300 group-hover:shadow-blue-400 transition-shadow"></div>
            <i className="fas fa-plus text-2xl text-white relative z-10"></i>
          </button>
        )}

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'profile' ? 'text-blue-600 -translate-y-1' : 'text-slate-300 hover:text-slate-500'}`}
        >
          <i className={`fas fa-user-cog text-2xl ${activeTab === 'profile' ? 'drop-shadow-lg' : ''}`}></i>
           <span className={`text-[10px] font-bold ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>Profil</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
