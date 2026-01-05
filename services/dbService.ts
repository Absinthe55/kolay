
import { Task, Member, UstaRequest, LeaveRequest } from '../types';

// İki farklı sağlayıcı kullanıyoruz.
const PROVIDER_JSONBLOB = {
  name: 'jsonblob',
  api: 'https://jsonblob.com/api/jsonBlob'
};

const PROVIDER_NPOINT = {
  name: 'npoint',
  api: 'https://api.npoint.io'
};

const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Demo ID
const DEMO_ID = '908d1788734268713503'; 

// Silinen Görevlerin Arşivleneceği Sabit ID
const ARCHIVE_BIN_ID = 'b377ac3abf9b89fad6b0';

export interface AppData {
  tasks: Task[];
  requests: UstaRequest[];
  leaves: LeaveRequest[];
  amirs: Member[];
  ustas: Member[];
  updatedAt: number;
}

export const getStoredBinId = () => {
  return localStorage.getItem(LOCAL_KEY_ID) || '';
};

export const setStoredBinId = (id: string) => {
  localStorage.setItem(LOCAL_KEY_ID, id.trim());
};

// Kullanıcının girdiği karmaşık URL'den ID'yi ayıklar
export const extractBinId = (input: string): string => {
  let text = input.trim();
  // URL temizleme
  if (text.includes('/')) {
      // Son slash'tan sonrasını al (örn: npoint.io/docs/123 -> 123)
      const parts = text.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart) text = lastPart;
  }
  return text;
};

// ID'nin hangi servise ait olduğunu anlar
const getProviderUrl = (id: string) => {
  // JsonBlob ID'leri sadece rakam ve uzun
  if (/^\d+$/.test(id) && id.length > 15) {
    return `${PROVIDER_JSONBLOB.api}/${id}`;
  }
  // Npoint ID'leri alfanümerik
  return `${PROVIDER_NPOINT.api}/${id}`;
};

// Sadece bağlantı testi yapar
export const checkConnection = async (id: string): Promise<boolean> => {
    if (!id) return false;
    const url = getProviderUrl(id);
    try {
        const response = await fetch(url, { method: 'GET' });
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

// Yeni bir bulut alanı oluşturur
export const createNewBin = async (defaultAmirs: Member[], defaultUstas: Member[]): Promise<string | null> => {
  const initialData: AppData = {
    tasks: [],
    requests: [],
    leaves: [],
    amirs: defaultAmirs,
    ustas: defaultUstas,
    updatedAt: Date.now()
  };

  // 1. Önce JsonBlob dene
  try {
    const response = await fetch(PROVIDER_JSONBLOB.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(initialData)
    });
    
    if (response.ok) {
      const location = response.headers.get('Location');
      if (location) {
        const id = location.substring(location.lastIndexOf('/') + 1);
        setStoredBinId(id);
        return id;
      }
    }
  } catch (e) {
    console.warn("JsonBlob oluşturulamadı, Npoint deneniyor...", e);
  }

  // 2. Başarısızsa Npoint dene
  try {
    const response = await fetch(PROVIDER_NPOINT.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialData)
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.id) {
        setStoredBinId(data.id);
        return data.id;
      }
    }
  } catch (e) {
    console.error("Hiçbir servis yanıt vermedi:", e);
  }

  return null;
};

// Silinen Görevleri Arşivler (İkinci veritabanı bağlantısı)
export const archiveDeletedTask = async (task: Task) => {
  const url = getProviderUrl(ARCHIVE_BIN_ID);
  
  try {
    // 1. Mevcut arşiv verisini çek
    const response = await fetch(url);
    let deletedTasks: Task[] = [];
    
    if (response.ok) {
        const data = await response.json();
        // Veri yapısını kontrol et (Düz array mi obje mi)
        if (Array.isArray(data)) {
            deletedTasks = data;
        } else if (data && Array.isArray(data.deletedTasks)) {
            deletedTasks = data.deletedTasks;
        }
    }

    // 2. Yeni silinen görevi listeye ekle (En başa)
    const taskToArchive = { ...task, deletedAt: Date.now() };
    deletedTasks.unshift(taskToArchive);

    // 3. Arşivi güncelle
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedTasks, updatedAt: Date.now() })
    });
    console.log("Görev arşivlendi:", task.machineName);
    
  } catch (e) {
      console.error("Arşivleme hatası:", e);
      // Arşivleme hatası ana akışı bozmamalı
  }
};

