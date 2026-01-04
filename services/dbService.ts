
import { Task } from '../types';

// İki farklı sağlayıcı kullanıyoruz. Biri engelliyse diğeri çalışır.
const PROVIDER_JSONBLOB = {
  name: 'jsonblob',
  api: 'https://jsonblob.com/api/jsonBlob',
  idPattern: /^\d+$/ // Sadece rakamlardan oluşur
};

const PROVIDER_NPOINT = {
  name: 'npoint',
  api: 'https://api.npoint.io',
  idPattern: /^[a-zA-Z0-9]+$/ // Harf ve rakam karışık
};

const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Demo ID (Npoint üzerinden çalışan genel bir test kanalı)
const DEMO_ID = '908d1788734268713503'; 

export const getStoredBinId = () => {
  return localStorage.getItem(LOCAL_KEY_ID) || '';
};

export const setStoredBinId = (id: string) => {
  localStorage.setItem(LOCAL_KEY_ID, id.trim());
};

// ID'nin hangi servise ait olduğunu anlar
const getProviderUrl = (id: string) => {
  if (PROVIDER_JSONBLOB.idPattern.test(id) && id.length > 15) {
    return `${PROVIDER_JSONBLOB.api}/${id}`;
  }
  return `${PROVIDER_NPOINT.api}/${id}`;
};

// Yeni bir bulut alanı oluşturur (Sırayla dener)
export const createNewBin = async (): Promise<string | null> => {
  // 1. Önce JsonBlob dene (Daha hızlı ve stabil)
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
      // Veri yapısını kontrol et (jsonblob 'tasks' döner, npoint direkt obje dönebilir yapıda)
      const tasks = data.tasks || (Array.isArray(data) ? data : []);
      
      if (Array.isArray(tasks)) {
        localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(tasks));
        return tasks;
      }
    }
  } catch (e) {
    console.warn("Veri çekme hatası:", e);
  }
  
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  return local ? JSON.parse(local) : [];
};

// Veriyi kaydeder
export const saveTasks = async (newTasks: Task[], binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(newTasks));

  if (!id) return true;

  const url = getProviderUrl(id);
  const method = url.includes('jsonblob') ? 'PUT' : 'POST'; // Npoint update için POST kullanabilir

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
