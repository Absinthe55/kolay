
import { Task } from '../types';

// JsonBlob servisi tarayıcı tabanlı POST istekleri için daha güvenilirdir
const API_BASE = 'https://jsonblob.com/api/jsonBlob';
const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Demo amaçlı hazır bir ID (Eğer oluşturma başarısız olursa bu kullanılır)
// Bu ID statik bir test verisidir.
const DEMO_ID = '1347094956795461632'; 

export const getStoredBinId = () => {
  return localStorage.getItem(LOCAL_KEY_ID) || '';
};

export const setStoredBinId = (id: string) => {
  localStorage.setItem(LOCAL_KEY_ID, id.trim());
};

// Yeni bir bulut alanı oluşturur (JsonBlob POST)
export const createNewBin = async (): Promise<string | null> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ tasks: [], updatedAt: Date.now() })
    });
    
    if (response.ok) {
      // JsonBlob ID'yi Location header'ında döndürür
      const location = response.headers.get('Location');
      if (location) {
        const id = location.substring(location.lastIndexOf('/') + 1);
        setStoredBinId(id);
        return id;
      }
    }
  } catch (e) {
    console.error("Bin oluşturulamadı:", e);
  }
  return null;
};

// Verileri çeker (JsonBlob GET)
export const fetchTasks = async (binId?: string): Promise<Task[]> => {
  const id = binId || getStoredBinId();
  
  // Eğer ID yoksa yerel veriyi dön, demo ID'ye gitme (kullanıcıya yanlış veri göstermemek için)
  if (!id) {
    const local = localStorage.getItem(LOCAL_KEY_DATA);
    return local ? JSON.parse(local) : [];
  }
  
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache' // Önbelleği zorla temizle
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.tasks)) {
        localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(data.tasks));
        return data.tasks;
      }
    }
  } catch (e) {
    console.warn("Veri çekilemedi, yerel veri kullanılıyor.");
  }
  
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  return local ? JSON.parse(local) : [];
};

// Veriyi kaydeder (JsonBlob PUT)
export const saveTasks = async (newTasks: Task[], binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId();
  
  // Yerel yedeği al
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(newTasks));

  if (!id) return true; // Sadece yerel kayıt yapıldı

  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ tasks: newTasks, updatedAt: Date.now() })
    });
    return response.ok;
  } catch (e) {
    console.error("Kaydedilemedi", e);
    return false;
  }
};

// Güvenli Ekleme (Optimistic Update + Server Sync)
export const safeAddTask = async (task: Task): Promise<Task[]> => {
  const id = getStoredBinId();
  
  // 1. Önce sunucudaki en güncel veriyi çekmeye çalış
  let currentTasks: Task[] = [];
  try {
    if (id) {
        currentTasks = await fetchTasks(id);
    } else {
        // ID yoksa localden al
        const local = localStorage.getItem(LOCAL_KEY_DATA);
        currentTasks = local ? JSON.parse(local) : [];
    }
  } catch (e) {
     // Hata durumunda localden devam et
     const local = localStorage.getItem(LOCAL_KEY_DATA);
     currentTasks = local ? JSON.parse(local) : [];
  }

  // 2. Yeni listeyi oluştur
  const updatedTasks = [task, ...currentTasks];

  // 3. Sunucuya (varsa) ve yerele kaydet
  await saveTasks(updatedTasks, id);
  return updatedTasks;
};

// Güvenli Güncelleme
export const safeUpdateTask = async (taskId: string, updater: (t: Task) => Task): Promise<Task[]> => {
  const id = getStoredBinId();
  let currentTasks: Task[] = [];

  try {
    if (id) {
        currentTasks = await fetchTasks(id);
    } else {
        const local = localStorage.getItem(LOCAL_KEY_DATA);
        currentTasks = local ? JSON.parse(local) : [];
    }
  } catch {
      const local = localStorage.getItem(LOCAL_KEY_DATA);
      currentTasks = local ? JSON.parse(local) : [];
  }

  const updatedTasks = currentTasks.map(t => t.id === taskId ? updater(t) : t);
  await saveTasks(updatedTasks, id);
  return updatedTasks;
};

// Yedek Kanal ID'sini getirir (Kullanıcı oluşturamazsa bunu kullanır)
export const getEmergencyId = () => DEMO_ID;
