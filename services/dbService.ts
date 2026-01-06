import { Task, Member, UstaRequest, LeaveRequest } from '../types';

// FIREBASE REALTIME DATABASE AYARLARI
const API_BASE = 'https://websitem-41bb4-default-rtdb.europe-west1.firebasedatabase.app';

const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Demo ID (Varsayılan test kanalı)
const DEMO_ID = 'demo_kanal_v1';

export interface AppData {
  tasks: Task[];
  requests: UstaRequest[];
  leaves: LeaveRequest[];
  amirs: Member[];
  ustas: Member[];
  deletedTasks: Task[]; 
  updatedAt: number;
}

export const getStoredBinId = () => {
  return localStorage.getItem(LOCAL_KEY_ID) || '';
};

export const setStoredBinId = (id: string) => {
  localStorage.setItem(LOCAL_KEY_ID, id.trim());
};

// URL'den veya metinden ID'yi ayıklar
export const extractBinId = (input: string): string => {
  let text = input.trim();
  
  // Önce yaygın uzantıları temizle
  text = text.replace(/\.json$/, ''); // Sonda .json varsa sil
  if (text.endsWith('/')) text = text.slice(0, -1); // Sonda slash varsa sil

  // Firebase URL kontrolü
  if (text.includes('firebasedatabase.app')) {
      const parts = text.split('/');
      const lastPart = parts[parts.length - 1];
      // Eğer ana domaini yapıştırdıysa (id yoksa) boş dön
      if (lastPart.includes('firebasedatabase.app')) return '';
      return lastPart;
  } 
  // Başka bir URL ise (örn: eski npoint linkleri veya genel linkler)
  else if (text.includes('/')) {
      const parts = text.split('/');
      return parts[parts.length - 1];
  }
  
  return text;
};

// Sadece bağlantı testi yapar (ID boş mu dolu mu kontrol eder)
export const checkConnection = async (id: string): Promise<boolean> => {
    if (!id) return false;
    try {
        const response = await fetch(`${API_BASE}/${id}.json`);
        // Firebase null dönerse veri yok demektir ama bağlantı var demektir. 
        // 404 dönmez, null döner. Erişim varsa true dönelim.
        return response.ok;
    } catch {
        return false;
    }
};

// Yardımcı Fonksiyon: String listesini veya Member listesini normalize et
const normalizeMembers = (data: any[]): Member[] => {
    if (!Array.isArray(data)) return [];
    return data.map(item => {
        if (typeof item === 'string') {
            return { name: item, password: '' };
        }
        return item; // Zaten Member objesi
    });
};

// Rastgele ID oluşturucu (Firebase push ID benzeri ama basit)
const generateId = () => {
    return 'bin_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// Yeni bir alan oluşturur (Firebase PUT request)
export const createNewBin = async (defaultAmirs: Member[], defaultUstas: Member[]): Promise<string | null> => {
  try {
    const newId = generateId();
    const initialData: AppData = {
      tasks: [],
      requests: [],
      leaves: [],
      amirs: defaultAmirs,
      ustas: defaultUstas,
      deletedTasks: [],
      updatedAt: Date.now()
    };
    
    // Firebase'de belirli bir ID'ye PUT yaparak veriyi yazarız
    const response = await fetch(`${API_BASE}/${newId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialData)
    });
    
    if (response.ok) {
      return newId;
    }
    return null;
  } catch (e) {
    console.error("Grup oluşturma hatası:", e);
    return null;
  }
};

// Tüm verileri çeker
export const fetchAppData = async (binId?: string): Promise<AppData> => {
  const id = binId || getStoredBinId();
  
  // Varsayılan boş yapı
  const emptyData: AppData = { tasks: [], requests: [], leaves: [], amirs: [], ustas: [], deletedTasks: [], updatedAt: 0 };

  if (!id) {
    // ID yoksa localden okumayı dene
    const localDataStr = localStorage.getItem(LOCAL_KEY_DATA);
    if (localDataStr) {
       try {
           const parsed = JSON.parse(localDataStr);
           return { ...emptyData, ...parsed };
       } catch { return emptyData; }
    }
    return emptyData;
  }
  
  try {
    // Firebase GET request
    const response = await fetch(`${API_BASE}/${id}.json`);

    if (response.ok) {
      const data = await response.json();
      
      // Veri yoksa (yeni ID veya silinmiş)
      if (!data) return emptyData;

      let tasks: Task[] = [];
      let requests: UstaRequest[] = [];
      let leaves: LeaveRequest[] = [];
      let amirs: Member[] = [];
      let ustas: Member[] = [];
      let deletedTasks: Task[] = [];

      tasks = Array.isArray(data.tasks) ? data.tasks : [];
      requests = Array.isArray(data.requests) ? data.requests : [];
      leaves = Array.isArray(data.leaves) ? data.leaves : [];
      amirs = normalizeMembers(data.amirs || []);
      ustas = normalizeMembers(data.ustas || []);
      deletedTasks = Array.isArray(data.deletedTasks) ? data.deletedTasks : [];
      
      const normalizedData: AppData = { 
          tasks, 
          requests, 
          leaves, 
          amirs, 
          ustas, 
          deletedTasks, 
          updatedAt: data.updatedAt || Date.now() 
      };
      
      localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(normalizedData));
      return normalizedData;
    }
  } catch (e) {
    console.warn("Firebase veri çekme hatası:", e);
  }
  
  // Hata durumunda local veriyi dön
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  if (local) {
      try {
        const parsed = JSON.parse(local);
        return { ...emptyData, ...parsed };
      } catch { return emptyData; }
  }
  return emptyData;
};

// Tüm veriyi kaydeder (Firebase PUT request - Tam üzerine yazma)
export const saveAppData = async (data: Omit<AppData, 'updatedAt'>, binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  const payload = { ...data, updatedAt: Date.now() };
  
  // Local storage her zaman güncel kalsın
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(payload));

  if (!id) return true;

  try {
    const response = await fetch(`${API_BASE}/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (e) {
    console.error("Firebase kayıt hatası:", e);
    return false;
  }
};

export const getEmergencyId = () => DEMO_ID;
