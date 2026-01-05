import { Task, Member, UstaRequest, LeaveRequest } from '../types';

// NPOINT.IO AYARLARI
const API_BASE = 'https://api.npoint.io';

const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Demo ID (Kullanıcının verdiği sabit npoint ID'si)
const DEMO_ID = 'c85115e1d1b4c3276a86';

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

// URL'den veya metinden NPOINT ID'yi ayıklar
export const extractBinId = (input: string): string => {
  let text = input.trim();
  // URL temizleme
  if (text.includes('/')) {
      const parts = text.split('/');
      // npoint.io/docs/ID veya api.npoint.io/ID
      text = parts[parts.length - 1];
  }
  return text;
};

// Sadece bağlantı testi yapar (npoint API üzerinden)
export const checkConnection = async (id: string): Promise<boolean> => {
    if (!id) return false;
    try {
        const response = await fetch(`${API_BASE}/${id}`);
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

// Yeni bir alan oluşturur (npoint üzerinden)
export const createNewBin = async (defaultAmirs: Member[], defaultUstas: Member[]): Promise<string | null> => {
  try {
    const initialData: AppData = {
      tasks: [],
      requests: [],
      leaves: [],
      amirs: defaultAmirs,
      ustas: defaultUstas,
      deletedTasks: [],
      updatedAt: Date.now()
    };
    
    // npoint.io yeni bin oluşturma (POST request to root)
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialData)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.id; // npoint returns { "id": "..." }
    }
    return null;
  } catch (e) {
    console.error("Bin oluşturma hatası:", e);
    return null;
  }
};

// Tüm verileri (Görevler + Personel Listesi) çeker
export const fetchAppData = async (binId?: string): Promise<AppData> => {
  const id = binId || getStoredBinId();
  
  // Varsayılan boş yapı
  const emptyData: AppData = { tasks: [], requests: [], leaves: [], amirs: [], ustas: [], deletedTasks: [], updatedAt: 0 };

  if (!id) {
    const localDataStr = localStorage.getItem(LOCAL_KEY_DATA);
    if (localDataStr) {
       try {
           const parsed = JSON.parse(localDataStr);
           return { 
               ...emptyData, 
               ...parsed,
               requests: Array.isArray(parsed.requests) ? parsed.requests : [],
               leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
               amirs: normalizeMembers(parsed.amirs),
               ustas: normalizeMembers(parsed.ustas),
               deletedTasks: Array.isArray(parsed.deletedTasks) ? parsed.deletedTasks : []
           };
       } catch {
           return emptyData;
       }
    }
    return emptyData;
  }
  
  try {
    const response = await fetch(`${API_BASE}/${id}`);
    if (response.ok) {
      const data = await response.json();
      
      let tasks: Task[] = [];
      let requests: UstaRequest[] = [];
      let leaves: LeaveRequest[] = [];
      let amirs: Member[] = [];
      let ustas: Member[] = [];
      let deletedTasks: Task[] = [];

      // Eski veri yapısı kontrolü (array mi obje mi)
      if (Array.isArray(data)) {
        tasks = data;
      } else {
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        requests = Array.isArray(data.requests) ? data.requests : [];
        leaves = Array.isArray(data.leaves) ? data.leaves : [];
        amirs = normalizeMembers(data.amirs);
        ustas = normalizeMembers(data.ustas);
        deletedTasks = Array.isArray(data.deletedTasks) ? data.deletedTasks : [];
      }
      
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
    console.warn("Veri çekme hatası:", e);
  }
  
  // Hata durumunda local veriyi dön
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  if (local) {
      try {
        const parsed = JSON.parse(local);
        return { 
            ...emptyData, 
            ...parsed,
            requests: Array.isArray(parsed.requests) ? parsed.requests : [],
            leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
            amirs: normalizeMembers(parsed.amirs),
            ustas: normalizeMembers(parsed.ustas),
            deletedTasks: Array.isArray(parsed.deletedTasks) ? parsed.deletedTasks : []
        };
      } catch {
          return emptyData;
      }
  }
  return emptyData;
};

// Tüm veriyi kaydeder (npoint API POST request)
export const saveAppData = async (data: Omit<AppData, 'updatedAt'>, binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  const payload = { ...data, updatedAt: Date.now() };
  
  // Local storage her zaman güncel kalsın
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(payload));

  if (!id) return true;

  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (e) {
    console.error("Kayıt hatası:", e);
    return false;
  }
};

export const getEmergencyId = () => DEMO_ID;