import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';
import CalendarView from './components/CalendarView';
import { Task, User, AppTab, Member, UstaRequest, LeaveRequest, RequestStatus, TaskPriority, TaskStatus } from './types';
import { fetchAppData, saveAppData, createNewBin, checkConnection, extractBinId, getStoredBinId, setStoredBinId } from './services/dbService';

// Otomatik bağlanılacak demo ID (Firebase üzerinde)
const AUTO_CONNECT_ID = 'demo_kanal_v1';
// Yerel depolamada yetkilendirme anahtarı
const LOCAL_KEY_AUTH = 'hidro_auth';

const App: React.FC = () => {
  // App Data State
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

  // Personnel Management State
  const [renameModal, setRenameModal] = useState<{show: boolean, oldName: string, role: 'AMIR'|'USTA'} | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [passwordChangeModal, setPasswordChangeModal] = useState<{show: boolean, memberName: string, role: 'AMIR'|'USTA'} | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  
  // New Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'AMIR'|'USTA'>('USTA');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Login State
  const [loginInput, setLoginInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const amirList = amirs;
  const ustaList = ustas;

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
      // 1. Otomatik Login Kontrolü
      const storedAuth = localStorage.getItem(LOCAL_KEY_AUTH);
      if (storedAuth) {
          try {
              const authUser = JSON.parse(storedAuth);
              if (authUser && authUser.name && authUser.role) {
                  setCurrentUser(authUser);
              }
          } catch (e) {
              console.error("Auto login parse error", e);
          }
      }

      // 2. Bağlantı ID Kontrolü
      let currentId = getStoredBinId();
      
      // Eğer kayıtlı ID yoksa Demo ID'yi dene
      if (!currentId) {
          currentId = AUTO_CONNECT_ID;
      }

      // Bağlantıyı Test Et ve Verileri Çek
      if (currentId) {
          const isValid = await checkConnection(currentId);
          if (isValid) {
              setStoredBinId(currentId);
              setBinId(currentId);
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
      } catch (e) {
          console.error("Data loading error", e);
      }
  };

  const saveAll = async () => {
      if (!binId) return;
      await saveAppData({
          tasks,
          requests,
          leaves,
          amirs,
          ustas,
          deletedTasks
      }, binId);
  };
  
  // Auto-save when critical data changes
  useEffect(() => {
      if(currentUser && binId) {
          const timer = setTimeout(saveAll, 1000);
          return () => clearTimeout(timer);
      }
  }, [tasks, requests, leaves, amirs, ustas, deletedTasks]);

  // Personnel Handlers
  const handleAddMember = () => {
      if (!newMemberName.trim()) return;
      
      const newMember: Member = {
          name: newMemberName.trim(),
          password: newMemberPassword.trim(),
          phoneNumber: newMemberPhone.trim(),
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newMemberName)}&background=random`
      };

      if (newMemberRole === 'AMIR') {
          setAmirs([...amirs, newMember]);
      } else {
          setUstas([...ustas, newMember]);
      }

      setNewMemberName('');
      setNewMemberPassword('');
      setNewMemberPhone('');
  };

  const handleRemoveMember = (name: string, role: 'AMIR'|'USTA') => {
      if (!window.confirm(`${name} isimli kullanıcı silinecek. Emin misiniz?`)) return;
      
      if (role === 'AMIR') {
          setAmirs(amirs.filter(m => m.name !== name));
      } else {
          setUstas(ustas.filter(m => m.name !== name));
      }
  };

  const handleRenameMember = () => {
      if (!renameModal || !renameInput.trim()) return;
      
      const updateList = (list: Member[]) => list.map(m => m.name === renameModal.oldName ? { ...m, name: renameInput.trim() } : m);
      
      if (renameModal.role === 'AMIR') setAmirs(updateList(amirs));
      else setUstas(updateList(ustas));
      
      setRenameModal(null);
      setRenameInput('');
  };

  const handlePasswordChange = () => {
      if (!passwordChangeModal) return;
      
      const updateList = (list: Member[]) => list.map(m => m.name === passwordChangeModal.memberName ? { ...m, password: newPasswordInput.trim() } : m);
      
      if (passwordChangeModal.role === 'AMIR') setAmirs(updateList(amirs));
      else setUstas(updateList(ustas));
      
      setPasswordChangeModal(null);
      setNewPasswordInput('');
  };

  // Task Handlers
  const handleTaskMarkSeen = (taskId: string) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, seenAt: Date.now() } : t));
  };

  const handleTaskStatusChange = (taskId: string, status: TaskStatus) => {
      setTasks(tasks.map(t => {
          if (t.id !== taskId) return t;
          const updates: Partial<Task> = { status };
          if (status === TaskStatus.IN_PROGRESS) updates.startedAt = Date.now();
          if (status === TaskStatus.COMPLETED) updates.completedAt = Date.now();
          return { ...t, ...updates };
      }));
  };

  const handleTaskDelete = (taskId: string) => {
      if (!window.confirm("Bu görev silinecek?")) return;
      const task = tasks.find(t => t.id === taskId);
      if (task) {
          setDeletedTasks([...deletedTasks, { ...task, deletedAt: Date.now() }]);
          setTasks(tasks.filter(t => t.id !== taskId));
      }
  };
  
  const handleTaskComment = (taskId: string, comment: string) => {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, comments: (t.comments ? t.comments + '\n' : '') + comment } : t));
  };

  // Leave Handlers
  const handleAddLeave = (start: string, end: string, reason: string) => {
      if (!currentUser) return;
      
      // Gün sayısını hesapla
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 

      const newLeave: LeaveRequest = {
          id: Math.random().toString(36).substr(2, 9),
          ustaName: currentUser.name,
          startDate: start,
          endDate: end,
          daysCount: diffDays,
          reason,
          status: RequestStatus.PENDING,
          createdAt: Date.now()
      };
      setLeaves([...leaves, newLeave]);
  };

  const handleUpdateLeaveStatus = (id: string, status: RequestStatus) => {
      setLeaves(leaves.map(l => l.id === id ? { ...l, status } : l));
  };

  const handleDeleteLeave = (id: string) => {
      if(window.confirm("Bu izin talebi silinecek?")) {
        setLeaves(leaves.filter(l => l.id !== id));
      }
  };

  // Login Logic
  const handleLogin = (user: Member, role: 'AMIR' | 'USTA') => {
      const loggedUser: User = {
          id: user.name, // using name as id for simplicity
          name: user.name,
          role,
          avatar: user.avatar
      };
      setCurrentUser(loggedUser);
      // Beni Hatırla (Varsayılan olarak aktif ettik ki kullanım kolay olsun)
      localStorage.setItem(LOCAL_KEY_AUTH, JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem(LOCAL_KEY_AUTH);
  };

  const handleConnect = async () => {
      setConnectionStatus('checking');
      const id = extractBinId(loginInput);
      if (!id) {
          setConnectionStatus('error');
          return;
      }
      
      const isValid = await checkConnection(id);
      if (isValid) {
          setStoredBinId(id);
          setBinId(id);
          setConnectionStatus('connected');
          await loadData(id);
      } else {
          setConnectionStatus('error');
      }
  };

  const handleCreateGroup = async () => {
      const defaultAmirs: Member[] = [{ name: 'Yönetici', password: '123' }];
      const defaultUstas: Member[] = [];
      const newId = await createNewBin(defaultAmirs, defaultUstas);
      if (newId) {
          setStoredBinId(newId);
          setBinId(newId);
          await loadData(newId);
          alert(`Yeni Grup Oluşturuldu! ID: ${newId}`);
      } else {
          alert('Grup oluşturulamadı.');
      }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500">
      <i className="fas fa-circle-notch fa-spin text-3xl"></i>
  </div>;

  if (!currentUser) {
      // Connect Screen
      if (!binId) {
          return (
              <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 space-y-6">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-600/30">
                          <i className="fas fa-link text-3xl text-white"></i>
                      </div>
                      <h1 className="text-2xl font-black text-white">Hidrolik Takip</h1>
                      <p className="text-slate-400 text-sm mt-2">Devam etmek için bir grup ID girin veya yeni oluşturun.</p>
                  </div>
                  
                  <div className="w-full max-w-sm space-y-3">
                      <input 
                          type="text" 
                          placeholder="Grup ID veya Linki" 
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-colors"
                          value={loginInput}
                          onChange={(e) => setLoginInput(e.target.value)}
                      />
                      <button 
                          onClick={handleConnect}
                          disabled={!loginInput || connectionStatus === 'checking'}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-bold transition-all shadow-lg shadow-blue-900/20"
                      >
                          {connectionStatus === 'checking' ? 'Kontrol Ediliyor...' : 'Bağlan'}
                      </button>
                      
                      {connectionStatus === 'error' && <p className="text-red-400 text-xs text-center">Bağlantı başarısız. ID hatalı olabilir.</p>}
                      
                      <div className="relative py-4">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">veya</span></div>
                      </div>
                      
                      <button 
                          onClick={handleCreateGroup}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl py-4 font-bold transition-all border border-slate-700"
                      >
                          Yeni Grup Oluştur
                      </button>
                  </div>
              </div>
          );
      }

      // Login Screen
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
               <button onClick={() => { setBinId(''); setStoredBinId(''); }} className="absolute top-4 left-4 text-slate-500 hover:text-white">
                   <i className="fas fa-arrow-left"></i> Çıkış
               </button>
               <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 ring-4 ring-white/5">
                   <img src="https://cdn-icons-png.flaticon.com/512/3652/3652191.png" className="w-8 h-8 opacity-80" />
               </div>
               <h2 className="text-xl font-bold text-white mb-6">Kullanıcı Seçin</h2>
               
               <div className="w-full max-w-sm space-y-4">
                   {/* Amirs */}
                   <div className="space-y-2">
                       <p className="text-xs font-bold text-slate-500 uppercase ml-1">Yöneticiler</p>
                       {amirs.map(m => (
                           <button key={m.name} onClick={() => handleLogin(m, 'AMIR')} className="w-full flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors group">
                               <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-500/30 text-blue-400 font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                   {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover rounded-full" /> : m.name[0]}
                               </div>
                               <span className="text-slate-200 font-bold">{m.name}</span>
                           </button>
                       ))}
                       {amirs.length === 0 && <p className="text-xs text-slate-600 pl-2">Yönetici bulunamadı.</p>}
                   </div>
                   
                   {/* Ustas */}
                   <div className="space-y-2">
                       <p className="text-xs font-bold text-slate-500 uppercase ml-1">Teknik Personel</p>
                       {ustas.map(m => (
                           <button key={m.name} onClick={() => handleLogin(m, 'USTA')} className="w-full flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-emerald-500 transition-colors group">
                               <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30 text-emerald-400 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                   {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover rounded-full" /> : m.name[0]}
                               </div>
                               <span className="text-slate-200 font-bold">{m.name}</span>
                           </button>
                       ))}
                       {ustas.length === 0 && <p className="text-xs text-slate-600 pl-2">Personel bulunamadı.</p>}
                   </div>
               </div>
          </div>
      );
  }

  // Helper to filter tasks based on user role and tab
  const getDisplayTasks = () => {
      // Sort: Priority (Critical first), then Date (Newest first)
      const priorityOrder = { [TaskPriority.CRITICAL]: 0, [TaskPriority.HIGH]: 1, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 3 };
      
      let filtered = [...tasks].sort((a, b) => {
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
              return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return b.createdAt - a.createdAt;
      });

      return filtered;
  };

  return (
    <Layout 
        user={currentUser} 
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
    >
        {activeTab === 'tasks' && (
            <div className="space-y-2 pb-20">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-slate-100">Görev Listesi</h2>
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{tasks.filter(t => t.status !== TaskStatus.COMPLETED).length} Aktif</span>
                </div>
                {getDisplayTasks().length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        <i className="fas fa-clipboard-check text-4xl mb-3 opacity-20"></i>
                        <p>Görev bulunmuyor</p>
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
        )}
        
        {activeTab === 'calendar' && (
            <CalendarView 
                leaves={leaves}
                user={currentUser}
                onAddLeave={handleAddLeave}
                onDeleteLeave={handleDeleteLeave}
                onUpdateStatus={handleUpdateLeaveStatus}
            />
        )}

        {activeTab === 'profile' && (
           <div className="space-y-6 pb-20">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10"></div>
                  <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-slate-300 border-4 border-slate-800 shadow-xl relative z-10">
                      {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" /> : currentUser.name[0]}
                  </div>
                  <h2 className="text-xl font-black text-white relative z-10">{currentUser.name}</h2>
                  <p className="text-blue-500 text-xs font-bold uppercase tracking-wider relative z-10">{currentUser.role === 'AMIR' ? 'Yönetici' : 'Teknik Personel'}</p>
                  
                  <div className="mt-4 flex justify-center gap-4 relative z-10">
                      <div className="bg-slate-900/50 px-4 py-2 rounded-xl">
                          <span className="block text-lg font-bold text-white">{tasks.filter(t => t.masterName === currentUser.name && t.status === TaskStatus.COMPLETED).length}</span>
                          <span className="text-[10px] text-slate-500 uppercase">Tamamlanan</span>
                      </div>
                      <div className="bg-slate-900/50 px-4 py-2 rounded-xl">
                          <span className="block text-lg font-bold text-white">{tasks.filter(t => t.masterName === currentUser.name && t.status === TaskStatus.IN_PROGRESS).length}</span>
                          <span className="text-[10px] text-slate-500 uppercase">Devam Eden</span>
                      </div>
                  </div>
              </div>
              
              {/* Personel Yönetimi (SADECE AMİR GÖREBİLİR) */}
              {currentUser.role === 'AMIR' && (
               <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <i className="fas fa-users-cog text-blue-500"></i> Personel Yönetimi
                    </h4>
                    
                    <div className="space-y-2 mb-4">
                        {/* Amir Listesi */}
                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Yöneticiler</div>
                        {amirList.map(member => (
                            <div key={member.name} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-500/30 overflow-hidden">
                                        {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-blue-400">{member.name[0]}</span>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-300">{member.name}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setRenameModal({show: true, oldName: member.name, role: 'AMIR'}); setRenameInput(member.name); }} className="text-slate-500 hover:text-blue-400 transition-colors">
                                        <i className="fas fa-pen text-xs"></i>
                                    </button>
                                    <button onClick={() => { setPasswordChangeModal({show: true, memberName: member.name, role: 'AMIR'}); setNewPasswordInput(member.password || ''); }} className="text-slate-500 hover:text-blue-400 transition-colors">
                                        <i className="fas fa-key text-xs"></i>
                                    </button>
                                    <button onClick={() => handleRemoveMember(member.name, 'AMIR')} className="text-slate-500 hover:text-red-400 transition-colors">
                                        <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Usta Listesi */}
                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Teknik Personel</div>
                        {ustaList.map(member => (
                            <div key={member.name} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-500/30 overflow-hidden">
                                         {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-emerald-400">{member.name[0]}</span>}
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-300 block">{member.name}</span>
                                        {member.phoneNumber && <span className="text-[9px] text-slate-500 block"><i className="fab fa-whatsapp"></i> {member.phoneNumber}</span>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-auto">
                                    {/* KONUM GÖRÜNTÜLEME BUTONU */}
                                    {member.latitude && member.longitude && (
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${member.latitude},${member.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-2 py-1 bg-blue-900/20 text-blue-400 border border-blue-900/30 rounded text-[9px] font-bold hover:bg-blue-900/40 flex items-center gap-1 mr-1"
                                        >
                                            <i className="fas fa-map-marker-alt"></i> Konum
                                        </a>
                                    )}

                                    <button onClick={() => { setRenameModal({show: true, oldName: member.name, role: 'USTA'}); setRenameInput(member.name); }} className="text-slate-500 hover:text-blue-400 transition-colors">
                                        <i className="fas fa-pen text-xs"></i>
                                    </button>
                                    <button onClick={() => { setPasswordChangeModal({show: true, memberName: member.name, role: 'USTA'}); setNewPasswordInput(member.password || ''); }} className="text-slate-500 hover:text-blue-400 transition-colors">
                                        <i className="fas fa-key text-xs"></i>
                                    </button>
                                    <button onClick={() => handleRemoveMember(member.name, 'USTA')} className="text-slate-500 hover:text-red-400 transition-colors">
                                        <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Yeni Ekleme Formu */}
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Yeni Personel Ekle</p>
                        <div className="space-y-2">
                            <input 
                                type="text" 
                                placeholder="İsim Soyisim" 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    placeholder="Şifre (Opsiyonel)" 
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                                    value={newMemberPassword}
                                    onChange={(e) => setNewMemberPassword(e.target.value)}
                                />
                                <select 
                                    className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white outline-none"
                                    value={newMemberRole}
                                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                                >
                                    <option value="USTA">Usta</option>
                                    <option value="AMIR">Amir</option>
                                </select>
                            </div>
                             <input 
                                type="tel" 
                                placeholder="Telefon (5XX...) - Whatsapp için" 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                                value={newMemberPhone}
                                onChange={(e) => setNewMemberPhone(e.target.value)}
                            />
                            <button 
                                onClick={handleAddMember}
                                disabled={!newMemberName}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                <i className="fas fa-plus mr-1"></i> Ekle
                            </button>
                        </div>
                    </div>
               </div>
           )}
           
           <div className="text-center pt-8">
               <button onClick={() => { setBinId(''); setStoredBinId(''); handleLogout(); }} className="text-xs text-red-500 hover:text-red-400 underline">Gruptan Ayrıl</button>
           </div>
           </div>
        )}
        
        {/* Modals for Rename and Password Change */}
        {renameModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700">
                    <h3 className="text-white font-bold mb-4">İsim Değiştir</h3>
                    <input 
                        type="text" 
                        value={renameInput} 
                        onChange={e => setRenameInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4 outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setRenameModal(null)} className="px-4 py-2 text-slate-400 hover:text-white">İptal</button>
                        <button onClick={handleRenameMember} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Kaydet</button>
                    </div>
                </div>
            </div>
        )}

        {passwordChangeModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700">
                    <h3 className="text-white font-bold mb-4">Şifre Değiştir: <span className="text-blue-400">{passwordChangeModal.memberName}</span></h3>
                    <input 
                        type="text" 
                        placeholder="Yeni Şifre"
                        value={newPasswordInput} 
                        onChange={e => setNewPasswordInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4 outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setPasswordChangeModal(null)} className="px-4 py-2 text-slate-400 hover:text-white">İptal</button>
                        <button onClick={handlePasswordChange} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Kaydet</button>
                    </div>
                </div>
            </div>
        )}
    </Layout>
  );
};

export default App;