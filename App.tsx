
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, TaskStatus, TaskPriority } from './types';
import { fetchTasks, saveTasks } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile'>('tasks');
  const [loginInput, setLoginInput] = useState('');
  
  // Form State for Adding Task
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  const masters = ['Usta Ahmet', 'Usta Mehmet', 'Usta Can', 'Usta Serkan'];

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasks();
      setTasks(data);
      setSyncError(false);
    } catch (err) {
      setSyncError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleLogin = (role: 'AMIR' | 'USTA') => {
    if (!loginInput.trim()) return alert("Lütfen isminizi girin.");
    setCurrentUser({
      id: Math.random().toString(36).substr(2, 9),
      name: loginInput,
      role
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskMachine || !newTaskDescription || !newTaskMaster) return alert("Lütfen tüm alanları doldurun.");

    try {
      const newTask: Task = {
        id: Date.now().toString(),
        machineName: newTaskMachine,
        masterName: newTaskMaster,
        description: newTaskDescription,
        status: TaskStatus.PENDING,
        priority: newTaskPriority,
        createdAt: Date.now(),
      };

      const updatedTasks = [newTask, ...tasks];
      setTasks(updatedTasks);
      const success = await saveTasks(updatedTasks);
      
      if (!success) {
        alert("Bulut senkronizasyonu başarısız oldu, ancak görev yerel olarak eklendi.");
      }
      
      // Reset Form
      setNewTaskMachine('');
      setNewTaskDescription('');
      setNewTaskMaster('');
      setNewTaskPriority(TaskPriority.MEDIUM);
      setActiveTab('tasks');
    } catch (err) {
      alert("Görev oluşturulurken bir hata oluştu.");
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, comment?: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { 
          ...t, 
          status: newStatus, 
          comments: comment || t.comments,
          completedAt: newStatus === TaskStatus.COMPLETED ? Date.now() : t.completedAt
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-blue-600 p-5 rounded-3xl shadow-2xl shadow-blue-900/40 mb-6">
              <i className="fas fa-oil-can text-5xl"></i>
            </div>
            <h1 className="text-3xl font-bold tracking-tighter">HidroGörev</h1>
            <p className="text-slate-400 mt-2 text-center text-sm font-medium">Birim içi görev paylaşım ve takip platformu</p>
          </div>

          <div className="space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Kullanıcı Adı</label>
              <input 
                type="text" 
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button 
                onClick={() => handleLogin('AMIR')}
                className="bg-white text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-slate-100 transition-all flex flex-col items-center gap-1 active:scale-95"
              >
                <i className="fas fa-user-shield text-xl mb-1"></i>
                Amir Girişi
              </button>
              <button 
                onClick={() => handleLogin('USTA')}
                className="bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-all flex flex-col items-center gap-1 active:scale-95 shadow-lg shadow-blue-900/20"
              >
                <i className="fas fa-wrench text-xl mb-1"></i>
                Usta Girişi
              </button>
            </div>
          </div>
          
          <p className="text-slate-500 text-[10px] text-center mt-8 uppercase tracking-widest font-bold">
            Hidrolik Birimi Dijital Dönüşüm Sistemi v1.0
          </p>
        </div>
      </div>
    );
  }

  const filteredTasks = currentUser.role === 'USTA' 
    ? tasks.filter(t => t.masterName === currentUser.name || t.masterName === 'Genel')
    : tasks;

  return (
    <Layout 
      user={currentUser} 
      onLogout={() => setCurrentUser(null)} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
    >
      {activeTab === 'tasks' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Görevler</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-semibold">{filteredTasks.length} toplam görev</p>
                {syncError && (
                  <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    SENKRONİZASYON HATASI
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={refreshData} 
              disabled={loading}
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors shadow-sm"
            >
              <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <i className="fas fa-clipboard-check text-5xl mb-4 opacity-20"></i>
              <p className="text-sm font-medium">Şu an aktif görev bulunmuyor.</p>
              {currentUser.role === 'AMIR' && (
                <button 
                  onClick={() => setActiveTab('add')}
                  className="mt-4 text-blue-600 font-bold text-sm"
                >
                  + İlk Görevi Ata
                </button>
              )}
            </div>
          ) : (
            <div>
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  user={currentUser} 
                  onUpdateStatus={updateTaskStatus} 
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Yeni Görev Atama</h2>
          
          <form onSubmit={handleCreateTask} className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Makine / Ekipman</label>
              <input 
                type="text" 
                placeholder="Örn: 2000 Tonluk Pres"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                value={newTaskMachine}
                onChange={(e) => setNewTaskMachine(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Usta Seçimi</label>
              <select 
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 appearance-none"
                value={newTaskMaster}
                onChange={(e) => setNewTaskMaster(e.target.value)}
              >
                <option value="">Usta Seçin...</option>
                {masters.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Öncelik</label>
              <select 
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
              >
                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Görev Açıklaması / Talimatlar</label>
              <textarea 
                placeholder="Örn: Ana piston valfinde yağ sızıntısı var. Lütfen keçeleri değiştirin ve basınç testi yapın."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                rows={6}
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="w-full py-4 rounded-xl font-bold text-white shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 bg-blue-600"
            >
              <i className="fas fa-paper-plane"></i>
              GÖREVİ OLUŞTUR VE GÖNDER
            </button>
          </form>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Ayarlar</h2>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="p-6 flex items-center gap-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg">{currentUser.name}</h3>
                <p className="text-sm text-slate-500">{currentUser.role === 'AMIR' ? 'Hidrolik Birim Amiri' : 'Usta - Bakım Ekibi'}</p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600 font-medium">Birim</span>
                <span className="text-sm font-bold text-slate-900">Hidrolik Güç Sistemleri</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600 font-medium">Fabrika Kodu</span>
                <span className="text-sm font-bold text-slate-900">TR-KOCAELI-04</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <i className="fas fa-bell text-blue-500"></i>
                Bildirim Ayarları
              </div>
              <i className="fas fa-chevron-right text-xs text-slate-300"></i>
            </button>
            <button className="w-full bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <i className="fas fa-shield-halved text-emerald-500"></i>
                Güvenlik Prosedürleri
              </div>
              <i className="fas fa-chevron-right text-xs text-slate-300"></i>
            </button>
            <button 
              onClick={() => {
                if(confirm("Tüm veriler silinecek, emin misiniz?")) {
                  saveTasks([]);
                  setTasks([]);
                }
              }}
              className="w-full bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between font-bold text-red-600 hover:bg-red-100 transition-colors mt-6"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-trash-can"></i>
                Tüm Geçmişi Temizle (Sıfırla)
              </div>
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
