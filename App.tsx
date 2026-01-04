
import React, { useState, useEffect, useCallback } from 'react';
import { Task, User, TaskStatus, TaskPriority } from './types';
import { fetchAppData, saveAppData, createNewBin, getStoredBinId, setStoredBinId, getEmergencyId, extractBinId, checkConnection } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';

// Varsayılan listeler (İlk kurulum veya yerel mod için)
const DEFAULT_AMIRS = ['Birim Amiri ERKAN ÇİLİNGİR', 'Vardiya Amiri Selçuk', 'Birim Amiri Volkan'];
const DEFAULT_USTAS = ['Usta Ahmet', 'Usta Mehmet', 'Usta Can', 'Usta Serkan', 'Usta Osman', 'Usta İbrahim'];

// Otomatik bağlanılacak Npoint adresi
const AUTO_CONNECT_URL = 'https://www.npoint.io/docs/c85115e1d1b4c3276a86';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [amirList, setAmirList] = useState<string[]>(DEFAULT_AMIRS);
  const [ustaList, setUstaList] = useState<string[]>(DEFAULT_USTAS);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile'>('tasks');
  const [connectionId, setConnectionId] = useState(getStoredBinId());
  
  // Personel Yönetimi State'leri
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'AMIR' | 'USTA'>('USTA');

  // Form State
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  // Veri Yükleme
  const loadData = useCallback(async (forceId?: string) => {
    setLoading(true);
    const targetId = forceId || connectionId;
    const data = await fetchAppData(targetId);
    
    setTasks(data.tasks);
    // Eğer sunucudan liste gelmişse güncelle, yoksa varsayılanları koru
    if (data.amirs && data.amirs.length > 0) setAmirList(data.amirs);
    if (data.ustas && data.ustas.length > 0) setUstaList(data.ustas);
    
    setLoading(false);
  }, [connectionId]);

  // Otomatik Bağlantı ve Periyodik Güncelleme
  useEffect(() => {
    // 1. İlk açılışta veri yükle
    loadData();

    // 2. 3 saniye sonra otomatik bağlantı kontrolü
    const autoConnectTimer = setTimeout(async () => {
       const currentId = getStoredBinId();
       if (!currentId) {
          console.log("Otomatik bağlantı başlatılıyor...");
          const autoId = extractBinId(AUTO_CONNECT_URL);
          const isValid = await checkConnection(autoId);
          if (isValid) {
             setStoredBinId(autoId);
             setConnectionId(autoId);
             // ID set edildikten sonra loadData connectionId değişimini yakalayamaz (closure), manuel çağır
             const data = await fetchAppData(autoId);
             setTasks(data.tasks);
             if (data.amirs.length > 0) setAmirList(data.amirs);
             if (data.ustas.length > 0) setUstaList(data.ustas);
             alert("✅ Sisteme otomatik olarak bağlandınız!");
          }
       }
    }, 3000);

    // 3. Periyodik güncelleme
    const interval = setInterval(() => {
      if (connectionId) {
        fetchAppData(connectionId).then(data => {
            setTasks(data.tasks);
            if (data.amirs.length > 0) setAmirList(data.amirs);
            if (data.ustas.length > 0) setUstaList(data.ustas);
        });
      }
    }, 5000); 

    return () => {
        clearInterval(interval);
        clearTimeout(autoConnectTimer);
    };
  }, [connectionId, loadData]);

  const handleLogin = (name: string, role: 'AMIR' | 'USTA') => {
    setCurrentUser({
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      role
    });
  };

  const handleCreateConnection = async () => {
    if(!confirm("Otomatik bağlantı oluşturulacak. Devam?")) return;
    
    setLoading(true);
    const newId = await createNewBin(amirList, ustaList);
    setLoading(false);
    
    if (newId) {
      setConnectionId(newId);
      loadData(newId);
      alert("✅ BAŞARILI!\n\nKod: " + newId);
    } else {
      // MANUEL GİRİŞ
      const manualInput = prompt(
        "⚠ OTOMATİK OLUŞTURULAMADI\n\n" +
        "Lütfen 'npoint.io' sitesinden aldığınız kodu (veya linki) yapıştırın:"
      );

      if (manualInput && manualInput.trim().length > 1) {
        setLoading(true);
        const cleanCode = extractBinId(manualInput);
        const isValid = await checkConnection(cleanCode);
        
        if (isValid) {
            setStoredBinId(cleanCode);
            setConnectionId(cleanCode);
            await loadData(cleanCode);
            alert("✅ BAŞARILI! Bağlantı sağlandı.");
        } else {
            setLoading(false);
            alert("❌ BAĞLANTI HATASI!");
        }
      }
    }
  };

  const handleJoinConnection = async () => {
    const code = prompt("Bağlantı kodunu girin:");
    if (code && code.trim().length > 1) {
      setLoading(true);
      const cleanCode = extractBinId(code);
      const isValid = await checkConnection(cleanCode);
      
      if (isValid) {
          setStoredBinId(cleanCode);
          setConnectionId(cleanCode);
          await loadData(cleanCode);
          alert("✅ Veriler indirildi ve eşleşildi.");
      } else {
          setLoading(false);
          alert("❌ Bu kod ile bağlantı kurulamadı.");
      }
    }
  };

  // Personel Ekleme (Sadece ERKAN ÇİLİNGİR)
  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    
    setLoading(true);
    let newAmirs = [...amirList];
    let newUstas = [...ustaList];

    if (newMemberRole === 'AMIR') {
        newAmirs.push(newMemberName.trim());
        setAmirList(newAmirs);
    } else {
        newUstas.push(newMemberName.trim());
        setUstaList(newUstas);
    }

    await saveAppData({ tasks, amirs: newAmirs, ustas: newUstas }, connectionId);
    setNewMemberName('');
    setLoading(false);
    alert(`${newMemberName} listeye eklendi.`);
  };

  // Personel Çıkarma (Sadece ERKAN ÇİLİNGİR)
  const handleRemoveMember = async (name: string, role: 'AMIR' | 'USTA') => {
      if(!confirm(`${name} kullanıcısını silmek istediğinize emin misiniz?`)) return;

      setLoading(true);
      let newAmirs = [...amirList];
      let newUstas = [...ustaList];

      if (role === 'AMIR') {
          newAmirs = newAmirs.filter(a => a !== name);
          setAmirList(newAmirs);
      } else {
          newUstas = newUstas.filter(u => u !== name);
          setUstaList(newUstas);
      }
      
      await saveAppData({ tasks, amirs: newAmirs, ustas: newUstas }, connectionId);
      setLoading(false);
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

    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    
    setLoading(true);
    await saveAppData({ tasks: updatedTasks, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
    
    setNewTaskMachine('');
    setNewTaskDescription('');
    setNewTaskMaster('');
    alert("Görev yayınlandı.");
    setActiveTab('tasks');
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, comment?: string) => {
    setLoading(true);
    const updatedTasks = tasks.map(t => t.id === taskId ? {
      ...t,
      status: newStatus,
      comments: comment || t.comments,
      completedAt: newStatus === TaskStatus.COMPLETED ? Date.now() : t.completedAt
    } : t);
    
    setTasks(updatedTasks);
    await saveAppData({ tasks: updatedTasks, amirs: amirList, ustas: ustaList }, connectionId);
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
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Amir Girişi</h2>
              <div className="grid grid-cols-1 gap-3">
                {amirList.map(name => (
                  <button key={name} onClick={() => handleLogin(name, 'AMIR')} className="bg-slate-800 border border-slate-700 p-4 rounded-xl text-left font-bold hover:bg-slate-700 flex justify-between items-center group">
                    <span className="text-blue-400 group-hover:text-white transition-colors">{name}</span>
                    <i className="fas fa-chevron-right text-slate-600"></i>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Usta Girişi</h2>
              <div className="grid grid-cols-1 gap-3">
                {ustaList.map(name => (
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

  const isErkan = currentUser.name === 'Birim Amiri ERKAN ÇİLİNGİR';

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className={`px-4 py-3 mb-4 rounded-lg text-xs font-bold flex justify-between items-center shadow-sm ${connectionId ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        <span className="flex items-center gap-2">
           <i className={`fas ${connectionId ? 'fa-link' : 'fa-wifi-slash'}`}></i>
           {connectionId ? 'Canlı Bağlantı' : 'Yerel Mod'}
        </span>
        {connectionId && <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 opacity-80 text-[10px]">{connectionId.substring(0,6)}...</span>}
      </div>

      {activeTab === 'tasks' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">İş Listesi</h2>
            <button onClick={() => loadData()} disabled={loading} className={`w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 text-blue-600 shadow-sm ${loading ? 'animate-spin' : ''}`}>
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <i className="fas fa-clipboard-list text-5xl mb-4 opacity-20"></i>
              <p>Aktif görev bulunmuyor.</p>
              {!connectionId && <p className="text-xs text-orange-400 mt-2">Otomatik bağlanılıyor...</p>}
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
                    Yerel moddasınız. Veriler senkronize olmayabilir.
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
                    {ustaList.map(u => <option key={u} value={u}>{u}</option>)}
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
        <div className="animate-in slide-in-from-left duration-300 pb-20">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Ayarlar</h2>
           
           {/* Personel Yönetimi - Sadece Erkan Çilingir */}
           {isErkan && (
               <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm mb-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-users-cog text-6xl text-blue-800"></i></div>
                   <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2 text-lg">
                       <i className="fas fa-user-shield"></i> Personel Yönetimi
                   </h3>
                   
                   {/* Ekleme Formu */}
                   <div className="bg-white/60 p-4 rounded-xl mb-4 border border-blue-100 backdrop-blur-sm">
                       <p className="text-xs font-bold text-blue-400 uppercase mb-2">Yeni Personel Ekle</p>
                       <div className="flex flex-col gap-2">
                           <input 
                               type="text" 
                               placeholder="Ad Soyad (Örn: Usta Ali)" 
                               className="p-3 rounded-lg border border-blue-100 text-sm w-full"
                               value={newMemberName}
                               onChange={(e) => setNewMemberName(e.target.value)}
                           />
                           <div className="flex gap-2">
                               <select 
                                   className="p-3 rounded-lg border border-blue-100 text-sm bg-white"
                                   value={newMemberRole}
                                   onChange={(e) => setNewMemberRole(e.target.value as any)}
                               >
                                   <option value="USTA">Usta</option>
                                   <option value="AMIR">Amir</option>
                               </select>
                               <button 
                                   onClick={handleAddMember}
                                   className="flex-1 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-blue-700"
                               >
                                   EKLE
                               </button>
                           </div>
                       </div>
                   </div>

                   {/* Listeleme ve Silme */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                           <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Amirler</h4>
                           <ul className="space-y-1">
                               {amirList.map(name => (
                                   <li key={name} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-xs font-bold text-slate-700">
                                       {name}
                                       {name !== currentUser.name && (
                                           <button onClick={() => handleRemoveMember(name, 'AMIR')} className="text-red-400 hover:text-red-600 px-2">
                                               <i className="fas fa-trash"></i>
                                           </button>
                                       )}
                                   </li>
                               ))}
                           </ul>
                       </div>
                       <div>
                           <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Ustalar</h4>
                           <ul className="space-y-1">
                               {ustaList.map(name => (
                                   <li key={name} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-xs font-bold text-slate-700">
                                       {name}
                                       <button onClick={() => handleRemoveMember(name, 'USTA')} className="text-red-400 hover:text-red-600 px-2">
                                           <i className="fas fa-trash"></i>
                                       </button>
                                   </li>
                               ))}
                           </ul>
                       </div>
                   </div>
               </div>
           )}

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
              <div className="text-center mt-2">
                 <a href="https://npoint.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 underline">
                    Kod oluşturamıyorsanız buraya tıklayın (npoint.io)
                 </a>
              </div>
           </div>
           
           <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-2 text-xs uppercase flex items-center gap-2"><i className="fas fa-info-circle"></i> Otomatik Bağlantı</h3>
              <p className="text-xs text-slate-600">
                  Sistem açıldığında 3 saniye içinde bağlantı yoksa otomatik olarak ana veritabanına bağlanır.
              </p>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
