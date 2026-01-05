
import React from 'react';
import { User, AppTab } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

// Resim URL'si (App.tsx ile aynı veya props olarak geçilebilir, şimdilik sabit)
const GROUP_IMAGE_URL = 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png';

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  if (!user) return <div className="min-h-screen bg-slate-900">{children}</div>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-50 transition-all">
        <div className="container mx-auto max-w-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 border border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <i className="fas fa-cogs text-white text-lg drop-shadow-md"></i>
            </div>
            <div className="leading-tight">
                <h1 className="font-black text-slate-100 tracking-tight text-lg">HİDROLİK</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Birim Takip</p>
            </div>
            </div>
            <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-500 font-bold uppercase">{user.role === 'AMIR' ? 'YÖNETİCİ' : 'TEKNİK PERSONEL'}</p>
                <p className="text-xs font-bold text-slate-200">{user.name}</p>
            </div>
            <button onClick={onLogout} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center border border-slate-700">
                <i className="fas fa-power-off text-sm"></i>
            </button>
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-lg">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center p-2 pb-6 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-50">
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${activeTab === 'tasks' ? 'text-blue-500 -translate-y-1' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className={`fas fa-list-check text-xl ${activeTab === 'tasks' ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}></i>
          <span className="text-[9px] font-bold">Görevler</span>
        </button>

        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${activeTab === 'calendar' ? 'text-purple-500 -translate-y-1' : 'text-slate-500 hover:text-slate-300'}`}
        >
           <i className={`fas fa-calendar-alt text-xl ${activeTab === 'calendar' ? 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : ''}`}></i>
           <span className="text-[9px] font-bold">Takvim</span>
        </button>

        {user.role === 'AMIR' && (
          <button 
            onClick={() => setActiveTab('add')}
            className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-transform active:scale-95 ${activeTab === 'add' ? '-translate-y-6 scale-110' : '-translate-y-4'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-xl shadow-blue-900/50 group-hover:shadow-blue-600/50 transition-shadow"></div>
            <i className="fas fa-plus text-xl text-white relative z-10"></i>
          </button>
        )}

        <button 
          onClick={() => setActiveTab('requests')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${activeTab === 'requests' ? 'text-orange-500 -translate-y-1' : 'text-slate-500 hover:text-slate-300'}`}
        >
           <i className={`fas fa-envelope-open-text text-xl ${activeTab === 'requests' ? 'drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]' : ''}`}></i>
           <span className="text-[9px] font-bold">Talepler</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${activeTab === 'profile' ? 'text-blue-500 -translate-y-1' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className={`fas fa-user-cog text-xl ${activeTab === 'profile' ? 'drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}></i>
           <span className="text-[9px] font-bold">Profil</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
