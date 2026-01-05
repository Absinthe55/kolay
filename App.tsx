import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task, User, TaskStatus, TaskPriority, Member, UstaRequest, RequestStatus, LeaveRequest } from './types';
import { fetchAppData, saveAppData, createNewBin, getStoredBinId, setStoredBinId, extractBinId, checkConnection } from './services/dbService';
import Layout from './components/Layout';
import TaskCard from './components/TaskCard';
import CalendarView from './components/CalendarView';

// Varsayılan listeler BOŞ (Senkronizasyon ile gelecek)
const DEFAULT_AMIRS: Member[] = [];
const DEFAULT_USTAS: Member[] = [];

// Otomatik bağlanılacak NPOINT adresi
const AUTO_CONNECT_URL = 'https://www.npoint.io/docs/c85115e1d1b4c3276a86';
// Yerel depolamada yetkilendirme anahtarı
const LOCAL_KEY_AUTH = 'hidro_auth';
// Bildirim sesi (Kısa bip sesi)
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
// Grup Resmi URL
const GROUP_IMAGE_URL = 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png'; 

type TaskTab = 'active' | 'history' | 'deleted';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]); // Silinenler için
  const [requests, setRequests] = useState<UstaRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [amirList, setAmirList] = useState<Member[]>(DEFAULT_AMIRS);
  const [ustaList, setUstaList] = useState<Member[]>(DEFAULT_USTAS);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'add' | 'profile' | 'requests' | 'calendar'>('tasks');
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('active'); // Görevler alt sekmeleri

  // Filtreleme State'i (Sadece Amirler İçin)
  const [selectedUstaFilter, setSelectedUstaFilter] = useState<string>('ALL');

  const [connectionId, setConnectionId] = useState(getStoredBinId());

  // Senkronizasyon Zamanlayıcısı (Amir İçin)
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [msSinceSync, setMsSinceSync] = useState<number>(0);
  
  // Personel Yönetimi State'leri
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'AMIR' | 'USTA'>('USTA');

  // Şifre Değiştirme Modal State
  const [passwordChangeModal, setPasswordChangeModal] = useState<{show: boolean, memberName: string, role: 'AMIR' | 'USTA'} | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // İsim Değiştirme Modal State
  const [renameModal, setRenameModal] = useState<{show: boolean, oldName: string, role: 'AMIR' | 'USTA'} | null>(null);
  const [renameInput, setRenameInput] = useState('');

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

  // Pull to Refresh State
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

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

  // Online Durumu Kontrolü (Son 25 saniye)
  const isUserOnline = (lastActive?: number) => {
      if (!lastActive) return false;
      return (Date.now() - lastActive) < 25 * 1000; // 25 saniye (Daha hassas)
  };

  // Son Görülme Zamanı Formatlama
  const formatLastActive = (timestamp?: number) => {
      if (!timestamp) return '';
      const now = Date.now();
      const diff = now - timestamp;
      const date = new Date(timestamp);

      // 25 saniyeden az ise
      if (diff < 25 * 1000) return 'Çevrimiçi';

      // Bugün mü?
      const isToday = date.getDate() === new Date().getDate() &&
                      date.getMonth() === new Date().getMonth() &&
                      date.getFullYear() === new Date().getFullYear();

      if (isToday) {
          return `Bugün ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Dün mü?
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.getDate() === yesterday.getDate() &&
                          date.getMonth() === yesterday.getMonth() &&
                          date.getFullYear() === yesterday.getFullYear();
      
      if (isYesterday) {
          return `Dün ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Daha eski
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    
    // Senkronizasyon zamanını sıfırla
    setLastSyncTime(Date.now());

    setTasks(data.tasks);
    setRequests(data.requests);
    setLeaves(data.leaves);
    setArchivedTasks(data.deletedTasks); 
    
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

  // MS Sayacı Efekti (Sadece Amir için arayüzde gösteriliyor ama state hep çalışsın)
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (currentUser?.role === 'AMIR') {
          interval = setInterval(() => {
              setMsSinceSync(Date.now() - lastSyncTime);
          }, 75); // Ekranı yormasın diye 75ms
      }
      return () => clearInterval(interval);
  }, [lastSyncTime, currentUser]);

  // Online Heartbeat & Location Tracking (Her 10 saniyede bir)
  useEffect(() => {
    if (!currentUser || !connectionId) return;

    const sendHeartbeat = async () => {
        // Mevcut veriyi çek
        const data = await fetchAppData(connectionId);
        let updatedAmirs = [...data.amirs];
        let updatedUstas = [...data.ustas];
        const now = Date.now();
        let changed = false;

        // Yardımcı fonksiyon: Veriyi kaydet
        const persistHeartbeat = async (amirs: Member[], ustas: Member[]) => {
             // Local state'i güncelle (arayüz hemen tepki versin)
            if (currentUser.role === 'AMIR') setAmirList(amirs);
            else setUstaList(ustas);

            // DB kaydet
            await saveAppData({ 
                tasks: data.tasks, 
                requests: data.requests, 
                leaves: data.leaves, 
                amirs: amirs, 
                ustas: ustas,
                deletedTasks: data.deletedTasks
            }, connectionId);
        };

        // Eğer kullanıcı USTA ise, konum almaya çalış
        if (currentUser.role === 'USTA') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        // Konum başarıyla alındı
                        updatedUstas = updatedUstas.map(m => {
                            if (m.name === currentUser.name) {
                                changed = true;
                                return { 
                                    ...m, 
                                    lastActive: now,
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                };
                            }
                            return m;
                        });
                        
                        // Konum alındıktan sonra kaydet
                        if(changed) await persistHeartbeat(updatedAmirs, updatedUstas);
                    },
                    async (error) => {
                        console.warn("Konum alınamadı:", error);
                        // Konum alınamazsa bile online durumunu güncelle
                        updatedUstas = updatedUstas.map(m => {
                            if (m.name === currentUser.name) {
                                changed = true;
                                return { ...m, lastActive: now };
                            }
                            return m;
                        });
                        if(changed) await persistHeartbeat(updatedAmirs, updatedUstas);
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                // Tarayıcı desteklemiyorsa sadece active güncelle
                updatedUstas = updatedUstas.map(m => {
                    if (m.name === currentUser.name) {
                        changed = true;
                        return { ...m, lastActive: now };
                    }
                    return m;
                });
                if(changed) await persistHeartbeat(updatedAmirs, updatedUstas);
            }
        } 
        // Kullanıcı AMİR ise
        else if (currentUser.role === 'AMIR') {
            updatedAmirs = updatedAmirs.map(m => {
                if(m.name === currentUser.name) {
                    changed = true;
                    return { ...m, lastActive: now };
                }
                return m;
            });
            if(changed) await persistHeartbeat(updatedAmirs, updatedUstas);
        }
    };

    // İlk girişte hemen gönder
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 10000); // 10 saniye
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
             setArchivedTasks(data.deletedTasks);

             // İlk yükleme olduğu için ID'leri sete at
             data.tasks.forEach(t => lastTaskIdsRef.current.add(t.id));
             isFirstLoadRef.current = false;

             if (data.amirs) setAmirList(data.amirs);
             if (data.ustas) setUstaList(data.ustas);
          }
       }
    };
    initAutoConnect();

    // 4. Periyodik güncelleme ve Bildirim Kontrolü (2 Saniyede Bir - DAHA SIK)
    const interval = setInterval(() => {
      if (connectionId) {
        fetchAppData(connectionId).then(data => {
            // Senkronizasyon zamanını sıfırla
            setLastSyncTime(Date.now());

            // State güncelle
            setTasks(data.tasks);
            setRequests(data.requests);
            setLeaves(data.leaves);
            setArchivedTasks(data.deletedTasks);

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
    }, 2000); // 2 saniye

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

  // PULL TO REFRESH HANDLERS
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
        setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY;
    const diff = touchY - pullStartY;
    
    // Sadece en tepedeyken ve aşağı çekiliyorsa
    if (window.scrollY === 0 && diff > 0 && pullStartY > 0) {
         setPullDistance(diff > 150 ? 150 : diff); // Max 150px esneme
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) { // 80px'den fazla çekildiyse yenile
         await loadData();
    }
    setPullDistance(0);
    setPullStartY(0);
  };

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
    setActiveTab('tasks'); // Giriş yapınca her zaman Görevler ekranına at

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

    await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas, deletedTasks: archivedTasks }, connectionId);
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
      
      await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas, deletedTasks: archivedTasks }, connectionId);
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

    await saveAppData({ tasks, requests, leaves, amirs: newAmirs, ustas: newUstas, deletedTasks: archivedTasks }, connectionId);
    setLoading(false);
    setPasswordChangeModal(null);
    setNewPasswordInput('');
    alert("Şifre güncellendi.");
  };

  const handleRenameMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModal || !renameInput.trim()) return;

    const oldName = renameModal.oldName;
    const newName = renameInput.trim();
    
    // Boş veya aynı isimse çık
    if (newName === oldName) {
        setRenameModal(null);
        return;
    }

    setLoading(true);
    
    // 1. Listeleri Güncelle
    let newAmirs = [...amirList];
    let newUstas = [...ustaList];

    if (renameModal.role === 'AMIR') {
        newAmirs = newAmirs.map(m => m.name === oldName ? { ...m, name: newName } : m);
        setAmirList(newAmirs);
    } else {
        newUstas = newUstas.map(m => m.name === oldName ? { ...m, name: newName } : m);
        setUstaList(newUstas);
    }

    // 2. Geçmiş Verileri Güncelle (Tutarlılık için önemli)
    // Görevlerdeki masterName
    const updatedTasks = tasks.map(t => t.masterName === oldName ? { ...t, masterName: newName } : t);
    setTasks(updatedTasks);

    // Arşivdeki masterName
    const updatedArchived = archivedTasks.map(t => t.masterName === oldName ? { ...t, masterName: newName } : t);
    setArchivedTasks(updatedArchived);

    // Taleplerdeki ustaName
    const updatedRequests = requests.map(r => r.ustaName === oldName ? { ...r, ustaName: newName } : r);
    setRequests(updatedRequests);

    // İzinlerdeki ustaName
    const updatedLeaves = leaves.map(l => l.ustaName === oldName ? { ...l, ustaName: newName } : l);
    setLeaves(updatedLeaves);

    // Eğer kendimizi değiştirdiysek currentUser'ı güncelle
    if (currentUser && currentUser.name === oldName) {
        const updatedUser = { ...currentUser, name: newName };
        setCurrentUser(updatedUser);
        localStorage.setItem(LOCAL_KEY_AUTH, JSON.stringify(updatedUser));
    }

    // 3. Veritabanına Kaydet
    await saveAppData({ 
        tasks: updatedTasks, 
        requests: updatedRequests, 
        leaves: updatedLeaves, 
        amirs: newAmirs, 
        ustas: newUstas, 
        deletedTasks: updatedArchived 
    }, connectionId);

    setLoading(false);
    setRenameModal(null);
    setRenameInput('');
    alert("Kullanıcı adı başarıyla güncellendi.");
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
    await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
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
      await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
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
    await saveAppData({ tasks: updatedTasks, requests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
    setLoading(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("BU GÖREV KALICI OLARAK SİLİNECEK.\n\nEmin misiniz?")) return;

    setLoading(true);

    // 1. Silinecek görevi bul
    const taskToDelete = tasks.find(t => t.id === taskId);

    // 2. Eğer görev varsa, önce arşive gönder
    if (taskToDelete) {
        // Yeni: saveAppData ile kaydet
        const taskWithDeletedAt = { ...taskToDelete, deletedAt: Date.now() };
        const newArchived = [taskWithDeletedAt, ...archivedTasks];
        const newTasks = tasks.filter(t => t.id !== taskId);

        setTasks(newTasks);
        setArchivedTasks(newArchived);

        await saveAppData({ 
            tasks: newTasks, 
            requests, 
            leaves, 
            amirs: amirList, 
            ustas: ustaList, 
            deletedTasks: newArchived // Arşiv güncellendi
        }, connectionId);
    } else {
        // Zaten listede yoksa sadece UI güncelle (Nadiren olur)
        const newTasks = tasks.filter(t => t.id !== taskId);
        setTasks(newTasks);
        await saveAppData({ tasks: newTasks, requests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
    }
    
    setLoading(false);
  };

  // Kalıcı Olarak Silme (Arşivden)
  const handlePermanentDelete = async (taskId: string) => {
      if(!confirm("DİKKAT! Bu işlem geri alınamaz!\n\nGörev veritabanından tamamen silinecek. Devam edilsin mi?")) return;
      
      setLoading(true);
      
      // Yeni: saveAppData ile kaydet
      const newArchived = archivedTasks.filter(t => t.id !== taskId);
      setArchivedTasks(newArchived);

      await saveAppData({ 
          tasks, 
          requests, 
          leaves, 
          amirs: amirList, 
          ustas: ustaList, 
          deletedTasks: newArchived 
      }, connectionId);
      
      setLoading(false);
      alert("Görev kalıcı olarak silindi.");
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
    await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
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
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
      setLoading(false);
      alert("İzin talebi oluşturuldu.");
  };

  const handleDeleteLeave = async (leaveId: string) => {
      if(!confirm("İzin talebini silmek istediğinize emin misiniz?")) return;
      const updatedLeaves = leaves.filter(l => l.id !== leaveId);
      setLeaves(updatedLeaves);
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
  };

  const handleLeaveStatus = async (leaveId: string, status: RequestStatus) => {
      const updatedLeaves = leaves.map(l => {
          if (l.id === leaveId) return { ...l, status };
          return l;
      });
      setLeaves(updatedLeaves);
      await saveAppData({ tasks, requests, leaves: updatedLeaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
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
    await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
    setLoading(false);
  };

  // TALEP SİLME (AMİR veya USTA (Pending ise))
  const handleDeleteRequest = async (reqId: string) => {
      if(!confirm("Bu talebi silmek istediğinize emin misiniz?")) return;
      setLoading(true);
      const updatedRequests = requests.filter(r => r.id !== reqId);
      setRequests(updatedRequests);
      await saveAppData({ tasks, requests: updatedRequests, leaves, amirs: amirList, ustas: ustaList, deletedTasks: archivedTasks }, connectionId);
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
                    <div className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                            <i className="fas fa-user-tie text-blue-400 group-hover:text-white/80"></i>
                            {isUserOnline(member.lastActive) && (
                                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></span>
                            )}
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                            <span className="flex items-center gap-2 truncate">
                                {member.name}
                                {member.password && <i className="fas fa-lock text-[10px] text-slate-500 group-hover:text-white/50"></i>}
                            </span>
                            {member.lastActive && (
                                <span className="text-[10px] font-normal text-slate-400 group-hover:text-blue-200 truncate">
                                     {formatLastActive(member.lastActive)}
                                </span>
                            )}
                        </div>
                    </div>
                    <i className="fas fa-arrow-right text-slate-600 group-hover:text-white relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 ml-auto"></i>
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
                    <div className="text-slate-200 group-hover:text-white relative z-10 flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                            <i className="fas fa-wrench text-emerald-400 group-hover:text-white/80"></i>
                            {isUserOnline(member.lastActive) && (
                                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></span>
                            )}
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                            <span className="flex items-center gap-2 truncate">
                                {member.name}
                                {member.password && <i className="fas fa-lock text-[10px] text-slate-500 group-hover:text-white/50"></i>}
                            </span>
                            {member.lastActive && (
                                <span className="text-[10px] font-normal text-slate-400 group-hover:text-emerald-200 truncate">
                                     {formatLastActive(member.lastActive)}
                                </span>
                            )}
                        </div>
                    </div>
                    <i className="fas fa-arrow-right text-slate-600 group-hover:text-white relative z-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 ml-auto"></i>
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

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* 1. SEKME: GÖREV LİSTESİ */}
      {activeTab === 'tasks' && (
        <div className="space-y-4 pb-20">
           {/* Üst Kısım: Başlık ve Filtreler */}
           <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                    <i className="fas fa-list-ul text-blue-500"></i>
                    İş Emirleri
                </h2>
                
                {/* Usta Filtresi (Sadece Amirler İçin) */}
                {currentUser.role === 'AMIR' && (
                    <select 
                        value={selectedUstaFilter}
                        onChange={(e) => setSelectedUstaFilter(e.target.value)}
                        className="bg-slate-800 text-white text-xs p-2 rounded-lg border border-slate-700 outline-none"
                    >
                        <option value="ALL">Tüm Personel</option>
                        {ustaList.map(u => (
                            <option key={u.name} value={u.name}>{u.name}</option>
                        ))}
                    </select>
                )}
           </div>
           
           {/* Alt Sekmeler (Aktif / Geçmiş / Arşiv) */}
           <div className="flex bg-slate-800/50 p-1 rounded-xl mb-4 border border-slate-700">
               <button 
                  onClick={() => setActiveTaskTab('active')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTaskTab === 'active' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
               >
                   Aktif
               </button>
               <button 
                  onClick={() => setActiveTaskTab('history')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTaskTab === 'history' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
               >
                   Tamamlanan
               </button>
               {currentUser.role === 'AMIR' && (
                   <button 
                      onClick={() => setActiveTaskTab('deleted')} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTaskTab === 'deleted' ? 'bg-red-900/20 text-red-400 shadow' : 'text-slate-400 hover:text-red-400'}`}
                   >
                       Arşiv
                   </button>
               )}
           </div>

           {/* GÖREV LİSTESİ RENDER MANTIĞI */}
           {(() => {
               // 1. Sekmeye Göre Ana Filtreleme (Aktif / Geçmiş / Arşiv)
               let displayedTasks = [];
               
               if (activeTaskTab === 'active') {
                   // Tamamlanmamış ve İptal edilmemişler
                   displayedTasks = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS);
               } else if (activeTaskTab === 'history') {
                   // Tamamlanmış veya İptal edilmişler
                   displayedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CANCELLED);
               } else if (activeTaskTab === 'deleted') {
                   // Arşivlenmişler
                   displayedTasks = archivedTasks;
               }

               // 2. Kullanıcı Rolüne Göre Filtreleme
               if (currentUser.role === 'USTA') {
                   // Ustalar sadece kendilerine ait görevleri görür
                   displayedTasks = displayedTasks.filter(t => t.masterName === currentUser.name);
               } else if (currentUser.role === 'AMIR' && selectedUstaFilter !== 'ALL') {
                   // Amirler seçili ustaya göre filtreler
                   displayedTasks = displayedTasks.filter(t => t.masterName === selectedUstaFilter);
               }

               // 3. Sıralama (Yeniden eskiye)
               if (activeTaskTab === 'deleted') {
                   displayedTasks.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
               } else {
                   displayedTasks.sort((a, b) => b.createdAt - a.createdAt);
               }

               if (displayedTasks.length === 0) {
                   return (
                       <div className="text-center py-20 opacity-50">
                           <i className="fas fa-clipboard-check text-4xl mb-3 text-slate-600"></i>
                           <p className="text-slate-400 font-bold">Bu alanda görev bulunamadı.</p>
                       </div>
                   );
               }

               return displayedTasks.map(task => (
                   <TaskCard 
                      key={task.id} 
                      task={task} 
                      user={currentUser} 
                      onUpdateStatus={updateTaskStatus} 
                      onDelete={activeTaskTab === 'deleted' ? handlePermanentDelete : handleDeleteTask}
                      onMarkSeen={handleMarkTaskSeen}
                      isArchived={activeTaskTab === 'deleted'}
                   />
               ));
           })()}
        </div>
      )}

      {/* 2. SEKME: TAKVİM */}
      {activeTab === 'calendar' && (
          <CalendarView 
             leaves={leaves}
             user={currentUser}
             onAddLeave={handleAddLeave}
             onDeleteLeave={handleDeleteLeave}
             onUpdateStatus={handleLeaveStatus}
          />
      )}

      {/* 3. SEKME: GÖREV EKLE (Sadece AMİR) */}
      {activeTab === 'add' && currentUser.role === 'AMIR' && (
        <div className="max-w-md mx-auto animate-in zoom-in duration-300">
           <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-100">Yeni İş Emri</h2>
           </div>
          
           <form onSubmit={handleCreateTask} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl space-y-5 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
             
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Makine Adı / Bölge</label>
               <input 
                 type="text" 
                 required
                 className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3.5 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                 placeholder="Örn: CNC-01 veya Kazan Dairesi"
                 value={newTaskMachine}
                 onChange={e => setNewTaskMachine(e.target.value)}
               />
             </div>

             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Görevli Personel</label>
               <div className="grid grid-cols-2 gap-2">
                 {ustaList.map(usta => (
                   <button
                     key={usta.name}
                     type="button"
                     onClick={() => setNewTaskMaster(usta.name)}
                     className={`p-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${
                       newTaskMaster === usta.name 
                       ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50' 
                       : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                     }`}
                   >
                     <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${newTaskMaster === usta.name ? 'bg-white text-blue-600' : 'bg-slate-700'}`}>
                         {usta.name.substring(0,1)}
                     </div>
                     {usta.name}
                   </button>
                 ))}
                 {ustaList.length === 0 && <p className="text-xs text-red-400 col-span-2">Kayıtlı usta bulunamadı. Lütfen profil menüsünden ekleyin.</p>}
               </div>
             </div>

             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Öncelik Seviyesi</label>
               <div className="grid grid-cols-4 gap-2">
                  {Object.values(TaskPriority).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                            newTaskPriority === p 
                            ? 'bg-white text-slate-900 border-white shadow-lg' 
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                        }`}
                      >
                          {p}
                      </button>
                  ))}
               </div>
             </div>

             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">İş Açıklaması</label>
               <textarea 
                 required
                 rows={3}
                 className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                 placeholder="Yapılacak işlemi detaylı açıklayınız..."
                 value={newTaskDescription}
                 onChange={e => setNewTaskDescription(e.target.value)}
               ></textarea>
             </div>

             <div>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-600 hover:border-blue-500 hover:bg-blue-900/10 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-slate-700 group-hover:bg-blue-900/30 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        <i className="fas fa-camera"></i>
                    </div>
                    <div className="flex-1">
                        <span className="block text-xs font-bold text-slate-300 group-hover:text-blue-400">Fotoğraf Ekle (Opsiyonel)</span>
                        <span className="block text-[10px] text-slate-500">Arıza veya makine görseli</span>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*" 
                        onChange={handleImageChange} 
                        className="hidden" 
                    />
                </label>
                {newTaskImage && (
                    <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden shadow-md border border-slate-600">
                        <img src={newTaskImage} alt="Önizleme" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => { setNewTaskImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}
             </div>

             <button 
               type="submit" 
               disabled={loading}
               className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/50 transform active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
               GÖREVİ YAYINLA
             </button>
           </form>
        </div>
      )}

      {/* 4. SEKME: TALEPLER */}
      {activeTab === 'requests' && (
          <div className="space-y-4 pb-20">
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2 mb-4">
                <i className="fas fa-envelope-open-text text-orange-500"></i>
                Malzeme & Talep
              </h2>
              
              {/* Talep Oluşturma (Sadece USTA) */}
              {currentUser.role === 'USTA' && (
                  <form onSubmit={handleCreateRequest} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Yeni Talep Oluştur</label>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm outline-none focus:border-orange-500"
                            placeholder="Malzeme ihtiyacı veya talep..."
                            value={newRequestContent}
                            onChange={e => setNewRequestContent(e.target.value)}
                          />
                          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-4 rounded-xl shadow-lg shadow-orange-900/30">
                              <i className="fas fa-paper-plane"></i>
                          </button>
                      </div>
                  </form>
              )}

              {/* Talep Listesi */}
              <div className="space-y-3">
                  {requests.length === 0 && (
                      <div className="text-center py-10 opacity-50">
                          <i className="fas fa-inbox text-4xl mb-3 text-slate-600"></i>
                          <p className="text-slate-400 font-bold">Henüz talep yok.</p>
                      </div>
                  )}
                  
                  {requests.map(req => (
                      <div key={req.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              req.status === RequestStatus.PENDING ? 'bg-amber-500' : 
                              req.status === RequestStatus.APPROVED ? 'bg-emerald-500' : 'bg-red-500'
                          }`}></div>
                          
                          <div className="flex justify-between items-start pl-3">
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-0.5 rounded-md">{req.ustaName}</span>
                                      <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString('tr-TR')}</span>
                                  </div>
                                  <p className="text-slate-200 text-sm">{req.content}</p>
                                  
                                  <div className="mt-2">
                                      {req.status === RequestStatus.PENDING && <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><i className="fas fa-clock"></i> Bekliyor</span>}
                                      {req.status === RequestStatus.APPROVED && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><i className="fas fa-check-circle"></i> Onaylandı</span>}
                                      {req.status === RequestStatus.REJECTED && <span className="text-[10px] font-bold text-red-500 flex items-center gap-1"><i className="fas fa-times-circle"></i> Reddedildi</span>}
                                  </div>
                              </div>

                              {/* Yönetici Aksiyonları */}
                              {currentUser.role === 'AMIR' && (
                                  <div className="flex flex-col gap-2">
                                      {req.status === RequestStatus.PENDING && (
                                          <>
                                            <button onClick={() => handleRequestStatus(req.id, RequestStatus.APPROVED)} className="w-8 h-8 rounded-lg bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 flex items-center justify-center border border-emerald-900/30">
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button onClick={() => handleRequestStatus(req.id, RequestStatus.REJECTED)} className="w-8 h-8 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center border border-red-900/30">
                                                <i className="fas fa-times"></i>
                                            </button>
                                          </>
                                      )}
                                      <button onClick={() => handleDeleteRequest(req.id)} className="w-8 h-8 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 flex items-center justify-center">
                                          <i className="fas fa-trash-alt text-xs"></i>
                                      </button>
                                  </div>
                              )}
                              
                              {/* Usta Kendi Talebini Silme (Sadece Beklemedeyse) */}
                              {currentUser.role === 'USTA' && req.status === RequestStatus.PENDING && req.ustaName === currentUser.name && (
                                   <button onClick={() => handleDeleteRequest(req.id)} className="w-8 h-8 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 flex items-center justify-center">
                                      <i className="fas fa-trash-alt text-xs"></i>
                                  </button>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 5. SEKME: PROFİL VE AYARLAR */}
      {activeTab === 'profile' && (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
           <h2 className="text-2xl font-black text-slate-100 mb-4">Profil & Ayarlar</h2>

           {/* Kullanıcı Kartı */}
           <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <i className="fas fa-user-circle text-9xl text-white"></i>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300 shadow-inner">
                            {currentUser.name.substring(0,1)}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">{currentUser.name}</h3>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">{currentUser.role === 'AMIR' ? 'YÖNETİCİ' : 'TEKNİK PERSONEL'}</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 text-xs text-slate-400 font-mono mb-4 break-all">
                        ID: {currentUser.id}
                    </div>

                    <button 
                        onClick={toggleWakeLock} 
                        className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${wakeLock ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/40' : 'bg-slate-700 text-slate-300'}`}
                    >
                        <i className={`fas ${wakeLock ? 'fa-sun fa-spin' : 'fa-moon'}`}></i>
                        {wakeLock ? 'EKRAN AÇIK TUTULUYOR' : 'EKRANI AÇIK TUT'}
                    </button>
                </div>
           </div>

           {/* Sistem Durumu (Amir) */}
           {currentUser.role === 'AMIR' && (
               <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <i className="fas fa-server text-blue-500"></i> Sistem Durumu
                    </h4>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                             <span className="text-slate-400">Veri Tabanı:</span>
                             <span className="text-emerald-400 font-bold flex items-center gap-1">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                 Npoint.io (Aktif)
                             </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                             <span className="text-slate-400">Son Senkronizasyon:</span>
                             <span className="text-slate-300 font-mono">{msSinceSync}ms önce</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-500 font-mono break-all border border-slate-700">
                             BIN ID: {connectionId || 'Bağlı Değil'}
                        </div>
                        <div className="pt-2 flex gap-2">
                             <button onClick={() => loadData()} className="flex-1 bg-blue-600/20 text-blue-400 py-2 rounded-lg text-xs font-bold hover:bg-blue-600/40 transition-colors">
                                 <i className="fas fa-sync-alt mr-1"></i> Zorla Yenile
                             </button>
                             <button onClick={requestNotificationPermission} className="flex-1 bg-purple-600/20 text-purple-400 py-2 rounded-lg text-xs font-bold hover:bg-purple-600/40 transition-colors">
                                 <i className="fas fa-bell mr-1"></i> Bildirim İzni
                             </button>
                        </div>
                    </div>
               </div>
           )}

           {/* Personel Yönetimi (SADECE AMİR) */}
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
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-xs font-bold text-slate-300">{member.name}</span>
                                    {member.password && <i className="fas fa-lock text-[10px] text-slate-500" title="Şifreli"></i>}
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
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-300 block">{member.name}</span>
                                        {member.phoneNumber && <span className="text-[9px] text-slate-500 block"><i className="fab fa-whatsapp"></i> {member.phoneNumber}</span>}
                                    </div>
                                    {member.password && <i className="fas fa-lock text-[10px] text-slate-500" title="Şifreli"></i>}
                                </div>
                                <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* İsim Değiştirme Modalı */}
      {renameModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-2xl w-full max-w-xs border border-slate-700 shadow-2xl p-5">
                  <h3 className="text-sm font-black text-slate-100 mb-1">İsim Güncelle</h3>
                  <p className="text-xs text-slate-400 mb-4">Bu işlem tüm geçmiş kayıtları da günceller.</p>
                  
                  <form onSubmit={handleRenameMember}>
                      <input 
                          type="text" 
                          autoFocus
                          placeholder="Yeni İsim"
                          className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm mb-4 outline-none focus:border-blue-500"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                          <button type="button" onClick={() => { setRenameModal(null); setRenameInput(''); }} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-600">
                              İptal
                          </button>
                          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                              Güncelle
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Şifre Değiştirme Modalı */}
      {passwordChangeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-2xl w-full max-w-xs border border-slate-700 shadow-2xl p-5">
                  <h3 className="text-sm font-black text-slate-100 mb-1">Şifre Değiştir</h3>
                  <p className="text-xs text-slate-400 mb-4">{passwordChangeModal.memberName} için yeni şifre belirleyin.</p>
                  
                  <form onSubmit={handleChangePassword}>
                      <input 
                          type="text" 
                          autoFocus
                          placeholder="Yeni Şifre (Boş = Şifresiz)"
                          className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm mb-4 outline-none focus:border-blue-500"
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                          <button type="button" onClick={() => { setPasswordChangeModal(null); setNewPasswordInput(''); }} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-600">
                              İptal
                          </button>
                          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
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