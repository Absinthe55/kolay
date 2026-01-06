import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';
import CalendarView from './components/CalendarView';
import { Task, User, AppTab, Member, UstaRequest, LeaveRequest, RequestStatus, TaskPriority, TaskStatus } from './types';
import { fetchAppData, saveAppData, createNewBin, checkConnection, extractBinId, getStoredBinId, setStoredBinId } from './services/dbService';

// Otomatik bağlanılacak demo ID
const AUTO_CONNECT_ID = 'demo_kanal_v1';
const LOCAL_KEY_AUTH = 'hidro_auth';

const App: React.FC = () => {
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<UstaRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [amirs, setAmirs] = useState<Member[]>([]);
  const [ustas, setUstas] = useState<Member[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  
  // UI State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [isLoading, setIsLoading] = useState(true);
  const [binId, setBinId] = useState('');
  
  // Sync State
  const [isDirty, setIsDirty] = useState(false); // Yerel değişiklik var mı?

  // Forms
  const [newRequestContent, setNewRequestContent] = useState('');
  
  // Add Task Form
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  // Personnel Management
  const [renameModal, setRenameModal] = useState<{show: boolean, oldName: string, role: 'AMIR'|'USTA'} | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [passwordChangeModal, setPasswordChangeModal] = useState<{show: boolean, memberName: string, role: 'AMIR'|'USTA'} | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  
  // New Member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'AMIR'|'USTA'>('USTA');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Login
  const [loginInput, setLoginInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const amirList = amirs;
  const ustaList = ustas;

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
      // OTOMATİK GİRİŞ İPTAL EDİLDİ: Kullanıcılar her seferinde oturum seçebilmeli.
      /*
      const storedAuth = localStorage.getItem(LOCAL_KEY_AUTH);
      if (storedAuth) {
          try {
              const authUser = JSON.parse(storedAuth);
              if (authUser && authUser.name && authUser.role) {
                  setCurrentUser(authUser);
              }
          } catch (e) { console.error(e); }
      }
      */

      let currentId = getStoredBinId() || AUTO_CONNECT_ID;

      if (currentId) {
          const isValid = await checkConnection(currentId);
          if (isValid) {
              setStoredBinId(currentId);
              setBinId(currentId);
              setConnectionStatus('connected');
              await loadData(currentId);
          }
      }
      setIsLoading(false);
  };

  const loadData = async (id: string) => {
      try {
          const data = await fetchAppData(id);
          setTasks(data.tasks);
          setRequests(data.requests);
          setLeaves(data.leaves);
          setAmirs(data.amirs);
          setUstas(data.ustas);
          setDeletedTasks(data.deletedTasks);
      } catch (e) { console.error(e); }
  };

  // --- POLLING & SAVING MECHANISM ---

  // 1. POLLING: Her saniye veriyi güncelle (Eğer yerel değişiklik yoksa)
  useEffect(() => {
      if (!binId || connectionStatus !== 'connected') return;

      const interval = setInterval(() => {
          // Eğer kullanıcı bir şeyleri değiştiriyorsa (isDirty=true), sunucudan çekip üzerine yazma.
          // Önce kaydetmesinin bitmesini bekle.
          if (!isDirty) {
              loadData(binId);
          }
      }, 1000);

      return () => clearInterval(interval);
  }, [binId, connectionStatus, isDirty]);

  // 2. SAVING: Değişiklik olduğunda kaydet (Debounce ile)
  const saveAll = async () => {
      if (!binId) return;
      await saveAppData({ tasks, requests, leaves, amirs, ustas, deletedTasks }, binId);
      setIsDirty(false); // Kayıt tamamlandı, tekrar veri çekmeye başlayabiliriz
  };
  
  useEffect(() => {
      // Sadece yerel bir değişiklik yapıldıysa (isDirty) kaydet
      if(currentUser && binId && isDirty) {
          const timer = setTimeout(saveAll, 1000); // 1 saniye bekle (yazma bitince kaydet)
          return () => clearTimeout(timer);
      }
  }, [tasks, requests, leaves, amirs, ustas, deletedTasks, isDirty]);

  // --- ACTIONS ---

  const handleCreateRequest = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRequestContent.trim() || !currentUser) return;

      const newReq: UstaRequest = {
          id: Date.now().toString(),
          ustaName: currentUser.name,
          content: newRequestContent,
          status: RequestStatus.PENDING,
          createdAt: Date.now()
      };
      setRequests([newReq, ...requests]);
      setNewRequestContent('');
      setIsDirty(true);
  };

  const handleRequestAction = (id: string, action: 'APPROVE' | 'REJECT' | 'DELETE') => {
      if (action === 'DELETE') {
          if(window.confirm("Silinsin mi?")) {
              setRequests(requests.filter(r => r.id !== id));
              setIsDirty(true);
          }
      } else {
          const newStatus = action === 'APPROVE' ? RequestStatus.APPROVED : RequestStatus.REJECTED;
          setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
          setIsDirty(true);
      }
  };

  const handleCreateTask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskMachine || !newTaskMaster || !newTaskDescription) {
          alert("Lütfen tüm alanları doldurun.");
          return;
      }

      const newTask: Task = {
          id: Date.now().toString(),
          machineName: newTaskMachine,
          masterName: newTaskMaster,
          description: newTaskDescription,
          status: TaskStatus.PENDING,
          priority: newTaskPriority,
          createdAt: Date.now()
      };

      setTasks([newTask, ...tasks]);
      setNewTaskMachine('');
      setNewTaskDescription('');
      setNewTaskMaster('');
      setActiveTab('tasks');
      setIsDirty(true);
  };

  // ... (Existing personnel & task handlers) ...
  const handleAddMember = () => {
      if (!newMemberName.trim()) return;
      const newMember: Member = {
          name: newMemberName.trim(),
          password: newMemberPassword.trim(),
          phoneNumber: newMemberPhone.trim(),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newMemberName)}&background=random`
      };
      if (newMemberRole === 'AMIR') setAmirs([...amirs, newMember]);
      else setUstas([...ustas, newMember]);
      setNewMemberName(''); setNewMemberPassword(''); setNewMemberPhone('');
      setIsDirty(true);
  };

  const handleRemoveMember = (name: string, role: 'AMIR'|'USTA') => {
      if (!window.confirm("Silinecek?")) return;
      if (role === 'AMIR') setAmirs(amirs.filter(m => m.name !== name));
      else setUstas(ustas.filter(m => m.name !== name));
      setIsDirty(true);
  };

  const handleRenameMember = () => {
    if (!renameModal || !renameInput.trim()) return;
    const updateList = (list: Member[]) => list.map(m => m.name === renameModal.oldName ? { ...m, name: renameInput.trim() } : m);
    if (renameModal.role === 'AMIR') setAmirs(updateList(amirs)); else setUstas(updateList(ustas));
    setRenameModal(null); setRenameInput('');
    setIsDirty(true);
  };
  const handlePasswordChange = () => {
    if (!passwordChangeModal) return;
    const updateList = (list: Member[]) => list.map(m => m.name === passwordChangeModal.memberName ? { ...m, password: newPasswordInput.trim() } : m);
    if (passwordChangeModal.role === 'AMIR') setAmirs(updateList(amirs)); else setUstas(updateList(ustas));
    setPasswordChangeModal(null); setNewPasswordInput('');
    setIsDirty(true);
  };

  const handleTaskMarkSeen = (taskId: string) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, seenAt: Date.now() } : t));
      setIsDirty(true);
  };
  const handleTaskStatusChange = (taskId: string, status: TaskStatus) => {
      setTasks(tasks.map(t => {
          if (t.id !== taskId) return t;
          const updates: Partial<Task> = { status };
          if (status === TaskStatus.IN_PROGRESS) updates.startedAt = Date.now();
          if (status === TaskStatus.COMPLETED) updates.completedAt = Date.now();
          return { ...t, ...updates };
      }));
      setIsDirty(true);
  };
  const handleTaskDelete = (taskId: string) => {
      if (!window.confirm("Silinecek?")) return;
      const task = tasks.find(t => t.id === taskId);
      if (task) {
          setDeletedTasks([...deletedTasks, { ...task, deletedAt: Date.now() }]);
          setTasks(tasks.filter(t => t.id !== taskId));
          setIsDirty(true);
      }
  };
  const handleTaskComment = (taskId: string, comment: string) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, comments: (t.comments ? t.comments + '\n' : '') + comment } : t));
      setIsDirty(true);
  };
  
  // Leaves
  const handleAddLeave = (start: string, end: string, reason: string) => {
      if (!currentUser) return;
      const d1 = new Date(start); const d2 = new Date(end);
      const diffDays = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1; 
      const newLeave: LeaveRequest = { id: Math.random().toString(36).substr(2, 9), ustaName: currentUser.name, startDate: start, endDate: end, daysCount: diffDays, reason, status: RequestStatus.PENDING, createdAt: Date.now() };
      setLeaves([...leaves, newLeave]);
      setIsDirty(true);
  };
  const handleUpdateLeaveStatus = (id: string, status: RequestStatus) => {
      setLeaves(leaves.map(l => l.id === id ? { ...l, status } : l));
      setIsDirty(true);
  };
  const handleDeleteLeave = (id: string) => { 
      if(window.confirm("Silinecek?")) {
          setLeaves(leaves.filter(l => l.id !== id));
          setIsDirty(true);
      }
  };

  // Login/Connect
  const handleLogin = (user: Member, role: 'AMIR' | 'USTA') => {
      const loggedUser: User = { id: user.name, name: user.name, role, avatar: user.avatar };
      setCurrentUser(loggedUser);
      // localStorage.setItem(LOCAL_KEY_AUTH, JSON.stringify(loggedUser)); // Auto-login disabled
  };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem(LOCAL_KEY_AUTH); };
  const handleDisconnect = () => { setBinId(''); setStoredBinId(''); handleLogout(); };

  const handleConnect = async () => {
      setConnectionStatus('checking');
      const id = extractBinId(loginInput);
      if (!id) { setConnectionStatus('error'); return; }
      const isValid = await checkConnection(id);
      if (isValid) { setStoredBinId(id); setBinId(id); setConnectionStatus('connected'); await loadData(id); } else { setConnectionStatus('error'); }
  };
  const handleCreateGroup = async () => {
      const newId = await createNewBin([{ name: 'Yönetici', password: '123' }], []);
      if (newId) { setStoredBinId(newId); setBinId(newId); setConnectionStatus('connected'); await loadData(newId); alert(`Grup ID: ${newId}`); }
  };

  // --- RENDER HELPERS ---

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500"><i className="fas fa-circle-notch fa-spin text-4xl"></i></div>;

  // 1. LOGIN SCREEN (MODERNIZED)
  if (!currentUser) {
      if (!binId) {
          return (
              <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <div className="relative z-10 w-full max-w-sm bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                      <div className="text-center mb-8">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3 transform hover:rotate-6 transition-transform">
                              <i className="fas fa-network-wired text-3xl text-white"></i>
                          </div>
                          <h1 className="text-3xl font-black text-white tracking-tight">HİDROLİK</h1>
                          <p className="text-blue-400 font-medium text-sm tracking-widest uppercase mt-1">Saha Yönetim Sistemi</p>
                      </div>
                      
                      <div className="space-y-4">
                          <div className="relative">
                              <i className="fas fa-link absolute left-4 top-4 text-slate-500"></i>
                              <input 
                                  type="text" 
                                  placeholder="Grup Bağlantı ID" 
                                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                                  value={loginInput}
                                  onChange={(e) => setLoginInput(e.target.value)}
                              />
                          </div>
                          <button 
                              onClick={handleConnect}
                              disabled={!loginInput || connectionStatus === 'checking'}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3.5 font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                          >
                              {connectionStatus === 'checking' ? 'Bağlanılıyor...' : 'Sisteme Bağlan'}
                          </button>
                          
                          {connectionStatus === 'error' && <p className="text-red-400 text-xs text-center font-bold bg-red-900/20 py-2 rounded-lg">Bağlantı başarısız. ID kontrol edin.</p>}
                          
                          <div className="flex items-center gap-4 py-2">
                              <div className="h-px bg-slate-700 flex-1"></div>
                              <span className="text-slate-500 text-xs">veya</span>
                              <div className="h-px bg-slate-700 flex-1"></div>
                          </div>
                          
                          <button 
                              onClick={handleCreateGroup}
                              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl py-3.5 font-bold transition-all border border-slate-700/50"
                          >
                              Yeni Grup Oluştur
                          </button>
                      </div>
                  </div>
              </div>
          );
      }

      return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 relative">
               <button onClick={() => { setBinId(''); setStoredBinId(''); }} className="absolute top-6 left-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                   <i className="fas fa-arrow-left"></i> <span className="text-xs font-bold">Çıkış</span>
               </button>
               
               <div className="w-full max-w-sm">
                   <h2 className="text-2xl font-black text-white mb-6 text-center">Hoş Geldiniz</h2>
                   
                   <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/5 shadow-2xl space-y-6">
                       {/* Amirs */}
                       <div>
                           <p className="text-xs font-bold text-blue-400 uppercase mb-3 pl-1 tracking-wider">Yöneticiler</p>
                           <div className="space-y-2">
                               {amirs.map(m => (
                                   <button key={m.name} onClick={() => handleLogin(m, 'AMIR')} className="w-full flex items-center gap-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 hover:border-blue-500 hover:bg-slate-700 transition-all group">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                           {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover rounded-xl" /> : m.name[0]}
                                       </div>
                                       <span className="text-slate-100 font-bold text-lg group-hover:text-white">{m.name}</span>
                                       <i className="fas fa-chevron-right ml-auto text-slate-600 group-hover:text-blue-400"></i>
                                   </button>
                               ))}
                               {amirs.length === 0 && <p className="text-sm text-slate-500 italic text-center py-2">Yönetici bulunamadı.</p>}
                           </div>
                       </div>
                       
                       <div className="h-px bg-slate-700/50"></div>

                       {/* Ustas */}
                       <div>
                           <p className="text-xs font-bold text-emerald-400 uppercase mb-3 pl-1 tracking-wider">Teknik Personel</p>
                           <div className="space-y-2">
                               {ustas.map(m => (
                                   <button key={m.name} onClick={() => handleLogin(m, 'USTA')} className="w-full flex items-center gap-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 hover:border-emerald-500 hover:bg-slate-700 transition-all group">
                                       <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                           {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover rounded-xl" /> : m.name[0]}
                                       </div>
                                       <span className="text-slate-100 font-bold text-lg group-hover:text-white">{m.name}</span>
                                       <i className="fas fa-chevron-right ml-auto text-slate-600 group-hover:text-emerald-400"></i>
                                   </button>
                               ))}
                               {ustas.length === 0 && <p className="text-sm text-slate-500 italic text-center py-2">Personel bulunamadı.</p>}
                           </div>
                       </div>
                   </div>
               </div>
          </div>
      );
  }

  // 2. MAIN APP
  const getDisplayTasks = () => {
      let filtered = tasks;
      
      // GÜVENLİK: Usta sadece kendisine atanan görevleri görebilmeli
      if (currentUser?.role === 'USTA') {
          filtered = tasks.filter(t => t.masterName === currentUser.name);
      }

      const priorityOrder = { [TaskPriority.CRITICAL]: 0, [TaskPriority.HIGH]: 1, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 3 };
      return [...filtered].sort((a, b) => {
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
          return b.createdAt - a.createdAt;
      });
  };

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
        
        {/* TAB: TASKS */}
        {activeTab === 'tasks' && (
            <div className="space-y-4 pb-24">
                <div className="flex justify-between items-end px-1">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Görevler</h2>
                        <p className="text-slate-400 text-xs font-medium mt-1">Saha Operasyonları</p>
                    </div>
                    <div className="bg-slate-800/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-300">{tasks.filter(t => t.status !== TaskStatus.COMPLETED).length} Aktif</span>
                    </div>
                </div>

                <div className="space-y-3">
                    {getDisplayTasks().length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <i className="fas fa-clipboard-check text-2xl text-slate-600"></i>
                            </div>
                            <p className="text-slate-400 font-bold">Aktif görev bulunmuyor</p>
                            <p className="text-slate-600 text-xs mt-1">Sistem şu an boşta</p>
                        </div>
                    ) : (
                        getDisplayTasks().map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                user={currentUser} 
                                onMarkSeen={handleTaskMarkSeen}
                                onStatusChange={handleTaskStatusChange}
                                onDelete={handleTaskDelete}
                                onAddComment={handleTaskComment}
                            />
                        ))
                    )}
                </div>
            </div>
        )}

        {/* TAB: ADD TASK (ONLY AMIR) */}
        {activeTab === 'add' && currentUser.role === 'AMIR' && (
            <div className="pb-24 animate-in slide-in-from-bottom-5 fade-in duration-300">
                <h2 className="text-2xl font-black text-white mb-6 px-1">Yeni Görev Ata</h2>
                
                <form onSubmit={handleCreateTask} className="bg-slate-800/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-blue-400 uppercase mb-2 pl-1">Makine / Bölge</label>
                        <div className="relative">
                            <i className="fas fa-industry absolute left-4 top-4 text-slate-500"></i>
                            <input 
                                type="text" 
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-blue-500 transition-colors"
                                placeholder="Örn: CNC-01"
                                value={newTaskMachine}
                                onChange={e => setNewTaskMachine(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-blue-400 uppercase mb-2 pl-1">Personel Seçimi</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                            {ustaList.map(u => (
                                <button
                                    key={u.name}
                                    type="button"
                                    onClick={() => setNewTaskMaster(u.name)}
                                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${newTaskMaster === u.name ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <div className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold">
                                        {u.name[0]}
                                    </div>
                                    <span className="text-xs font-bold truncate">{u.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-blue-400 uppercase mb-2 pl-1">Öncelik</label>
                        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                            {Object.values(TaskPriority).map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setNewTaskPriority(p)}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${newTaskPriority === p ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-blue-400 uppercase mb-2 pl-1">İş Emri Detayı</label>
                        <textarea 
                            rows={4}
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-colors resize-none"
                            placeholder="Yapılacak işlemi detaylı açıklayınız..."
                            value={newTaskDescription}
                            onChange={e => setNewTaskDescription(e.target.value)}
                        ></textarea>
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fas fa-paper-plane"></i> GÖREVİ YAYINLA
                    </button>
                </form>
            </div>
        )}

        {/* TAB: REQUESTS */}
        {activeTab === 'requests' && (
            <div className="space-y-6 pb-24">
                <div className="px-1">
                    <h2 className="text-2xl font-black text-white">Malzeme & Talep</h2>
                    <p className="text-slate-400 text-xs">Parça isteği ve teknik destek</p>
                </div>

                {/* Create Request Form (For USTA) */}
                {currentUser.role === 'USTA' && (
                    <div className="bg-slate-800/60 backdrop-blur border border-orange-500/20 p-5 rounded-2xl shadow-lg">
                        <div className="flex items-center gap-2 mb-3 text-orange-400">
                            <i className="fas fa-edit"></i>
                            <span className="text-xs font-bold uppercase">Yeni Talep Oluştur</span>
                        </div>
                        <form onSubmit={handleCreateRequest} className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition-colors"
                                placeholder="İhtiyacınızı yazın..."
                                value={newRequestContent}
                                onChange={e => setNewRequestContent(e.target.value)}
                            />
                            <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white w-12 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20 transition-transform active:scale-95">
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                )}

                {/* Request List */}
                <div className="space-y-3">
                    {requests.length === 0 ? (
                         <div className="text-center py-10 opacity-40">
                             <i className="fas fa-inbox text-4xl mb-2"></i>
                             <p className="text-sm">Talep kutusu boş</p>
                         </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-slate-800/40 border border-slate-700 p-4 rounded-2xl relative overflow-hidden group">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === RequestStatus.APPROVED ? 'bg-emerald-500' : req.status === RequestStatus.REJECTED ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-slate-300 bg-slate-900/50 px-2 py-0.5 rounded">{req.ustaName}</span>
                                        <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-200 text-sm font-medium mb-3">{req.content}</p>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            {req.status === RequestStatus.PENDING && <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1"><i className="fas fa-clock"></i> Bekliyor</span>}
                                            {req.status === RequestStatus.APPROVED && <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><i className="fas fa-check-circle"></i> Onaylandı</span>}
                                            {req.status === RequestStatus.REJECTED && <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><i className="fas fa-times-circle"></i> Reddedildi</span>}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            {currentUser.role === 'AMIR' && req.status === RequestStatus.PENDING && (
                                                <>
                                                    <button onClick={() => handleRequestAction(req.id, 'APPROVE')} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center border border-emerald-500/20"><i className="fas fa-check"></i></button>
                                                    <button onClick={() => handleRequestAction(req.id, 'REJECT')} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center border border-red-500/20"><i className="fas fa-times"></i></button>
                                                </>
                                            )}
                                            {(currentUser.role === 'AMIR' || (currentUser.role === 'USTA' && req.ustaName === currentUser.name)) && (
                                                <button onClick={() => handleRequestAction(req.id, 'DELETE')} className="w-8 h-8 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 transition-colors flex items-center justify-center"><i className="fas fa-trash-alt text-xs"></i></button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
        
        {/* TAB: CALENDAR */}
        {activeTab === 'calendar' && (
            <CalendarView 
                leaves={leaves}
                user={currentUser}
                onAddLeave={handleAddLeave}
                onDeleteLeave={handleDeleteLeave}
                onUpdateStatus={handleUpdateLeaveStatus}
            />
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
           <div className="space-y-6 pb-24 animate-in fade-in">
              <div className="relative bg-slate-800/60 backdrop-blur-xl p-8 rounded-3xl border border-white/5 text-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent"></div>
                  <div className="relative z-10">
                      <div className="w-24 h-24 bg-slate-900 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white border-4 border-slate-800 shadow-2xl">
                          {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" /> : currentUser.name[0]}
                      </div>
                      <h2 className="text-2xl font-black text-white">{currentUser.name}</h2>
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mt-1">{currentUser.role === 'AMIR' ? 'Saha Yöneticisi' : 'Teknik Uzman'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
                      <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                          <span className="block text-2xl font-black text-white">{tasks.filter(t => t.masterName === currentUser.name && t.status === TaskStatus.COMPLETED).length}</span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Biten İş</span>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                          <span className="block text-2xl font-black text-blue-400">{tasks.filter(t => t.masterName === currentUser.name && t.status === TaskStatus.IN_PROGRESS).length}</span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Aktif İş</span>
                      </div>
                  </div>
              </div>
              
              {/* Personnel Management (AMIR ONLY) */}
              {currentUser.role === 'AMIR' && (
               <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <i className="fas fa-users-cog text-blue-500"></i> Ekip Yönetimi
                    </h4>
                    
                    <div className="space-y-2 mb-6">
                        {[...amirList, ...ustaList].map(member => (
                            <div key={member.name} className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${member.password ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {member.name[0]}
                                    </div>
                                    <span className="text-sm font-bold text-slate-300">{member.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setRenameModal({show: true, oldName: member.name, role: amirList.includes(member) ? 'AMIR' : 'USTA'}); setRenameInput(member.name); }} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"><i className="fas fa-pen text-xs"></i></button>
                                    <button onClick={() => { setPasswordChangeModal({show: true, memberName: member.name, role: amirList.includes(member) ? 'AMIR' : 'USTA'}); setNewPasswordInput(member.password || ''); }} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"><i className="fas fa-key text-xs"></i></button>
                                    <button onClick={() => handleRemoveMember(member.name, amirList.includes(member) ? 'AMIR' : 'USTA')} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500 flex items-center justify-center"><i className="fas fa-trash-alt text-xs"></i></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Yeni Personel</p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="İsim" className="bg-slate-800 border-none rounded-lg p-2 text-xs text-white" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                                <input type="password" placeholder="Şifre" className="bg-slate-800 border-none rounded-lg p-2 text-xs text-white" value={newMemberPassword} onChange={e => setNewMemberPassword(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                 <select className="bg-slate-800 border-none rounded-lg p-2 text-xs text-white" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as any)}>
                                    <option value="USTA">Tekniker</option>
                                    <option value="AMIR">Yönetici</option>
                                </select>
                                <button onClick={handleAddMember} disabled={!newMemberName} className="bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500">EKLE</button>
                            </div>
                        </div>
                    </div>
               </div>
           )}
           
           <div className="flex flex-col gap-3 pt-8 pb-4 max-w-[200px] mx-auto">
               <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-lg shadow-black/20 flex items-center justify-center gap-2">
                   <i className="fas fa-user-times"></i> Oturumu Kapat
               </button>
               
               <button onClick={handleDisconnect} className="w-full py-3 rounded-xl border border-red-900/30 text-red-500 text-xs font-bold hover:bg-red-900/10 transition-colors flex items-center justify-center gap-2">
                   <i className="fas fa-unlink"></i> Gruptan Ayrıl
               </button>
               
               <p className="text-[9px] text-slate-600 text-center font-mono mt-1">Grup ID: {binId}</p>
           </div>
           </div>
        )}
        
        {/* Modals */}
        {renameModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl">
                    <h3 className="text-white font-bold mb-4">İsim Düzenle</h3>
                    <input type="text" value={renameInput} onChange={e => setRenameInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white mb-4 outline-none" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setRenameModal(null)} className="px-4 py-2 text-slate-400 font-bold text-sm">İptal</button>
                        <button onClick={handleRenameMember} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm">Kaydet</button>
                    </div>
                </div>
            </div>
        )}

        {passwordChangeModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl">
                    <h3 className="text-white font-bold mb-4">Şifre Değiştir</h3>
                    <input type="text" placeholder="Yeni Şifre" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white mb-4 outline-none" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setPasswordChangeModal(null)} className="px-4 py-2 text-slate-400 font-bold text-sm">İptal</button>
                        <button onClick={handlePasswordChange} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm">Kaydet</button>
                    </div>
                </div>
            </div>
        )}
    </Layout>
  );
};

export default App;