import React from 'react';
import { User, AppTab } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  if (!user) return <div className="min-h-screen bg-slate-950 font-sans">{children}</div>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-40 pt-safe-top">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md border-b border-white/5"></div>
        <div className="container mx-auto max-w-lg px-4 py-3 relative flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/10">
                    <i className="fas fa-layer-group text-white text-sm"></i>
                </div>
                <div>
                    <h1 className="font-black text-white text-base tracking-tight leading-none">HİDROLİK</h1>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Takip Sistemi</span>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="text-[10px] font-black text-blue-500 uppercase">{user.role}</p>
                    <p className="text-xs font-bold text-slate-300 leading-none">{user.name}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                     {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user.name[0]}</div>}
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto max-w-lg p-4 relative z-0">
        {children}
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl shadow-black/50 z-50 flex justify-between items-center">
        
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className="fas fa-tasks text-lg mb-0.5"></i>
          {activeTab === 'tasks' && <span className="text-[9px] font-bold animate-in fade-in zoom-in">İşler</span>}
        </button>

        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'calendar' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
           <i className="fas fa-calendar-day text-lg mb-0.5"></i>
           {activeTab === 'calendar' && <span className="text-[9px] font-bold animate-in fade-in zoom-in">Takvim</span>}
        </button>

        {/* Central Action Button (Add) */}
        {user.role === 'AMIR' && (
          <div className="relative -top-8 mx-2">
              <button 
                onClick={() => setActiveTab('add')}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-slate-950 shadow-2xl transition-transform active:scale-95 ${activeTab === 'add' ? 'bg-gradient-to-tr from-orange-500 to-pink-500 text-white rotate-45' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                <i className="fas fa-plus text-2xl"></i>
              </button>
          </div>
        )}
        
        {/* Placeholder for center spacing if not AMIR */}
        {user.role !== 'AMIR' && <div className="w-4"></div>}

        <button 
          onClick={() => setActiveTab('requests')}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'requests' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
           <i className="fas fa-comment-dots text-lg mb-0.5"></i>
           {activeTab === 'requests' && <span className="text-[9px] font-bold animate-in fade-in zoom-in">Talep</span>}
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'profile' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className="fas fa-user-circle text-lg mb-0.5"></i>
           {activeTab === 'profile' && <span className="text-[9px] font-bold animate-in fade-in zoom-in">Profil</span>}
        </button>
      </nav>
    </div>
  );
};

export default Layout;