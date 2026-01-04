import { GoogleGenAI } from "@google/genai";

export const generateTaskDescription = async (machineName: string, problem: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Bir hidrolik birim amiriyim. ${machineName} makinesinde şu sorun var: "${problem}". 
      Lütfen bu sorunu çözecek usta için profesyonel, adım adım bir teknik talimat yaz. 
      Dili Türkçe olsun ve güvenlik önlemlerini (LOTO, basınç tahliyesi vb.) mutlaka ekle.`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });
    return response.text || "Talimat oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Yapay zeka şu an yanıt veremiyor, lütfen manuel açıklama giriniz.";
  }
};

export const analyzeTaskCompletion = async (taskDescription: string, masterComment: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Görev: ${taskDescription}\nUsta Notu: ${masterComment}\n\nBu raporu analiz et ve yapılması gereken ek bir kontrol varsa kısaca belirt.`,
    });
    return response.text || "";
  } catch (error) {
    return "";
  }
};