
import { Task } from '../types';

/**
 * ÖNEMLİ: Veriler npoint.io üzerinde herkese açık bir "bin" içinde saklanır.
 * Gerçek üretim ortamında Supabase veya Firebase gibi şifreli sistemler önerilir.
 * '785055b8da372d8a4f21' bu uygulama için ayrılmış benzersiz bir ID'dir.
 */

const BIN_ID = '785055b8da372d8a4f21'; 
const API_URL = `https://api.npoint.io/${BIN_ID}`;

export const fetchTasks = async (): Promise<Task[]> => {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Bağlantı Hatası: ${response.status}`);
    }

    const data = await response.json();
    return (data && Array.isArray(data.tasks)) ? data.tasks : [];
  } catch (error) {
    console.error("Veri çekilemedi:", error);
    return [];
  }
};

export const saveTasks = async (tasks: Task[]): Promise<boolean> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasks })
    });
    return response.ok;
  } catch (error) {
    console.error("Veri kaydedilemedi:", error);
    return false;
  }
};
