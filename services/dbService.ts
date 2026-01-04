
import { Task } from '../types';

const API_BASE = 'https://api.npoint.io';
const LOCAL_KEY_ID = 'hidro_bin_id';
const LOCAL_KEY_DATA = 'hidro_data';

// Varsayılan boş bir havuz (Demo için)
const DEMO_ID = '908d1788734268713503'; 

export const getStoredBinId = () => {
  return localStorage.getItem(LOCAL_KEY_ID) || '';
};

export const setStoredBinId = (id: string) => {
  localStorage.setItem(LOCAL_KEY_ID, id.trim());
};

// Yeni bir bulut alanı oluşturur
export const createNewBin = async (): Promise<string | null> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: [], updatedAt: Date.now() })
    });
    
    if (response.ok) {
      const data = await response.json();
      // npoint { "id": "..." } döner
      if (data && data.id) {
        setStoredBinId(data.id);
        return data.id;
      }
    }
  } catch (e) {
    console.error("Bin oluşturulamadı", e);
  }
  return null;
};

// Verileri çeker
export const fetchTasks = async (binId?: string): Promise<Task[]> => {
  const id = binId || getStoredBinId() || DEMO_ID;
  
  try {
    const response = await fetch(`${API_BASE}/${id}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.tasks)) {
        localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(data.tasks));
        return data.tasks;
      }
    }
  } catch (e) {
    console.warn("Veri çekilemedi, yerel veri gösteriliyor.");
  }
  
  const local = localStorage.getItem(LOCAL_KEY_DATA);
  return local ? JSON.parse(local) : [];
};

// Veriyi kaydeder (Önce indir, birleştir, sonra yükle - Optimistic Locking benzeri)
export const saveTasks = async (newTasks: Task[], binId?: string): Promise<boolean> => {
  const id = binId || getStoredBinId() || DEMO_ID;
  
  // Önce yerele yedekle
  localStorage.setItem(LOCAL_KEY_DATA, JSON.stringify(newTasks));

  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'POST', // Npoint güncelleme için POST kullanabilir
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: newTasks, updatedAt: Date.now() })
    });
    return response.ok;
  } catch (e) {
    console.error("Kaydedilemedi", e);
    return false;
  }
};

// Tek bir görevi güvenli ekleme (Çakışma önleyici)
export const safeAddTask = async (task: Task): Promise<Task[]> => {
  const id = getStoredBinId() || DEMO_ID;
  
  try {
    // 1. En güncel veriyi çek
    const currentTasks = await fetchTasks(id);
    // 2. Yeni görevi ekle
    const updatedTasks = [task, ...currentTasks];
    // 3. Geri yükle
    await saveTasks(updatedTasks, id);
    return updatedTasks;
  } catch (e) {
    // Hata olursa sadece yerel veriye ekle ve döndür
    const local = await fetchTasks(id);
    return [task, ...local];
  }
};

// Durum güncelleme (Çakışma önleyici)
export const safeUpdateTask = async (taskId: string, updater: (t: Task) => Task): Promise<Task[]> => {
  const id = getStoredBinId() || DEMO_ID;
  try {
    const currentTasks = await fetchTasks(id);
    const updatedTasks = currentTasks.map(t => t.id === taskId ? updater(t) : t);
    await saveTasks(updatedTasks, id);
    return updatedTasks;
  } catch (e) {
    return [];
  }
};
