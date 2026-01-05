
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task, User, TaskStatus, TaskPriority, Member, UstaRequest, RequestStatus, LeaveRequest } from './types';
import { fetchAppData, saveAppData, createNewBin, getStoredBinId, setStoredBinId, extractBinId, checkConnection, archiveDeletedTask } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';
import CalendarView from './components/CalendarView';

// Varsayılan listeler BOŞ (Senkronizasyon ile gelecek)
const DEFAULT_AMIRS: Member[] = [];
const DEFAULT_USTAS: Member[] = [];

// Otomatik bağlanılacak Npoint adresi
const AUTO_CONNECT_URL = 'https://www.npoint.io/docs/c85115e1d1b4c3276a86';
// Yerel depolamada yetkilendirme anahtarı
const LOCAL_KEY_AUTH = 'hidro_auth';
// Bildirim sesi (Kısa bip sesi)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
// Grup Resmi URL
const GROUP_IMAGE_URL = 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png'; // Buraya ekteki resmin URL'sini koyabilirsiniz.

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<UstaRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [amirList, setAmirList] = useState<Member[]>(DEFAULT_AMIRS);
  const [ustaList, setUstaList] = useState<Member[]>(DEFAULT_USTAS);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile' | 'requests' | 'calendar'>('tasks');
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

  // Online Durumu Kontrolü (Son 2 dakika)
  const isUserOnline = (lastActive?: number) => {
      if (!lastActive) return false;
      return (Date.now() - lastActive) < 2 * 60 * 1000; // 2 dakika
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
            icon: GROUP_IMAGE_URL
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
              icon: GROUP_IMAGE_URL
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
    setLeaves(data.leaves);
    
    // İlk yüklemede mevcut ID'leri kaydet ki bildirim gitmesin
    if (isFirstLoadRef.current && data.tasks.length > 0) {
        data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
        isFirstLoadRef.current = false;
    }

    // Listeleri güncelle
    if (data.amirs) setAmirList(data.amirs);
    if (data.ustas) setUstaList(data.ustas);
    
    setLoading(false);
  }, [connectionId]);

  // Online Heartbeat (Her 60 saniyede bir lastActive günceller)
  useEffect(() => {
    if (!currentUser || !connectionId) return;

    const sendHeartbeat = async () => {
        // Mevcut veriyi çek, güncelle ve kaydet
        const data = await fetchAppData(connectionId);
        let updatedAmirs = [...data.amirs];
        let updatedUstas = [...data.ustas];
        const now = Date.now();

        let changed = false;

        if (currentUser.role === 'AMIR') {
            updatedAmirs = updatedAmirs.map(m => {
                if(m.name === currentUser.name) {
                    changed = true;
                    return { ...m, lastActive: now };
                }
                return m;
            });
        } else {
             updatedUstas = updatedUstas.map(m => {
                if(m.name === currentUser.name) {
                    changed = true;
                    return { ...m, lastActive: now };
                }
                return m;
            });
        }

        if (changed) {
            // Local state'i güncelle (arayüz hemen tepki versin)
            if (currentUser.role === 'AMIR') setAmirList(updatedAmirs);
            else setUstaList(updatedUstas);

            // DB kaydet
            await saveAppData({ 
                tasks: data.tasks, 
                requests: data.requests, 
                leaves: data.leaves, 
                amirs: updatedAmirs, 
                ustas: updatedUstas 
            }, connectionId);
        }
    };

    // İlk girişte hemen gönder
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 60000); // 1 dakika
    return () => clearInterval(interval);
  }, [currentUser, connectionId]);


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
             setLeaves(data.leaves);
             // İlk yükleme olduğu için ID'leri sete at
             data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
             isFirstLoadRef.current = false;

             if (data.amirs) setAmirList(data.amirs);
             if (data.ustas) setUstaList(data.ustas);
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
            setLeaves(data.leaves);
            if (data.amirs) setAmirList(data.amirs);
            if (data.ustas) setUstaList(data.ustas);

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
    
    // Varsayılan boş listeler yerine en azından bir yönetici olsun
    const initialAmirs = [{ name: 'Birim Amiri' }]; 
    
    setLoading(true);
    const newId = await createNewBin(initialAmirs, []);
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
        phoneNumber: cleanedPhone || undefined,
        lastActive: 0
    };

    if (newMemberRole === 'AMIR') {
        newAmirs.push(newMember);
        setAmirList(newAmirs);
    } else {
        newUstas.push(newMember);
        setUstaList(newUstas);
    }

    await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas }, connectionId);
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
      
      await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas }, connectionId);
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

    await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas }, connectionId);
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
    await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
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

  // GÖREV GÖRÜLDÜ İŞARETLEME
  const handleMarkTaskSeen = async (taskId: string) => {
      // Sadece giriş yapmış kullanıcı işlem yapabilir
      if (!currentUser) return;

      const task = tasks.find(t => t.id === taskId);
      // Eğer görev yoksa veya zaten görüldüyse işlem yapma
      if (!task || task.seenAt) return;

      // KRİTİK KONTROL: Sadece görevin atandığı USTA bu görevi 'görüldü' yapabilir.
      // Yönetici veya başka bir usta baktığında tetiklenmemeli.
      if (currentUser.role !== 'USTA' || task.masterName !== currentUser.name) {
          return;
      }

      // Optimistik güncelleme (Hemen arayüzde göster)
      const now = Date.now();
      const updatedTasks = tasks.map(t => {
          if (t.id === taskId) {
              return { ...t, seenAt: now };
          }
          return t;
      });
      setTasks(updatedTasks);
      
      // Arka planda kaydet
      await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
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
    await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("BU GÖREV KALICI OLARAK SİLİNECEK.\n\nEmin misiniz?")) return;

    setLoading(true);

    // 1. Silinecek görevi bul
    const taskToDelete = tasks.find(t => t.id === taskId);

    // 2. Eğer görev varsa, önce arşive gönder
    if (taskToDelete) {
        await archiveDeletedTask(taskToDelete);
    }

    // 3. Görevi mevcut listeden sil
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
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
    await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
    
    setNewRequestContent('');
    alert("Talebiniz yöneticiye iletildi.");
  };

  // İZİN YÖNETİMİ
  const handleAddLeave = async (start: string, end: string, reason: string) => {
      if(!currentUser) return;

      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 dahil olması için

      const newLeave: LeaveRequest = {
          id: Date.now().toString(),
          ustaName: currentUser.name,
          startDate: start,
          endDate: end,
          daysCount: daysCount,
          reason: reason,
          status: RequestStatus.PENDING, // Varsayılan olarak amir onayı bekler
          createdAt: Date.now()
      };

      const updatedLeaves = [...leaves, newLeave];
      setLeaves(updatedLeaves);
      
      setLoading(true);
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList }, connectionId);
      setLoading(false);
      alert("İzin talebi oluşturuldu.");
  };

  const handleDeleteLeave = async (leaveId: string) => {
      if(!confirm("İzin talebini silmek istediğinize emin misiniz?")) return;
      const updatedLeaves = leaves.filter(l => l.id !== leaveId);
      setLeaves(updatedLeaves);
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList }, connectionId);
  };

  const handleLeaveStatus = async (leaveId: string, status: RequestStatus) => {
      const updatedLeaves = leaves.map(l => {
          if (l.id === leaveId) return { ...l, status };
          return l;
      });
      setLeaves(updatedLeaves);
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList }, connectionId);
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
    await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
    setLoading(false);
  };

  // TALEP SİLME (AMİR veya USTA (Pending ise))
  const handleDeleteRequest = async (reqId: string) => {
      if(!confirm("Bu talebi silmek istediğinize emin misiniz?")) return;
      setLoading(true);
      const updatedRequests = requests.filter(r => r.id !== reqId);
      setRequests(updatedRequests);
      await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList }, connectionId);
      setLoading(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white overflow-y-auto relative">
        <div className="w-full max-w-sm animate-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-white/5 p-4 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.2)] mb-6 ring-4 ring-white/10 backdrop-blur-sm">
               <img src={GROUP_IMAGE_URL} alt="Grup Resmi" className="w-32 h-32 object-contain drop-shadow-md" />
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
                {amirList.length === 0 && <p className="text-xs text-slate-500 italic p-2">Liste boş, senkronizasyon bekleniyor...</p>}
                {amirList.map(member => (
                  <button key={member.name} onClick={() => handleLoginClick(member, 'AMIR')} className="group relative bg-slate-800/50 hover:bg-blue-600 border border-white/5 p-4 rounded-2xl text-left font-bold transition-all duration-300 flex justify-between items-center overflow-hidden">
                    <div className="absolute inset-0 bg-blue-400/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <span className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <div className="relative">
                            <i className="fas fa-user-tie text-blue-400 group-hover:text-white/80"></i>
                            {isUserOnline(member.lastActive) && (
                                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></span>
                            )}
                        </div>
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
                {ustaList.length === 0 && <p className="text-xs text-slate-500 italic p-2">Liste boş, senkronizasyon bekleniyor...</p>}
                {ustaList.map(member => (
                  <button key={member.name} onClick={() => handleLoginClick(member, 'USTA')} className="group relative bg-slate-800/50 hover:bg-emerald-600 border border-white/5 p-4 rounded-2xl text-left font-bold transition-all duration-300 flex justify-between items-center overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-400/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <span className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <div className="relative">
                            <i className="fas fa-wrench text-emerald-400 group-hover:text-white/80"></i>
                            {isUserOnline(member.lastActive) && (
                                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></span>
                            )}
                        </div>
                        {member.name}
                        {member.password && <i className="fas fa-lock text-[10px] text-slate-500 group-hover:text-white/50"></i>}
                    </span>
                    <i className="fas fa-arrow-right text-slate-600 group-hover:text-white relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"></i>
                  </button>
                ))}
              </div>
            </section>
            
            {!connectionId && (
                <div className="pt-4 text-center">
                    <button onClick={handleJoinConnection} className="text-xs text-blue-400 hover:text-white underline">
                        Bir gruba katıl veya senkronize et
                    </button>
                    <div className="h-2"></div>
                    <button onClick={handleCreateConnection} className="text-[10px] text-slate-600 hover:text-slate-400">
                        Yeni Grup Oluştur
                    </button>
                </div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-6 font-mono">v1.4 &bull; Güvenli Bağlantı</p>
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
            <button onClick={() => loadData()} disabled={loading} className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800 border border-slate-700 text-blue-500 shadow-lg shadow-blue-900/20 hover:shadow-xl hover:bg-slate-750 transition-all ${loading ? 'animate-spin' : ''}`}>
                <i className="fas fa-sync-alt"></i>
            </button>
          </div>
          
          <div className="space-y-6">
            {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50 text-slate-600">
                    <i className="fas fa-clipboard-list text-6xl mb-4"></i>
                    <p className="font-bold">Henüz görev yok</p>
                </div>
            ) : (
                filteredTasks.map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task} 
                        user={currentUser} 
                        onUpdateStatus={updateTaskStatus}
                        onDelete={handleDeleteTask}
                        onMarkSeen={handleMarkTaskSeen}
                    />
                ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
          <CalendarView 
             leaves={leaves} 
             user={currentUser} 
             onAddLeave={handleAddLeave}
             onDeleteLeave={handleDeleteLeave}
             onUpdateStatus={handleLeaveStatus}
          />
      )}

      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="animate-in slide-in-from-bottom-4 duration-500 pb-24">
            <h2 className="text-2xl font-black text-slate-100 mb-6 px-1">Yeni İş Emri</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Makine / Bölge</label>
                    <input 
                        type="text" 
                        required
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-colors"
                        placeholder="Örn: Pres 3"
                        value={newTaskMachine}
                        onChange={e => setNewTaskMachine(e.target.value)}
                    />
                </div>

                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Arıza / İş Tanımı</label>
                    <textarea 
                        required
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-colors resize-none"
                        placeholder="Yapılacak işlemi detaylandırın..."
                        value={newTaskDescription}
                        onChange={e => setNewTaskDescription(e.target.value)}
                    ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Görevli Usta</label>
                        <select 
                            required
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-colors appearance-none"
                            value={newTaskMaster}
                            onChange={e => setNewTaskMaster(e.target.value)}
                        >
                            <option value="">Seçiniz</option>
                            {ustaList.map(u => (
                                <option key={u.name} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Öncelik</label>
                        <select 
                            required
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-colors appearance-none"
                            value={newTaskPriority}
                            onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                        >
                            {Object.values(TaskPriority).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-blue-600 transition-colors">
                            <i className="fas fa-camera"></i>
                        </div>
                        <div className="flex-1">
                            <span className="block text-sm font-bold text-slate-300 group-hover:text-blue-400 transition-colors">Fotoğraf Ekle</span>
                            <span className="block text-xs text-slate-500">Opsiyonel arıza görseli</span>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImageChange}
                        />
                    </label>
                    {newTaskImage && (
                        <div className="mt-4 relative rounded-xl overflow-hidden border border-slate-600 h-40">
                            <img src={newTaskImage} alt="Preview" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => { setNewTaskImage(null); if(fileInputRef.current) fileInputRef.current.value=''; }} className="absolute top-2 right-2 bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    )}
                </div>

                <button type="submit" className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 active:scale-95 transition-all text-lg">
                    GÖREVİ YAYINLA
                </button>
            </form>
        </div>
      )}

      {activeTab === 'requests' && (
         <div className="animate-in fade-in duration-500 pb-24">
            <h2 className="text-2xl font-black text-slate-100 mb-6 px-1">Malzeme & İzin Talepleri</h2>
            
            {currentUser.role === 'USTA' && (
                <form onSubmit={handleCreateRequest} className="mb-8 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Yeni Talep Oluştur</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            required
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-orange-500 outline-none transition-colors"
                            placeholder="İhtiyaç duyulan malzeme veya izin..."
                            value={newRequestContent}
                            onChange={e => setNewRequestContent(e.target.value)}
                        />
                        <button type="submit" className="bg-orange-600 text-white px-4 rounded-xl font-bold shadow-lg shadow-orange-900/30 active:scale-95 transition-all">
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-10 opacity-50 text-slate-600">
                        <p className="font-bold">Talep bulunmuyor</p>
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <div key={req.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                req.status === RequestStatus.APPROVED ? 'bg-emerald-500' :
                                req.status === RequestStatus.REJECTED ? 'bg-red-500' : 'bg-orange-500'
                            }`}></div>
                            <div className="pl-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500">{req.ustaName}</p>
                                        <p className="text-slate-200 font-medium">{req.content}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                                        req.status === RequestStatus.APPROVED ? 'bg-emerald-900/30 text-emerald-400' :
                                        req.status === RequestStatus.REJECTED ? 'bg-red-900/30 text-red-400' : 'bg-orange-900/30 text-orange-400'
                                    }`}>
                                        {req.status === RequestStatus.APPROVED ? 'ONAYLANDI' :
                                         req.status === RequestStatus.REJECTED ? 'REDDEDİLDİ' : 'BEKLİYOR'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-600 text-right">
                                    {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                                </div>
                                
                                {currentUser.role === 'AMIR' && (
                                    <div className="mt-3 pt-3 border-t border-slate-700 flex justify-end gap-2">
                                        <button onClick={() => handleDeleteRequest(req.id)} className="w-8 h-8 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 flex items-center justify-center">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                        {req.status === RequestStatus.PENDING && (
                                            <>
                                                <button onClick={() => handleRequestStatus(req.id, RequestStatus.REJECTED)} className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-xs font-bold hover:bg-red-900/40">REDDET</button>
                                                <button onClick={() => handleRequestStatus(req.id, RequestStatus.APPROVED)} className="px-3 py-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 text-xs font-bold hover:bg-emerald-900/40">ONAYLA</button>
                                            </>
                                        )}
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
        <div className="animate-in fade-in duration-500 pb-24 space-y-6">
            <h2 className="text-2xl font-black text-slate-100 px-1">Profil & Ayarlar</h2>

            {/* Bağlantı Yönetimi - Sadece AMİR */}
            {currentUser.role === 'AMIR' && (
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <i className="fas fa-network-wired text-blue-500"></i>
                        Veri Bağlantısı
                    </h3>
                    
                    {connectionId ? (
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-4">
                            <p className="text-xs text-slate-500 mb-1">Aktif Bağlantı ID</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black/30 p-2 rounded text-emerald-400 font-mono text-sm">{connectionId}</code>
                                <button onClick={() => navigator.clipboard.writeText(connectionId)} className="p-2 text-slate-400 hover:text-white">
                                    <i className="fas fa-copy"></i>
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">Bu kodu diğer cihazlara girerek verileri eşitleyebilirsiniz.</p>
                        </div>
                    ) : (
                        <div className="flex gap-3 mb-4">
                            <button onClick={handleCreateConnection} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">Yeni Bağlantı Kur</button>
                            <button onClick={handleJoinConnection} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold">Koda Bağlan</button>
                        </div>
                    )}
                </div>
            )}

            {/* Personel Yönetimi - Sadece AMİR */}
            {currentUser.role === 'AMIR' && (
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <i className="fas fa-users-cog text-purple-500"></i>
                        Personel Listesi
                    </h3>

                    <div className="space-y-4 mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Amirler</p>
                            <div className="flex flex-wrap gap-2">
                                {amirList.map(m => (
                                    <div key={m.name} className="bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-600">
                                        <div className="relative">
                                            <span className="text-xs text-slate-200 font-bold">{m.name}</span>
                                            {isUserOnline(m.lastActive) && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-slate-700"></span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-1">
                                            <button onClick={() => setPasswordChangeModal({ show: true, memberName: m.name, role: 'AMIR' })} className="text-slate-400 hover:text-blue-400"><i className="fas fa-key text-[10px]"></i></button>
                                            {isErkan && m.name !== 'Birim Amiri ERKAN ÇİLİNGİR' && (
                                                <button onClick={() => handleRemoveMember(m.name, 'AMIR')} className="text-slate-400 hover:text-red-400"><i className="fas fa-times text-[10px]"></i></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Ustalar</p>
                            <div className="flex flex-wrap gap-2">
                                {ustaList.map(m => (
                                    <div key={m.name} className="bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-600">
                                        <div className="relative">
                                            <span className="text-xs text-slate-200 font-bold">{m.name}</span>
                                            {isUserOnline(m.lastActive) && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-slate-700"></span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-1">
                                             <button onClick={() => setPasswordChangeModal({ show: true, memberName: m.name, role: 'USTA' })} className="text-slate-400 hover:text-blue-400"><i className="fas fa-key text-[10px]"></i></button>
                                             <button onClick={() => handleRemoveMember(m.name, 'USTA')} className="text-slate-400 hover:text-red-400"><i className="fas fa-times text-[10px]"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                        <p className="text-xs font-bold text-slate-400 mb-3">Yeni Personel Ekle</p>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input 
                                placeholder="İsim Soyisim" 
                                className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white"
                                value={newMemberName}
                                onChange={e => setNewMemberName(e.target.value)}
                            />
                            <select 
                                className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white"
                                value={newMemberRole}
                                onChange={e => setNewMemberRole(e.target.value as any)}
                            >
                                <option value="USTA">Usta</option>
                                <option value="AMIR">Amir</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                             <input 
                                type="tel"
                                placeholder="5XX... (Whatsapp)" 
                                className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white"
                                value={newMemberPhone}
                                onChange={e => setNewMemberPhone(e.target.value)}
                            />
                            <input 
                                placeholder="Şifre (Opsiyonel)" 
                                className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white"
                                value={newMemberPassword}
                                onChange={e => setNewMemberPassword(e.target.value)}
                            />
                        </div>
                        <button onClick={handleAddMember} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-xs font-bold shadow-lg shadow-emerald-900/20">
                            Ekle
                        </button>
                    </div>
                </div>
            )}
            
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <i className="fas fa-mobile-alt text-teal-500"></i>
                    Uygulama Ayarları
                </h3>
                <div className="flex gap-3">
                    <button onClick={toggleWakeLock} className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${wakeLock ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                        {wakeLock ? 'Ekran Açık Kalıyor' : 'Ekranı Açık Tut'}
                    </button>
                    <button onClick={requestNotificationPermission} className="flex-1 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600">
                        Bildirim İzni
                    </button>
                </div>
            </div>

            <div className="text-center pt-8 opacity-40">
                <i className="fas fa-oil-can text-4xl mb-2 text-slate-500"></i>
                <p className="text-[10px] font-mono text-slate-500">Hidrolik Takip v1.4</p>
            </div>
        </div>
      )}

      {/* Şifre Değiştirme Modal */}
      {passwordChangeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-xs border border-slate-700">
                <h3 className="text-white font-bold mb-4">Şifre Değiştir: {passwordChangeModal.memberName}</h3>
                <form onSubmit={handleChangePassword}>
                    <input 
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white mb-4 outline-none focus:border-blue-500"
                        placeholder="Yeni Şifre"
                        value={newPasswordInput}
                        onChange={e => setNewPasswordInput(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setPasswordChangeModal(null)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-bold">İptal</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
