
import { Task } from '../types';

const BASE_API_URL = 'https://api.npoint.io';
const DEFAULT_SYNC_KEY = 'hidro_fabrika_77'; // Varsayılan genel kod
const LOCAL_STORAGE_KEY = 'hidro_gorev_data';
const SYNC_KEY_STORAGE = 'hidro_sync_id';

// Kullanıcının özel birim kodunu al veya varsayılanı döndür
export const getSyncKey = () => {
  return localStorage.getItem(SYNC_KEY_STORAGE) || DEFAULT_SYNC_KEY;
};

export const setSyncKey = (key: string) => {
  localStorage.setItem(SYNC_KEY_STORAGE, key.trim());
};

export const fetchTasks = async (): Promise<Task[]> => {
  const syncKey = getSyncKey();
  try {
    // URL'ye her seferinde farklı bir sayı ekleyerek telefonun eski veriyi getirmesini engelliyoruz
    const response = await fetch(`${BASE_API_URL}/${syncKey}?t=${Math.random()}`, {
      method: 'GET',
      headers: { 
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const cloudData = await response.json();
      if (cloudData && Array.isArray(cloudData.tasks)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData.tasks));
        return cloudData.tasks;
      }
    }
  } catch (error) {
    console.warn("Bulut verisi çekilemedi:", error);
  }

  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  return localData ? JSON.parse(localData) : [];
};

export const saveTasks = async (tasks: Task[]): Promise<boolean> => {
  const syncKey = getSyncKey();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));

  try {
    const response = await fetch(`${BASE_API_URL}/${syncKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, updated: Date.now() })
    });

    if (response.status === 404) {
      // Eğer bu birim koduyla ilk kez veri gönderiliyorsa oluştur
      const createResponse = await fetch(BASE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, updated: Date.now() })
      });
      // Not: npoint POST yapınca yeni bir ID verir. 
      // Ancak biz PUT ile belirli bir key üzerinden gitmeyi tercih ediyoruz.
      return createResponse.ok;
    }

    return response.ok;
  } catch (error) {
    console.error("Kayıt hatası:", error);
    return false;
  }
};
