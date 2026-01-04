
import { Task } from '../types';

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

// Sadece bağlantı testi yapar (Veri indirmez)
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

// Yeni bir bulut alanı oluşturur (Sırayla dener)
export const createNewBin = async (): Promise<string | null> => {
  // 1. Önce JsonBlob dene
  try {
    const response = await fetch(PROVIDER_JSONBLOB.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tasks: [], updatedAt: Date.now() })
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
      body: JSON.stringify({ tasks: [], updatedAt: Date.now() })
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

// Verileri çeker
export const fetchTasks = async (binId?: string): Promise<Task[]> => {
  const id = binId || getStoredBinId();
  
  if (!id) {
    const local = localStorage.getItem(LOCAL_KEY_DATA);
    return local ? JSON.parse(local) : [];
  }
  
  const url = getProviderUrl(id);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      const data = await response.json();
      const tasks = data.tasks || (Array.isArray(data) ? data : []);
      
      if (Array.isArray(tasks)) {
        localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(tasks));
        return tasks;
      }
    }
  } catch (e) {
    console.warn("Veri çekme hatası:", e);
  }
  
  // Hata durumunda local veriyi dön
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  return local ? JSON.parse(local) : [];
};

// Veriyi kaydeder
export const saveTasks = async (newTasks: Task[], binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(newTasks));

  if (!id) return true;

  const url = getProviderUrl(id);
  const method = url.includes('jsonblob') ? 'PUT' : 'POST'; 

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ tasks: newTasks, updatedAt: Date.now() })
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

// Güvenli Ekleme
export const safeAddTask = async (task: Task): Promise<Task[]> => {
  const id = getStoredBinId();
  let currentTasks: Task[] = [];
  try {
    currentTasks = id ? await fetchTasks(id) : JSON.parse(localStorage.getItem(LOCAL_KEY_DATA) || '[]');
  } catch {
    currentTasks = JSON.parse(localStorage.getItem(LOCAL_KEY_DATA) || '[]');
  }

  const updatedTasks = [task, ...currentTasks];
  await saveTasks(updatedTasks, id);
  return updatedTasks;
};

// Güvenli Güncelleme
export const safeUpdateTask = async (taskId: string, updater: (t: Task) => Task): Promise<Task[]> => {
  const id = getStoredBinId();
  let currentTasks: Task[] = [];
  try {
    currentTasks = id ? await fetchTasks(id) : JSON.parse(localStorage.getItem(LOCAL_KEY_DATA) || '[]');
  } catch {
    currentTasks = JSON.parse(localStorage.getItem(LOCAL_KEY_DATA) || '[]');
  }

  const updatedTasks = currentTasks.map(t => t.id === taskId ? updater(t) : t);
  await saveTasks(updatedTasks, id);
  return updatedTasks;
};

export const getEmergencyId = () => DEMO_ID;
