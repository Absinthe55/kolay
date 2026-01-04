
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
  if (!user) return <div className="min-h-screen bg-white">{children}</div>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20">
      <header className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <i className="fas fa-tools text-blue-400 text-xl"></i>
          <h1 className="font-bold text-lg tracking-tight">HİDROLİK SİSTEM</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400">{user.role === 'AMIR' ? 'Birim Amiri' : 'Usta'}</p>
            <p className="text-sm font-semibold">{user.name}</p>
          </div>
          <button onClick={onLogout} className="text-slate-300 hover:text-white transition-colors">
            <i className="fas fa-sign-out-alt text-lg"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden container mx-auto px-4 py-6 max-w-lg">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'tasks' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <i className="fas fa-list-check text-xl"></i>
          <span className="text-[10px] mt-1 font-medium">Görevler</span>
        </button>

        {user.role === 'AMIR' && (
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'add' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center -mt-8 shadow-lg border-4 border-white">
              <i className="fas fa-plus"></i>
            </div>
            <span className="text-[10px] mt-1 font-medium">Yeni Görev</span>
          </button>
        )}

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <i className="fas fa-user-gear text-xl"></i>
          <span className="text-[10px] mt-1 font-medium">Ayarlar</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