// Arşivlenmiş (Silinmiş) Görevleri Çeker
export const fetchArchivedTasks = async (): Promise<Task[]> => {
    const url = getProviderUrl(ARCHIVE_BIN_ID);
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.deletedTasks)) return data.deletedTasks;
        }
    } catch (e) {
        console.error("Arşiv çekme hatası:", e);
    }
    return [];
};

// Arşivden Kalıcı Olarak Silme
export const permanentlyDeleteTask = async (taskId: string): Promise<boolean> => {
    const url = getProviderUrl(ARCHIVE_BIN_ID);
    try {
        // 1. Mevcut arşivi çek
        const currentTasks = await fetchArchivedTasks();
        
        // 2. İlgili görevi filtrele
        const updatedTasks = currentTasks.filter(t => t.id !== taskId);

        // 3. Güncel listeyi kaydet
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deletedTasks: updatedTasks, updatedAt: Date.now() })
        });
        
        return response.ok;
    } catch (e) {
        console.error("Kalıcı silme hatası:", e);
        return false;
    }
};

// Tüm verileri (Görevler + Personel Listesi) çeker
export const fetchAppData = async (binId?: string): Promise<AppData> => {
  const id = binId || getStoredBinId();
  
  // Varsayılan boş yapı
  const emptyData: AppData = { tasks: [], requests: [], leaves: [], amirs: [], ustas: [], updatedAt: 0 };

  if (!id) {
    const localDataStr = localStorage.getItem(LOCAL_KEY_DATA);
    if (localDataStr) {
       const parsed = JSON.parse(localDataStr);
       // Eğer eski formatsa (tasks array)
       if (Array.isArray(parsed)) return { ...emptyData, tasks: parsed };
       
       return { 
           ...emptyData, 
           ...parsed,
           requests: Array.isArray(parsed.requests) ? parsed.requests : [],
           leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
           amirs: normalizeMembers(parsed.amirs),
           ustas: normalizeMembers(parsed.ustas)
       };
    }
    return emptyData;
  }
  
  const url = getProviderUrl(id);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      let tasks: Task[] = [];
      let requests: UstaRequest[] = [];
      let leaves: LeaveRequest[] = [];
      let amirs: Member[] = [];
      let ustas: Member[] = [];

      if (Array.isArray(data)) {
        tasks = data;
      } else {
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        requests = Array.isArray(data.requests) ? data.requests : [];
        leaves = Array.isArray(data.leaves) ? data.leaves : [];
        amirs = normalizeMembers(data.amirs);
        ustas = normalizeMembers(data.ustas);
      }
      
      const normalizedData: AppData = { tasks, requests, leaves, amirs, ustas, updatedAt: data.updatedAt || Date.now() };
      
      localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(normalizedData));
      return normalizedData;
    }
  } catch (e) {
    console.warn("Veri çekme hatası:", e);
  }
  
  // Hata durumunda local veriyi dön
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return { ...emptyData, tasks: parsed };
      return { 
          ...emptyData, 
          ...parsed,
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
          leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
          amirs: normalizeMembers(parsed.amirs),
          ustas: normalizeMembers(parsed.ustas)
      };
  }
  return emptyData;
};

// Tüm veriyi kaydeder
export const saveAppData = async (data: Omit<AppData, 'updatedAt'>, binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  const payload = { ...data, updatedAt: Date.now() };
  
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(payload));

  if (!id) return true;

  const url = getProviderUrl(id);
  const method = url.includes('jsonblob') ? 'PUT' : 'POST'; 

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

export const getEmergencyId = () => DEMO_ID;
