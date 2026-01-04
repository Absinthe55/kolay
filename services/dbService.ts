
import { Task } from '../types';

/**
 * Veriler npoint.io üzerinde saklanır. 
 * '785055b8da372d8a4f21' bu uygulama için ayrılmış benzersiz bir ID'dir.
 */

const BIN_ID = '785055b8da372d8a4f21'; 
const API_URL = `https://api.npoint.io/${BIN_ID}`;
const LOCAL_STORAGE_KEY = 'hidro_gorev_data';

export const fetchTasks = async (): Promise<Task[]> => {
  // Önce yerel veriyi al (Hız için)
  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  let tasks: Task[] = localData ? JSON.parse(localData) : [];

  try {
    // Buluttan en güncel veriyi çekmeyi dene
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const cloudData = await response.json();
      if (cloudData && Array.isArray(cloudData.tasks)) {
        // Bulut verisi daha güncelse yereli güncelle
        tasks = cloudData.tasks;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
      }
    }
  } catch (error) {
    console.warn("Bulut verisi çekilemedi, yerel veri kullanılıyor.");
  }

  return tasks;
};

export const saveTasks = async (tasks: Task[]): Promise<boolean> => {
  // 1. Her zaman yerel hafızaya kaydet (Güvenlik için)
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));

  try {
    // 2. Buluta PUT metodu ile gönder (npoint.io güncelleme için PUT bekler)
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasks })
    });

    // Eğer bin mevcut değilse (404), ilk kez oluşturmak için POST dene
    if (response.status === 404) {
      const createResponse = await fetch(API_URL.replace(`/${BIN_ID}`, ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
      return createResponse.ok;
    }

    return response.ok;
  } catch (error) {
    console.error("Bulut senkronizasyon hatası:", error);
    return false; // Yerel kayıt başarılı olduğu için kullanıcıya sadece uyarı gidecek
  }
};
