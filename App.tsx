
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, TaskStatus, TaskPriority } from './types';
import { fetchTasks, saveTasks, getSyncKey, setSyncKey } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';

const AMIR_LIST = ['Birim Amiri Volkan', 'Vardiya Amiri Selçuk'];
const USTA_LIST = ['Usta Ahmet', 'Usta Mehmet', 'Usta Can', 'Usta Serkan', 'Usta Osman', 'Usta İbrahim'];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile'>('tasks');
  const [unitCode, setUnitCode] = useState(getSyncKey());
  
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setSyncStatus('syncing');
    try {
      const data = await fetchTasks();
      setTasks(data);
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Diğer telefonlardaki değişimleri yakalamak için 5 saniyede bir kontrol (Agresif sync)
    const interval = setInterval(() => loadData(false), 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogin = (name: string, role: 'AMIR' | 'USTA') => {
    setCurrentUser({
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      role
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskMachine || !newTaskDescription || !newTaskMaster) return alert("Eksik bilgi!");

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
    setActiveTab('tasks');
    
    setSyncStatus('syncing');
    const success = await saveTasks(updatedTasks);
    setSyncStatus(success ? 'synced' : 'error');

    // Formu temizle
    setNewTaskMachine('');
    setNewTaskDescription('');
    setNewTaskMaster('');
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
    setSyncStatus('syncing');
    const success = await saveTasks(updatedTasks);
    setSyncStatus(success ? 'synced' : 'error');
  };

  const updateUnitCode = () => {
    const newCode = prompt("Birim Kodunu Girin (Diğer telefonlarla aynı olmalı):", unitCode);
    if (newCode && newCode.trim()) {
      setSyncKey(newCode);
      setUnitCode(newCode);
      loadData();
      alert("Birim kodu güncellendi. Veriler bu kod altındaki odadan çekilecek.");
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start p-6 text-white overflow-y-auto pb-12">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mt-8 mb-10">
            <div className="bg-blue-600 p-5 rounded-3xl shadow-2xl shadow-blue-900/40 mb-6">
              <i className="fas fa-oil-can text-5xl text-white"></i>
            </div>
            <h1 className="text-3xl font-bold tracking-tighter">HidroGörev</h1>
            <p className="text-slate-400 mt-2 text-center text-sm font-medium">Birim İçi Eşzamanlı Takip</p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-user-shield"></i> Amir Listesi
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {AMIR_LIST.map(name => (
                  <button key={name} onClick={() => handleLogin(name, 'AMIR')} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-left font-bold active:scale-95 flex items-center justify-between">
                    <span>{name}</span>
                    <i className="fas fa-chevron-right text-slate-500 text-xs"></i>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-wrench"></i> Usta Listesi
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {USTA_LIST.map(name => (
                  <button key={name} onClick={() => handleLogin(name, 'USTA')} className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-left font-bold active:scale-95 flex items-center justify-between">
                    <span>{name}</span>
                    <i className="fas fa-chevron-right text-slate-500 text-xs"></i>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const filteredTasks = currentUser.role === 'USTA' 
    ? tasks.filter(t => t.masterName === currentUser.name)
    : tasks;

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="sticky top-[72px] z-40 -mx-4 mb-4 px-4">
         <div className={`flex items-center justify-between px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tighter shadow-sm border ${
           syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
           syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse' :
           'bg-red-50 text-red-700 border-red-100'
         }`}>
            <span className="flex items-center gap-2">
               <i className={`fas ${syncStatus === 'synced' ? 'fa-check-circle' : syncStatus === 'syncing' ? 'fa-sync animate-spin' : 'fa-exclamation-triangle'}`}></i>
               {syncStatus === 'synced' ? 'Bulut ile Eşitlendi' : syncStatus === 'syncing' ? 'Veriler Güncelleniyor...' : 'Bağlantı Hatası!'}
            </span>
            <span className="opacity-60">Kod: {unitCode}</span>
         </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Aktif İşler</h2>
            <button onClick={() => loadData()} disabled={loading} className="p-2 text-blue-600 active:rotate-180 transition-transform duration-500">
              <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <i className="fas fa-check-double text-4xl mb-3 opacity-20"></i>
              <p className="text-sm font-medium">Bekleyen görev bulunmuyor.</p>
            </div>
          ) : (
            <div className="pb-4 space-y-4">
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} user={currentUser} onUpdateStatus={updateTaskStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="animate-in slide-in-from-right duration-300">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Görev Atama</h2>
          <form onSubmit={handleCreateTask} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <input 
              type="text" placeholder="Makine Adı" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
              value={newTaskMachine} onChange={(e) => setNewTaskMachine(e.target.value)} required
            />
            <select 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 outline-none appearance-none"
              value={newTaskMaster} onChange={(e) => setNewTaskMaster(e.target.value)} required
            >
              <option value="">Usta Seçin</option>
              {USTA_LIST.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(TaskPriority).map(p => (
                <button key={p} type="button" onClick={() => setNewTaskPriority(p)} className={`py-2 rounded-lg text-xs font-bold border transition-all ${newTaskPriority === p ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {p}
                </button>
              ))}
            </div>
            <textarea 
              placeholder="İşlem Detayı..." className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 outline-none h-32"
              value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} required
            />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
              GÖREVİ GÖNDER
            </button>
          </form>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="animate-in slide-in-from-left duration-300">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Ayarlar</h2>
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Birim Senkronizasyon Kodu</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-100 px-4 py-3 rounded-xl font-mono text-sm font-bold border border-slate-200 truncate">
                  {unitCode}
                </div>
                <button onClick={updateUnitCode} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs">Değiştir</button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500 leading-tight">
                * Bu kodun diğer telefonlarda da aynı olduğundan emin olun. Kod farklıysa görevleri göremezsiniz.
              </p>
            </div>

            <button onClick={() => { if(confirm("Tüm veriler silinsin mi?")) { saveTasks([]); setTasks([]); } }} className="w-full bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-bold text-sm flex items-center gap-2 justify-center">
              <i className="fas fa-trash"></i> Veriyi Temizle
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
