
import { Task } from '../types';

/**
 * Veriler npoint.io üzerinde saklanır. 
 */
const BIN_ID = '785055b8da372d8a4f21'; 
const API_URL = `https://api.npoint.io/${BIN_ID}`;
const LOCAL_STORAGE_KEY = 'hidro_gorev_data';

export const fetchTasks = async (): Promise<Task[]> => {
  try {
    // cache: 'no-store' ekleyerek tarayıcının eski veriyi getirmesini engelliyoruz
    const response = await fetch(`${API_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });

    if (response.ok) {
      const cloudData = await response.json();
      if (cloudData && Array.isArray(cloudData.tasks)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData.tasks));
        return cloudData.tasks;
      }
    }
  } catch (error) {
    console.warn("Bulut verisi çekilemedi, yerel veri kullanılıyor.");
  }

  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  return localData ? JSON.parse(localData) : [];
};

export const saveTasks = async (tasks: Task[]): Promise<boolean> => {
  // Önce her zaman yerele kaydet
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));

  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasks, lastUpdate: Date.now() })
    });

    if (response.status === 404) {
      // Eğer bin silindiyse veya yoksa yeniden oluşturmayı dene
      const createResponse = await fetch(API_URL.replace(`/${BIN_ID}`, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, lastUpdate: Date.now() })
      });
      return createResponse.ok;
    }

    return response.ok;
  } catch (error) {
    console.error("Bulut senkronizasyon hatası:", error);
    return false;
  }
};
