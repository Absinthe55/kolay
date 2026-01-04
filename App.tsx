
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, TaskStatus, TaskPriority } from './types';
import { fetchTasks, createNewBin, getStoredBinId, setStoredBinId, safeAddTask, safeUpdateTask, getEmergencyId } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';

const AMIR_LIST = ['Birim Amiri Volkan', 'Vardiya Amiri Selçuk'];
const USTA_LIST = ['Usta Ahmet', 'Usta Mehmet', 'Usta Can', 'Usta Serkan', 'Usta Osman', 'Usta İbrahim'];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile'>('tasks');
  const [connectionId, setConnectionId] = useState(getStoredBinId());
  
  // Form State
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchTasks(connectionId);
    setTasks(data);
    setLoading(false);
  }, [connectionId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (connectionId) {
        fetchTasks(connectionId).then(setTasks);
      }
    }, 5000); 
    return () => clearInterval(interval);
  }, [connectionId, loadData]);

  const handleLogin = (name: string, role: 'AMIR' | 'USTA') => {
    setCurrentUser({
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      role
    });
  };

  const handleCreateConnection = async () => {
    if(!confirm("İnternet üzerinden yeni bir bağlantı kodu oluşturulacak. Devam edilsin mi?")) return;
    
    setLoading(true);
    const newId = await createNewBin();
    setLoading(false);
    
    if (newId) {
      setConnectionId(newId);
      alert("✅ BAŞARILI!\n\nOluşturulan Kod: " + newId + "\n\nBu kodu diğer telefonlara girerek eşleşebilirsiniz.");
      loadData();
    } else {
      // Eğer tüm servisler başarısız olursa
      if(confirm("⚠ Sunuculara erişilemedi (Güvenlik Duvarı/Ağ Hatası).\n\nGenel 'Demo Kanalı'na bağlanmak ister misiniz?")) {
          const emergencyId = getEmergencyId();
          setStoredBinId(emergencyId);
          setConnectionId(emergencyId);
          alert("Demo kanalına bağlandınız. Kodunuz: " + emergencyId);
          loadData();
      }
    }
  };

  const handleJoinConnection = () => {
    const code = prompt("Diğer cihazdaki Bağlantı Kodunu girin:");
    if (code && code.trim().length > 5) {
      const cleanCode = code.trim();
      setStoredBinId(cleanCode);
      setConnectionId(cleanCode);
      loadData();
      alert("Bağlantı kodu kaydedildi. Veriler indiriliyor...");
    } else if (code) {
      alert("Geçersiz kod.");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskMachine || !newTaskDescription || !newTaskMaster) return;

    const newTask: Task = {
      id: Date.now().toString(),
      machineName: newTaskMachine,
      masterName: newTaskMaster,
      description: newTaskDescription,
      status: TaskStatus.PENDING,
      priority: newTaskPriority,
      createdAt: Date.now(),
    };

    setLoading(true);
    const updatedList = await safeAddTask(newTask);
    setTasks(updatedList);
    setLoading(false);
    
    setNewTaskMachine('');
    setNewTaskDescription('');
    setNewTaskMaster('');
    alert("Görev başarıyla eklendi.");
    setActiveTab('tasks');
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, comment?: string) => {
    setLoading(true);
    const updatedList = await safeUpdateTask(taskId, (t) => ({
      ...t,
      status: newStatus,
      comments: comment || t.comments,
      completedAt: newStatus === TaskStatus.COMPLETED ? Date.now() : t.completedAt
    }));
    
    if (updatedList.length > 0) setTasks(updatedList);
    else {
        const localUpdate = tasks.map(t => t.id === taskId ? { ...t, status: newStatus, comments: comment || t.comments } : t);
        setTasks(localUpdate);
    }
    setLoading(false);
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
            <p className="text-slate-400 mt-2 text-center text-sm font-medium">Hidrolik Bakım Takip</p>
          </div>
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Kullanıcı Seçimi</h2>
              <div className="grid grid-cols-1 gap-3">
                {AMIR_LIST.map(name => (
                  <button key={name} onClick={() => handleLogin(name, 'AMIR')} className="bg-slate-800 border border-slate-700 p-4 rounded-xl text-left font-bold hover:bg-slate-700 flex justify-between items-center group">
                    <span className="text-blue-400 group-hover:text-white transition-colors">{name}</span>
                    <i className="fas fa-chevron-right text-slate-600"></i>
                  </button>
                ))}
                {USTA_LIST.map(name => (
                  <button key={name} onClick={() => handleLogin(name, 'USTA')} className="bg-slate-800 border border-slate-700 p-4 rounded-xl text-left font-bold hover:bg-slate-700 flex justify-between items-center group">
                    <span className="text-emerald-400 group-hover:text-white transition-colors">{name}</span>
                    <i className="fas fa-chevron-right text-slate-600"></i>
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
      <div className={`px-4 py-3 mb-4 rounded-lg text-xs font-bold flex justify-between items-center shadow-sm ${connectionId ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        <span className="flex items-center gap-2">
           <i className={`fas ${connectionId ? 'fa-link' : 'fa-wifi-slash'}`}></i>
           {connectionId ? 'Bağlantı Aktif' : 'Yerel Mod (Senkronizasyon Yok)'}
        </span>
        {connectionId && <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 opacity-80 text-[10px]">{connectionId.substring(0,6)}...</span>}
      </div>

      {activeTab === 'tasks' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">İş Listesi</h2>
            <button onClick={loadData} disabled={loading} className={`w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 text-blue-600 shadow-sm ${loading ? 'animate-spin' : ''}`}>
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <i className="fas fa-clipboard-list text-5xl mb-4 opacity-20"></i>
              <p>Aktif görev bulunmuyor.</p>
              {!connectionId && <p className="text-xs text-orange-400 mt-2">Bağlantı kurmak için Ayarlar'a gidin.</p>}
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} user={currentUser} onUpdateStatus={updateTaskStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="animate-in slide-in-from-right duration-300">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Görev Ver</h2>
          <form onSubmit={handleCreateTask} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            {!connectionId && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    Uyarı: Bağlantı kodu girmediniz. Veriler sadece bu cihazda kalır.
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Makine</label>
                <input type="text" className="w-full border border-slate-200 rounded-xl p-3 mt-1 bg-slate-50" value={newTaskMachine} onChange={e => setNewTaskMachine(e.target.value)} required placeholder="Örn: Pres 4" />
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Usta</label>
                <select className="w-full border border-slate-200 rounded-xl p-3 mt-1 bg-slate-50" value={newTaskMaster} onChange={e => setNewTaskMaster(e.target.value)} required>
                    <option value="">Seçiniz...</option>
                    {USTA_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Öncelik</label>
                <div className="flex gap-2 mt-1">
                    {Object.values(TaskPriority).map(p => (
                        <button key={p} type="button" onClick={() => setNewTaskPriority(p)} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newTaskPriority === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{p}</button>
                    ))}
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Açıklama</label>
                <textarea className="w-full border border-slate-200 rounded-xl p-3 mt-1 bg-slate-50 h-24" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} required placeholder="İş emri detayı..." />
            </div>
            <button disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                {loading ? 'Gönderiliyor...' : 'GÖREVİ YAYINLA'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="animate-in slide-in-from-left duration-300">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Bağlantı Ayarları</h2>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="text-center">
                 <p className="text-xs font-bold text-slate-400 uppercase mb-2">Mevcut Bağlantı Kodu</p>
                 <div className={`text-xl font-mono font-bold tracking-widest py-4 rounded-xl border select-all break-all px-2 ${connectionId ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {connectionId || "BAĞLANTI YOK"}
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                 <button onClick={handleCreateConnection} className="bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-blue-200 shadow-lg active:scale-95 transition-transform">
                    <i className="fas fa-satellite-dish mr-2"></i>
                    YENİ KOD OLUŞTUR
                 </button>
                 <button onClick={handleJoinConnection} className="bg-white text-slate-700 py-4 rounded-xl font-bold text-sm border border-slate-200 active:scale-95 transition-transform">
                    <i className="fas fa-keyboard mr-2"></i>
                    MEVCUT KODU GİR
                 </button>
              </div>
           </div>
           <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-2 text-xs uppercase flex items-center gap-2"><i className="fas fa-info-circle"></i> Kullanım Kılavuzu</h3>
              <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                 <li>Sadece <b>BİR</b> telefonda "Yeni Kod Oluştur" deyin.</li>
                 <li>Çıkan kodu diğer tüm telefonlara "Mevcut Kodu Gir" diyerek yazın.</li>
                 <li>Bağlantı kurulamazsa "Demo Kanalı" seçeneğini kullanabilirsiniz.</li>
              </ul>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
