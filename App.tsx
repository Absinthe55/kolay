
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task, User, TaskStatus, TaskPriority, Member, UstaRequest, RequestStatus } from './types';
import { fetchAppData, saveAppData, createNewBin, getStoredBinId, setStoredBinId, extractBinId, checkConnection } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';

// Varsayılan listeler (İlk kurulum veya yerel mod için)
const DEFAULT_AMIRS: Member[] = [
    { name: 'Birim Amiri ERKAN ÇİLİNGİR' }, 
    { name: 'Vardiya Amiri Selçuk' }, 
    { name: 'Birim Amiri Volkan' }
];
const DEFAULT_USTAS: Member[] = [
    { name: 'Usta Ahmet' }, 
    { name: 'Usta Mehmet' }, 
    { name: 'Usta Can' }, 
    { name: 'Usta Serkan' }, 
    { name: 'Usta Osman' }, 
    { name: 'Usta İbrahim' }
];

// Otomatik bağlanılacak Npoint adresi
const AUTO_CONNECT_URL = 'https://www.npoint.io/docs/c85115e1d1b4c3276a86';
// Yerel depolamada yetkilendirme anahtarı
const LOCAL_KEY_AUTH = 'hidro_auth';
// Bildirim sesi (Kısa bip sesi)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<UstaRequest[]>([]);
  const [amirList, setAmirList] = useState<Member[]>(DEFAULT_AMIRS);
  const [ustaList, setUstaList] = useState<Member[]>(DEFAULT_USTAS);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile' | 'requests'>('tasks');
  const [connectionId, setConnectionId] = useState(getStoredBinId());
  
  // Personel Yönetimi State'leri
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'AMIR' | 'USTA'>('USTA');

  // Şifre Değiştirme Modal State
  const [passwordChangeModal, setPasswordChangeModal] = useState<{show: boolean, memberName: string, role: 'AMIR' | 'USTA'} | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Login State
  const [loginModal, setLoginModal] = useState<{show: boolean, member: Member | null, role: 'AMIR' | 'USTA'} | null>(null);
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginRememberMe, setLoginRememberMe] = useState(false);

  // Task Form State
  const [newTaskMachine, setNewTaskMachine] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskMaster, setNewTaskMaster] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newTaskImage, setNewTaskImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request Form State
  const [newRequestContent, setNewRequestContent] = useState('');

  // Bildirim Takibi için Ref (Son bilinen görev ID'leri)
  const lastTaskIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Wake Lock (Ekranı Açık Tutma) State
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // Wake Lock Fonksiyonu
  const toggleWakeLock = async () => {
    if (wakeLock) {
      // Kapat
      await wakeLock.release();
      setWakeLock(null);
    } else {
      // Aç
      if ('wakeLock' in navigator) {
        try {
          const sentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLock(sentinel);
          sentinel.addEventListener('release', () => {
            setWakeLock(null);
          });
        } catch (err) {
          console.error("Ekran açık tutma hatası:", err);
          alert("Ekran açık tutma özelliği bu cihazda desteklenmiyor veya engellendi.");
        }
      } else {
        alert("Tarayıcınız bu özelliği desteklemiyor.");
      }
    }
  };

  // Bildirim İzni İsteme Fonksiyonu
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("Bu tarayıcı bildirimleri desteklemiyor.");
      return;
    }
    
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Test bildirimi
        new Notification("Bildirimler Aktif", { 
            body: "Yeni görev verildiğinde haber vereceğiz.",
            icon: "https://cdn-icons-png.flaticon.com/512/3652/3652191.png"
        });
      }
    } else {
        alert("Bildirim izni zaten verilmiş.");
    }
  };

  // Bildirim Gönderme Fonksiyonu
  const sendNotification = (title: string, body: string) => {
      if (Notification.permission === 'granted') {
          // Titreşim (Mobil için)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

          // Ses
          const audio = new Audio(NOTIFICATION_SOUND);
          audio.volume = 1.0;
          audio.play().catch(e => console.log("Ses çalınamadı:", e));

          // Görsel Bildirim
          new Notification(title, { 
              body: body,
              icon: "https://cdn-icons-png.flaticon.com/512/10337/10337229.png" // İş/Tamir ikonu
          });
      }
  };

  // Veri Yükleme
  const loadData = useCallback(async (forceId?: string) => {
    setLoading(true);
    const targetId = forceId || connectionId;
    const data = await fetchAppData(targetId);
    
    setTasks(data.tasks);
    setRequests(data.requests);
    
    // İlk yüklemede mevcut ID'leri kaydet ki bildirim gitmesin
    if (isFirstLoadRef.current && data.tasks.length > 0) {
        data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
        isFirstLoadRef.current = false;
    }

    if (data.amirs && data.amirs.length > 0) setAmirList(data.amirs);
    if (data.ustas && data.ustas.length > 0) setUstaList(data.ustas);
    
    setLoading(false);
  }, [connectionId]);

  // Otomatik Bağlantı, Periyodik Güncelleme ve Bildirim Kontrolü
  useEffect(() => {
    // 1. İlk açılışta veri yükle
    loadData();

    // 2. Otomatik Login Kontrolü
    const storedAuth = localStorage.getItem(LOCAL_KEY_AUTH);
    if (storedAuth) {
      try {
        const authUser = JSON.parse(storedAuth);
        if (authUser && authUser.name && authUser.role) {
          setCurrentUser(authUser);
        }
      } catch (e) {
        console.error("Auto login error", e);
      }
    }

    // 3. Anında otomatik bağlantı kontrolü
    const initAutoConnect = async () => {
       const currentId = getStoredBinId();
       if (!currentId) {
          const autoId = extractBinId(AUTO_CONNECT_URL);
          const isValid = await checkConnection(autoId);
          if (isValid) {
             setStoredBinId(autoId);
             setConnectionId(autoId);
             const data = await fetchAppData(autoId);
             setTasks(data.tasks);
             setRequests(data.requests);
             // İlk yükleme olduğu için ID'leri sete at
             data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
             isFirstLoadRef.current = false;

             if (data.amirs.length > 0) setAmirList(data.amirs);
             if (data.ustas.length > 0) setUstaList(data.ustas);
          }
       }
    };
    initAutoConnect();

    // 4. Periyodik güncelleme ve Bildirim Kontrolü
    const interval = setInterval(() => {
      if (connectionId) {
        fetchAppData(connectionId).then(data => {
            // State güncelle
            setTasks(data.tasks);
            setRequests(data.requests);
            if (data.amirs.length > 0) setAmirList(data.amirs);
            if (data.ustas.length > 0) setUstaList(data.ustas);

            // BİLDİRİM MANTIĞI
            if (currentUser) {
                data.tasks.forEach(task => {
                    // Eğer bu görev daha önce görülmemişse (Yeni ise)
                    if (!lastTaskIdsRef.current.has(task.id)) {
                        
                        // 1. Durum: Ben USTAYIM ve görev BANA atanmış
                        if (currentUser.role === 'USTA' && task.masterName === currentUser.name) {
                            sendNotification(
                                "🛠️ YENİ GÖREV!", 
                                `${task.machineName} makinesinde yeni iş emriniz var.`
                            );
                        }
                        // 2. Durum: Ben AMİRİM, sisteme herhangi bir görev eklendi
                        else if (currentUser.role === 'AMIR') {
                             // Amir opsiyonel bildirim
                        }

                        // ID'yi listeye ekle
                        lastTaskIdsRef.current.add(task.id);
                    }
                });
            } else {
                 data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
            }
        });
      }
    }, 5000); 

    // Sayfa görünür olduğunda (arkaplansan dönünce) hemen veri çek
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            loadData();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionId, loadData, currentUser]); 

  const handleLoginClick = (member: Member, role: 'AMIR' | 'USTA') => {
      if (member.password && member.password.trim() !== '') {
          setLoginModal({ show: true, member, role });
          setLoginPasswordInput('');
          setLoginError(false);
          setLoginRememberMe(false);
      } else {
          performLogin(member.name, role, false);
      }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginModal || !loginModal.member) return;

      if (loginPasswordInput === loginModal.member.password) {
          performLogin(loginModal.member.name, loginModal.role, loginRememberMe);
          setLoginModal(null);
      } else {
          setLoginError(true);
          setLoginPasswordInput('');
      }
  };

  const performLogin = (name: string, role: 'AMIR' | 'USTA', remember: boolean) => {
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      role
    };
    setCurrentUser(user);

    if (remember) {
      localStorage.setItem(LOCAL_KEY_AUTH, JSON.stringify(user));
    }
    
    // Giriş yapınca hemen izin iste
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_KEY_AUTH);
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

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    
    setLoading(true);
    let newAmirs = [...amirList];
    let newUstas = [...ustaList];

    // Telefon numarasını temizle (başında 0 varsa sil, boşlukları sil)
    let cleanedPhone = newMemberPhone.trim();
    if (cleanedPhone) {
        cleanedPhone = cleanedPhone.replace(/\D/g, ''); // Sadece rakamlar
        if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.substring(1);
        if (cleanedPhone.length === 10) cleanedPhone = '90' + cleanedPhone;
    }

    const newMember: Member = {
        name: newMemberName.trim(),
        password: newMemberPassword.trim() || undefined,
        phoneNumber: cleanedPhone || undefined
    };

    if (newMemberRole === 'AMIR') {
        newAmirs.push(newMember);
        setAmirList(newAmirs);
    } else {
        newUstas.push(newMember);
        setUstaList(newUstas);
    }

    await saveAppData({ tasks, requests, amirs: newAmirs, ustas: newUstas }, connectionId);
    setNewMemberName('');
    setNewMemberPassword('');
    setNewMemberPhone('');
    setLoading(false);
    alert(`${newMember.name} listeye eklendi.`);
  };

  const handleRemoveMember = async (name: string, role: 'AMIR' | 'USTA') => {
      if(!confirm(`${name} kullanıcısını silmek istediğinize emin misiniz?`)) return;

      setLoading(true);
      let newAmirs = [...amirList];
      let newUstas = [...ustaList];

      if (role === 'AMIR') {
          newAmirs = newAmirs.filter(a => a.name !== name);
          setAmirList(newAmirs);
      } else {
          newUstas = newUstas.filter(u => u.name !== name);
          setUstaList(newUstas);
      }
      
      await saveAppData({ tasks, requests, amirs: newAmirs, ustas: newUstas }, connectionId);
      setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeModal) return;

    setLoading(true);
    let newAmirs = [...amirList];
    let newUstas = [...ustaList];

    const updateList = (list: Member[]) => list.map(m => {
        if (m.name === passwordChangeModal.memberName) {
            return { ...m, password: newPasswordInput.trim() || undefined };
        }
        return m;
    });

    if (passwordChangeModal.role === 'AMIR') {
        newAmirs = updateList(newAmirs);
        setAmirList(newAmirs);
    } else {
        newUstas = updateList(newUstas);
        setUstaList(newUstas);
    }

    await saveAppData({ tasks, requests, amirs: newAmirs, ustas: newUstas }, connectionId);
    setLoading(false);
    setPasswordChangeModal(null);
    setNewPasswordInput('');
    alert("Şifre güncellendi.");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setNewTaskImage(compressedBase64);
        setLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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
      image: newTaskImage || undefined
    };

    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    // Kendi oluşturduğumuz görevi bildirim listesine ekle ki bize bildirim gelmesin (zaten biz oluşturduk)
    lastTaskIdsRef.current.add(newTask.id);
    
    setLoading(true);
    await saveAppData({ tasks: updatedTasks, requests, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
    
    // WHATSAPP ENTEGRASYONU
    const assignedUsta = ustaList.find(u => u.name === newTaskMaster);
    if (assignedUsta && assignedUsta.phoneNumber) {
        // Whatsapp Link Oluşturma
        const message = `*🔧 YENİ HİDROLİK GÖREVİ*\n\n*Makine:* ${newTaskMachine}\n*Öncelik:* ${newTaskPriority}\n*İş Emri:* ${newTaskDescription}\n\nLütfen HidroGörev uygulamasından onaylayınız.`;
        const waUrl = `https://wa.me/${assignedUsta.phoneNumber}?text=${encodeURIComponent(message)}`;
        
        // Kullanıcıya sor veya direkt aç (Mobil tarayıcılarda pop-up engelleyici olabilir, bu yüzden confirm kullanıyoruz)
        if(confirm(`${newTaskMaster} adlı ustaya WhatsApp bildirimi gönderilsin mi?`)) {
            window.open(waUrl, '_blank');
        }
    } else {
        alert("Görev yayınlandı. (Ustanın telefon numarası kayıtlı olmadığı için WhatsApp açılmadı)");
    }
    
    setNewTaskMachine('');
    setNewTaskDescription('');
    setNewTaskMaster('');
    setNewTaskImage(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('tasks');
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, comment?: string, completedImage?: string) => {
    setLoading(true);
    const now = Date.now();

    const updatedTasks = tasks.map(t => {
        if (t.id === taskId) {
            return {
              ...t,
              status: newStatus,
              comments: comment || t.comments,
              startedAt: newStatus === TaskStatus.IN_PROGRESS ? (t.startedAt || now) : t.startedAt,
              completedAt: newStatus === TaskStatus.COMPLETED ? now : t.completedAt,
              completedImage: completedImage || t.completedImage
            };
        }
        return t;
    });
    
    setTasks(updatedTasks);
    await saveAppData({ tasks: updatedTasks, requests, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("BU GÖREV KALICI OLARAK SİLİNECEK.\n\nEmin misiniz?")) return;

    setLoading(true);
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await saveAppData({ tasks: updatedTasks, requests, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
  };

  // USTA TALEP OLUŞTURMA
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestContent.trim() || !currentUser) return;

    const newRequest: UstaRequest = {
      id: Date.now().toString(),
      ustaName: currentUser.name,
      content: newRequestContent,
      status: RequestStatus.PENDING,
      createdAt: Date.now()
    };

    const updatedRequests = [newRequest, ...requests];
    setRequests(updatedRequests);
    
    setLoading(true);
    await saveAppData({ tasks, requests: updatedRequests, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
    
    setNewRequestContent('');
    alert("Talebiniz yöneticiye iletildi.");
  };

  // TALEP DURUM GÜNCELLEME (AMİR)
  const handleRequestStatus = async (reqId: string, status: RequestStatus) => {
    setLoading(true);
    const updatedRequests = requests.map(r => {
        if (r.id === reqId) {
            return { ...r, status };
        }
        return r;
    });
    setRequests(updatedRequests);
    await saveAppData({ tasks, requests: updatedRequests, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
  };

  // TALEP SİLME (AMİR veya USTA (Pending ise))
  const handleDeleteRequest = async (reqId: string) => {
      if(!confirm("Bu talebi silmek istediğinize emin misiniz?")) return;
      setLoading(true);
      const updatedRequests = requests.filter(r => r.id !== reqId);
      setRequests(updatedRequests);
      await saveAppData({ tasks, requests: updatedRequests, amirs: amirList, ustas: ustaList }, connectionId);
      setLoading(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white overflow-y-auto relative">
        <div className="w-full max-w-sm animate-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-6 rounded-[2rem] shadow-[0_0_40px_rgba(37,99,235,0.3)] mb-6 ring-4 ring-white/10">
              <i className="fas fa-oil-can text-5xl text-white drop-shadow-md"></i>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">HidroGörev</h1>
            <p className="text-slate-400 mt-2 text-center text-sm font-medium tracking-wide">Fabrika Hidrolik Takip Sistemi</p>
          </div>
          
          <div className="space-y-6 bg-white/5 backdrop-blur-lg p-6 rounded-3xl border border-white/10 shadow-2xl">
            {/* Login bölümleri... */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                 <h2 className="text-xs font-bold text-blue-200 uppercase tracking-widest">Yönetim</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {amirList.map(member => (
                  <button key={member.name} onClick={() => handleLoginClick(member, 'AMIR')} className="group relative bg-slate-800/50 hover:bg-blue-600 border border-white/5 p-4 rounded-2xl text-left font-bold transition-all duration-300 flex justify-between items-center overflow-hidden">
                    <div className="absolute inset-0 bg-blue-400/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <span className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <i className="fas fa-user-tie text-blue-400 group-hover:text-white/80"></i>
                        {member.name}
                        {member.password && <i className="fas fa-lock text-[10px] text-slate-500 group-hover:text-white/50"></i>}
                    </span>
                    <i className="fas fa-arrow-right text-slate-600 group-hover:text-white relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"></i>
                  </button>
                ))}
              </div>
            </section>
            
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <section>
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                 <h2 className="text-xs font-bold text-emerald-200 uppercase tracking-widest">Saha Ekibi</h2>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {ustaList.map(member => (
                  <button key={member.name} onClick={() => handleLoginClick(member, 'USTA')} className="group relative bg-slate-800/50 hover:bg-emerald-600 border border-white/5 p-4 rounded-2xl text-left font-bold transition-all duration-300 flex justify-between items-center overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-400/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <span className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <i className="fas fa-wrench text-emerald-400 group-hover:text-white/80"></i>
                        {member.name}
                        {member.password && <i className="fas fa-lock text-[10px] text-slate-500 group-hover:text-white/50"></i>}
                    </span>
                    <i className="fas fa-arrow-right text-slate-600 group-hover:text-white relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"></i>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-6 font-mono">v1.3 &bull; Güvenli Bağlantı</p>
        </div>

        {/* Login Password Modal */}
        {loginModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-xs shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden border border-slate-700">
                     <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner border border-blue-800/30">
                            <i className="fas fa-lock text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-black text-slate-100">Şifre Giriniz</h3>
                        <p className="text-sm text-slate-400 font-medium">{loginModal.member?.name}</p>
                    </div>

                    <form onSubmit={handleLoginSubmit}>
                        <input 
                            type="password" 
                            autoFocus
                            placeholder="****" 
                            className={`w-full text-center text-2xl tracking-widest font-bold p-4 rounded-2xl bg-slate-900 border-2 outline-none transition-all mb-4 text-white placeholder:text-slate-600 ${loginError ? 'border-red-500 bg-red-900/20 text-red-200' : 'border-slate-700 focus:border-blue-500'}`}
                            value={loginPasswordInput}
                            onChange={(e) => setLoginPasswordInput(e.target.value)}
                        />
                        {loginError && <p className="text-center text-xs font-bold text-red-400 mb-4 animate-pulse">Hatalı şifre, tekrar deneyin.</p>}

                        <div className="flex items-center justify-center gap-3 mb-6 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                            <input 
                                type="checkbox" 
                                id="rememberMe" 
                                className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-800 cursor-pointer"
                                checked={loginRememberMe}
                                onChange={(e) => setLoginRememberMe(e.target.checked)}
                            />
                            <label htmlFor="rememberMe" className="text-sm text-slate-300 font-bold cursor-pointer select-none">Beni Hatırla (Otomatik Giriş)</label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => { setLoginModal(null); setLoginError(false); }} className="py-3 rounded-xl font-bold text-sm text-slate-400 bg-slate-700 hover:bg-slate-600 hover:text-white transition-colors">
                                Vazgeç
                            </button>
                            <button type="submit" className="py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/50">
                                Giriş Yap
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    );
  }

  const filteredTasks = currentUser.role === 'USTA' 
    ? tasks.filter(t => t.masterName === currentUser.name)
    : tasks;

  // Talepleri filtrele: Usta ise sadece kendininkileri, Amir ise hepsini görsün.
  const filteredRequests = currentUser.role === 'USTA'
    ? requests.filter(r => r.ustaName === currentUser.name)
    : requests;

  const isErkan = currentUser.name === 'Birim Amiri ERKAN ÇİLİNGİR';

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className={`px-4 py-2 mb-6 rounded-full text-[10px] font-bold flex justify-center items-center shadow-sm mx-auto w-fit transition-colors ${connectionId ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
        <span className="flex items-center gap-1.5">
           <span className={`w-2 h-2 rounded-full ${connectionId ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
           {connectionId ? 'Canlı Senkronizasyon Aktif' : 'Çevrimdışı / Yerel Mod'}
        </span>
      </div>

      {activeTab === 'tasks' && (
        <div className="animate-in fade-in duration-500 pb-24">
          <div className="flex justify-between items-end mb-8 px-1">
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Hoş Geldiniz,</p>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight leading-none">{currentUser.name.split(' ')[0]} Bey</h2>
            </div>
            <button onClick={() => loadData()} disabled={loading} className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800 border border-slate-700 text-blue-500 shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 ${loading ? 'animate-spin bg-slate-800' : ''}`}>
              <i className="fas fa-sync-alt text-lg"></i>
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/50">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                  <i className="fas fa-clipboard-check text-4xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-200">Her şey yolunda!</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-[200px]">Şu anda listede bekleyen veya aktif bir görev bulunmuyor.</p>
              {!connectionId && <p className="text-xs text-orange-400 mt-4 bg-orange-900/20 px-3 py-1 rounded-full font-bold border border-orange-900/50">Bağlantı aranıyor...</p>}
            </div>
          ) : (
            <div className="space-y-5">
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  user={currentUser} 
                  onUpdateStatus={updateTaskStatus}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* YENİ TALEP SEKME İÇERİĞİ */}
      {activeTab === 'requests' && (
         <div className="animate-in fade-in duration-500 pb-24">
            <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-6 px-1">
                {currentUser.role === 'AMIR' ? 'Gelen Talepler' : 'Taleplerim'}
            </h2>

            {/* USTA: Yeni Talep Formu */}
            {currentUser.role === 'USTA' && (
                <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl shadow-slate-900/50 mb-8">
                     <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                         <i className="fas fa-edit text-orange-500"></i>
                         Yeni Talep Oluştur
                     </h3>
                     <form onSubmit={handleCreateRequest}>
                         <textarea 
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-sm mb-4 focus:ring-2 focus:ring-orange-500 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 text-white min-h-[100px]"
                            placeholder="Parça isteği, izin, öneri vb..."
                            value={newRequestContent}
                            onChange={(e) => setNewRequestContent(e.target.value)}
                         ></textarea>
                         <button 
                            disabled={loading || !newRequestContent.trim()}
                            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-900/40 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            <span>GÖNDER</span>
                            <i className="fas fa-paper-plane"></i>
                         </button>
                     </form>
                </div>
            )}

            {/* Talep Listesi */}
            <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-10">
                        <i className="fas fa-inbox text-4xl text-slate-700 mb-3"></i>
                        <p className="text-slate-500 font-bold">Henüz bir talep bulunmuyor.</p>
                    </div>
                ) : (
                    filteredRequests.sort((a,b) => b.createdAt - a.createdAt).map(req => (
                        <div key={req.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-md relative overflow-hidden group">
                            {/* Sol Kenar Durum Çubuğu */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${req.status === RequestStatus.PENDING ? 'bg-yellow-500' : req.status === RequestStatus.APPROVED ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            
                            <div className="pl-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${req.status === RequestStatus.PENDING ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-800' : req.status === RequestStatus.APPROVED ? 'bg-emerald-900/30 text-emerald-500 border border-emerald-800' : 'bg-red-900/30 text-red-500 border border-red-800'}`}>
                                                {req.status === RequestStatus.PENDING ? 'BEKLEMEDE' : req.status === RequestStatus.APPROVED ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        {currentUser.role === 'AMIR' && (
                                            <p className="text-xs font-bold text-blue-400 mb-1">{req.ustaName}</p>
                                        )}
                                    </div>
                                    {(currentUser.role === 'AMIR' || (currentUser.role === 'USTA' && req.status === RequestStatus.PENDING)) && (
                                         <button onClick={() => handleDeleteRequest(req.id)} className="w-8 h-8 rounded-full bg-slate-700 hover:bg-red-900/50 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors">
                                            <i className="fas fa-trash-alt text-xs"></i>
                                         </button>
                                    )}
                                </div>
                                
                                <p className="text-sm text-slate-300 font-medium leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-3">
                                    {req.content}
                                </p>

                                {/* AMİR AKSİYON BUTONLARI */}
                                {currentUser.role === 'AMIR' && req.status === RequestStatus.PENDING && (
                                    <div className="flex gap-3 mt-3 border-t border-slate-700 pt-3">
                                        <button onClick={() => handleRequestStatus(req.id, RequestStatus.REJECTED)} className="flex-1 py-2 rounded-lg bg-red-900/20 text-red-400 border border-red-900/50 text-xs font-bold hover:bg-red-900/40 transition-colors">
                                            REDDET
                                        </button>
                                        <button onClick={() => handleRequestStatus(req.id, RequestStatus.APPROVED)} className="flex-[2] py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-colors">
                                            ONAYLA
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
         </div>
      )}

      {activeTab === 'profile' && (
        <div className="animate-in slide-in-from-left duration-300 pb-24">
           <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-6 px-1">Ayarlar</h2>

           {/* UYANIK KAL (FABRİKA MODU) */}
           <div className={`p-4 rounded-2xl border shadow-md mb-4 flex items-center justify-between transition-colors ${wakeLock ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${wakeLock ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                    <i className="fas fa-sun"></i>
                 </div>
                 <div>
                    <h3 className={`text-sm font-bold ${wakeLock ? 'text-amber-400' : 'text-slate-200'}`}>Fabrika Modu</h3>
                    <p className="text-[10px] text-slate-500">Ekranı açık tut (Anlık bildirim için)</p>
                 </div>
              </div>
              <button 
                onClick={toggleWakeLock}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${wakeLock ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
              >
                {wakeLock ? 'AÇIK' : 'KAPALI'}
              </button>
           </div>

           {/* Bildirim İzni Butonu */}
           <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-orange-900/30 text-orange-400 flex items-center justify-center">
                    <i className="fas fa-bell"></i>
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-slate-200">Bildirim Ayarı</h3>
                    <p className="text-[10px] text-slate-500">Yeni görevlerden haberdar olun</p>
                 </div>
              </div>
              <button 
                onClick={requestNotificationPermission}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-colors"
              >
                İZİN VER
              </button>
           </div>
           
           {isErkan && (
               <div className="bg-slate-800 p-6 rounded-[2rem] border border-blue-900/30 shadow-xl shadow-blue-900/10 mb-6 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-0 opacity-5 group-hover:opacity-10 transition-opacity"><i className="fas fa-users-cog text-[150px] text-blue-500 -mr-10 -mt-10"></i></div>
                   <h3 className="font-black text-slate-100 mb-6 flex items-center gap-3 text-lg relative z-10">
                       <div className="w-10 h-10 rounded-xl bg-blue-900/30 flex items-center justify-center text-blue-400">
                           <i className="fas fa-user-shield"></i>
                       </div>
                       Personel Yönetimi
                   </h3>
                   
                   <div className="bg-slate-900/50 p-4 rounded-2xl mb-6 ring-1 ring-slate-700 relative z-10">
                       <p className="text-xs font-bold text-slate-500 uppercase mb-3 ml-1">Yeni Personel Ekle</p>
                       <div className="flex flex-col gap-3">
                           <div className="grid grid-cols-2 gap-3">
                               <input 
                                   type="text" 
                                   placeholder="Ad Soyad" 
                                   className="p-3.5 rounded-xl border-0 bg-slate-800 ring-1 ring-slate-700 text-sm w-full font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 placeholder:text-slate-600"
                                   value={newMemberName}
                                   onChange={(e) => setNewMemberName(e.target.value)}
                               />
                               <input 
                                   type="text" 
                                   placeholder="Şifre" 
                                   className="p-3.5 rounded-xl border-0 bg-slate-800 ring-1 ring-slate-700 text-sm w-full font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 placeholder:text-slate-600"
                                   value={newMemberPassword}
                                   onChange={(e) => setNewMemberPassword(e.target.value)}
                               />
                               <input 
                                   type="tel" 
                                   placeholder="Telefon (5XXXXXXXXX)" 
                                   className="p-3.5 col-span-2 rounded-xl border-0 bg-slate-800 ring-1 ring-slate-700 text-sm w-full font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 placeholder:text-slate-600"
                                   value={newMemberPhone}
                                   onChange={(e) => setNewMemberPhone(e.target.value)}
                               />
                           </div>
                           <div className="flex gap-2">
                               <select 
                                   className="p-3.5 rounded-xl border-0 bg-slate-800 ring-1 ring-slate-700 text-sm font-bold outline-none text-slate-100"
                                   value={newMemberRole}
                                   onChange={(e) => setNewMemberRole(e.target.value as any)}
                               >
                                   <option value="USTA">Usta</option>
                                   <option value="AMIR">Amir</option>
                               </select>
                               <button 
                                   onClick={handleAddMember}
                                   className="flex-1 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/40 hover:bg-blue-700 active:scale-95 transition-all"
                               >
                                   KAYDET
                               </button>
                           </div>
                       </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                       <div>
                           <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 pl-1">Amir Kadrosu</h4>
                           <ul className="space-y-2">
                               {amirList.map(member => (
                                   <li key={member.name} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl ring-1 ring-slate-700 text-xs font-bold text-slate-300 shadow-sm">
                                       <span className="flex items-center gap-2">
                                           <div className="w-2 h-2 rounded-full bg-blue-500"></div> 
                                           {member.name}
                                           {member.password && <i className="fas fa-lock text-slate-600 ml-1" title="Şifreli"></i>}
                                           {member.phoneNumber && <i className="fab fa-whatsapp text-emerald-500 ml-1" title={member.phoneNumber}></i>}
                                       </span>
                                       <div className="flex items-center gap-2">
                                            {member.name !== currentUser.name && (
                                                <button 
                                                    onClick={() => { setPasswordChangeModal({show: true, memberName: member.name, role: 'AMIR'}); setNewPasswordInput(''); }}
                                                    className="w-6 h-6 rounded-full bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center"
                                                    title="Şifre Değiştir"
                                                >
                                                    <i className="fas fa-key text-[10px]"></i>
                                                </button>
                                            )}
                                            {member.name !== currentUser.name && (
                                                <button onClick={() => handleRemoveMember(member.name, 'AMIR')} className="w-6 h-6 rounded-full bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center">
                                                    <i className="fas fa-trash-alt text-[10px]"></i>
                                                </button>
                                            )}
                                       </div>
                                   </li>
                               ))}
                           </ul>
                       </div>
                       <div>
                           <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3 pl-1">Usta Kadrosu</h4>
                           <ul className="space-y-2">
                               {ustaList.map(member => (
                                   <li key={member.name} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl ring-1 ring-slate-700 text-xs font-bold text-slate-300 shadow-sm">
                                       <span className="flex items-center gap-2">
                                           <div className="w-2 h-2 rounded-full bg-emerald-500"></div> 
                                           {member.name}
                                           {member.password && <i className="fas fa-lock text-slate-600 ml-1" title="Şifreli"></i>}
                                           {member.phoneNumber && <i className="fab fa-whatsapp text-emerald-500 ml-1" title={member.phoneNumber}></i>}
                                       </span>
                                       <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => { setPasswordChangeModal({show: true, memberName: member.name, role: 'USTA'}); setNewPasswordInput(''); }}
                                                className="w-6 h-6 rounded-full bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center"
                                                title="Şifre Değiştir"
                                            >
                                                <i className="fas fa-key text-[10px]"></i>
                                            </button>
                                            <button onClick={() => handleRemoveMember(member.name, 'USTA')} className="w-6 h-6 rounded-full bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center">
                                                <i className="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                       </div>
                                   </li>
                               ))}
                           </ul>
                       </div>
                   </div>
               </div>
           )}

           <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl shadow-slate-900/50 space-y-6">
              <div className="text-center">
                 <p className="text-xs font-bold text-slate-500 uppercase mb-3">Bulut Bağlantı ID</p>
                 <div className={`text-xl font-mono font-bold tracking-widest py-5 rounded-2xl border-2 border-dashed select-all break-all px-4 ${connectionId ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
                    {connectionId || "BAĞLANTI YOK"}
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 <button onClick={handleCreateConnection} className="bg-slate-700 text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-magic"></i>
                    YENİ KOD OLUŞTUR
                 </button>
                 <button onClick={handleJoinConnection} className="bg-slate-800 text-slate-300 py-4 rounded-xl font-bold text-sm border-2 border-slate-700 hover:border-slate-500 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-link"></i>
                    MEVCUT KODU GİR
                 </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="animate-in slide-in-from-right duration-300 pb-24">
          <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-6 px-1">Yeni Görev</h2>
          <form onSubmit={handleCreateTask} className="space-y-5 bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl shadow-slate-900/50 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            {!connectionId && (
                <div className="bg-orange-900/20 border border-orange-900/50 text-orange-400 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                    <i className="fas fa-wifi-slash text-lg"></i>
                    Yerel moddasınız. Veriler diğer cihazlara gitmeyebilir.
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Makine Adı</label>
                <input type="text" className="w-full border-0 bg-slate-900 ring-1 ring-slate-700 rounded-2xl p-4 text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition-all outline-none placeholder:font-normal placeholder:text-slate-600" value={newTaskMachine} onChange={e => setNewTaskMachine(e.target.value)} required placeholder="Örn: Enjeksiyon 3" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Görevli Usta</label>
                    <div className="relative">
                        <select className="w-full appearance-none border-0 bg-slate-900 ring-1 ring-slate-700 rounded-2xl p-4 text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition-all outline-none" value={newTaskMaster} onChange={e => setNewTaskMaster(e.target.value)} required>
                            <option value="">Seçiniz...</option>
                            {ustaList.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                        </select>
                        <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                    </div>
                </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Öncelik</label>
                    <div className="relative">
                        <select className="w-full appearance-none border-0 bg-slate-900 ring-1 ring-slate-700 rounded-2xl p-4 text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition-all outline-none" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}>
                             {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                         <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                    </div>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">İş Emri Detayı</label>
                <textarea className="w-full border-0 bg-slate-900 ring-1 ring-slate-700 rounded-2xl p-4 text-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-slate-900 transition-all outline-none min-h-[120px] resize-none placeholder:text-slate-600" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} required placeholder="Yapılacak işlemi detaylıca tarif ediniz..." />
            </div>
            
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Fotoğraf (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-500 py-4 rounded-2xl ring-1 ring-slate-700 ring-dashed border-2 border-transparent hover:border-blue-500/50 flex flex-col items-center justify-center gap-2 transition-all group">
                    <div className="w-10 h-10 bg-slate-800 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <i className="fas fa-camera text-blue-500 text-lg"></i>
                    </div>
                    <span className="text-xs font-bold">Fotoğraf Çek / Yükle</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageChange}
                    />
                  </label>
                  {newTaskImage && (
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-lg ring-2 ring-slate-700">
                      <img src={newTaskImage} alt="Önizleme" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => { setNewTaskImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
            </div>

            <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/40 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                {loading ? (
                    <>
                    <i className="fas fa-circle-notch animate-spin"></i>
                    <span>İLETİLİYOR...</span>
                    </>
                ) : (
                    <>
                    <span>GÖREVİ YAYINLA</span>
                    <i className="fas fa-paper-plane"></i>
                    </>
                )}
            </button>
          </form>
        </div>
      )}

      {/* Şifre Değiştirme Modalı */}
      {passwordChangeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-xs shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden border border-slate-700">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner border border-blue-800/30">
                          <i className="fas fa-key text-2xl"></i>
                      </div>
                      <h3 className="text-lg font-black text-slate-100">Şifre Güncelle</h3>
                      <p className="text-sm text-slate-400 font-medium">{passwordChangeModal.memberName}</p>
                  </div>

                  <form onSubmit={handleChangePassword}>
                      <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Yeni Şifre</label>
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Yeni şifre (Boş bırakılırsa kaldırılır)" 
                            className="w-full text-center font-bold p-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 focus:bg-slate-800 outline-none transition-all text-white placeholder:text-slate-600"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                          <button type="button" onClick={() => { setPasswordChangeModal(null); setNewPasswordInput(''); }} className="py-3 rounded-xl font-bold text-sm text-slate-400 bg-slate-700 hover:bg-slate-600 hover:text-white transition-colors">
                              Vazgeç
                          </button>
                          <button type="submit" className="py-3 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/50">
                              Kaydet
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default App;
