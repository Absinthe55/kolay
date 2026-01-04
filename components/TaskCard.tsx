
import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, User } from '../types';

interface TaskCardProps {
  task: Task;
  user: User;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus, comment?: string, completedImage?: string) => void;
  onDelete?: (taskId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, user, onUpdateStatus, onDelete }) => {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const [completedImage, setCompletedImage] = useState<string | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState<{url: string, title: string} | null>(null);
  // Tamamlanmış veya İptal edilmiş görevler varsayılan olarak kapalı gelsin
  const [isCollapsed, setIsCollapsed] = useState(task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED);
  const [isProcessing, setIsProcessing] = useState(false);

  const statusColors = {
    [TaskStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
    [TaskStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    [TaskStatus.CANCELLED]: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const priorityColors = {
    [TaskPriority.LOW]: 'text-slate-500',
    [TaskPriority.MEDIUM]: 'text-blue-500',
    [TaskPriority.HIGH]: 'text-orange-500',
    [TaskPriority.CRITICAL]: 'text-red-600 font-bold',
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = () => {
    if (!task.startedAt) return null;
    const end = task.completedAt || Date.now();
    const diff = end - task.startedAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) return `${hours}s ${mins}dk`;
    return `${mins}dk`;
  };

  const handleStatusChange = () => {
    if (task.status === TaskStatus.PENDING) {
      onUpdateStatus(task.id, TaskStatus.IN_PROGRESS);
    } else if (task.status === TaskStatus.IN_PROGRESS) {
      setShowCommentInput(true);
      // Formu açtığımızda kartı genişletelim ki rahat görünsün
      setIsCollapsed(false);
    }
  };

  const handleCancelTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bu görevi iptal etmek istediğinize emin misiniz?')) {
      onUpdateStatus(task.id, TaskStatus.CANCELLED, 'Yönetici tarafından iptal edildi.');
    }
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(task.id);
  };

  // Tamamlama Resmi İşleme
  const handleCompletedImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setCompletedImage(compressedBase64);
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submitCompletion = () => {
    onUpdateStatus(task.id, TaskStatus.COMPLETED, comment, completedImage || undefined);
    setShowCommentInput(false);
    setComment('');
    setCompletedImage(null);
    setIsCollapsed(true); // Tamamlanınca kartı kapat
  };

  const isCancelled = task.status === TaskStatus.CANCELLED;

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 transition-all hover:shadow-md mb-3 ${isCancelled ? 'opacity-60 grayscale' : ''} ${isCollapsed ? 'overflow-hidden' : 'p-4'}`}>
        
        {/* Header - Tıklanabilir Alan */}
        <div 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className={`flex justify-between items-start cursor-pointer select-none ${isCollapsed ? 'p-3 bg-slate-50' : 'mb-3'}`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
               <i className="fas fa-chevron-down text-slate-400 text-xs"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusColors[task.status]}`}>
                  {task.status === TaskStatus.PENDING ? 'BEKLİYOR' : 
                  task.status === TaskStatus.IN_PROGRESS ? 'ÇALIŞILIYOR' : 
                  task.status === TaskStatus.COMPLETED ? 'TAMAMLANDI' : 'İPTAL EDİLDİ'}
                </span>
                {isCollapsed && (
                    <span className="text-xs font-bold text-slate-700 truncate">{task.machineName}</span>
                )}
              </div>
              {!isCollapsed && (
                <h3 className={`mt-2 font-bold text-slate-800 text-lg leading-tight ${isCancelled ? 'line-through decoration-2 decoration-red-400' : ''}`}>
                  {task.machineName}
                </h3>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 min-w-[70px]">
              <div className={`text-xs flex items-center gap-1 ${priorityColors[task.priority]}`}>
                  <i className="fas fa-circle text-[8px]"></i>
                  {task.priority}
              </div>
              
              <div className="flex items-center gap-1 mt-1">
                 {/* SİLME BUTONU - HER ZAMAN GÖRÜNÜR (AMIR İÇİN) */}
                 {user.role === 'AMIR' && onDelete && (
                      <button 
                          onClick={handleDeleteTask}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm"
                          title="Görevi Tamamen Sil"
                      >
                          <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                 )}

                 {/* İPTAL BUTONU (Sadece Aktif Görevler İçin) */}
                 {user.role === 'AMIR' && !isCancelled && task.status !== TaskStatus.COMPLETED && (
                      <button 
                          onClick={handleCancelTask}
                          className="text-[10px] text-red-500 font-bold border border-red-200 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors h-6 flex items-center"
                          title="Görevi İptal Et"
                      >
                          İPTAL
                      </button>
                 )}
              </div>

              {isCollapsed && task.completedAt && (
                  <span className="text-[10px] text-slate-400 font-mono">{formatTime(task.completedAt)}</span>
              )}
          </div>
        </div>

        {/* İçerik (Daraltıldığında gizlenir) */}
        {!isCollapsed && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            <div className="text-sm text-slate-600 mb-3 whitespace-pre-wrap line-clamp-4 leading-relaxed">
              {task.description}
            </div>

            {/* Resimler (Görev ve Bitiş Resmi) */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                {/* Orijinal Görev Resmi */}
                {task.image && (
                  <button 
                    onClick={() => setIsImageExpanded({url: task.image!, title: 'Görev Resmi'})}
                    className="relative group w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200"
                  >
                    <img src={task.image} alt="Görev" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-search text-white"></i>
                    </div>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] p-1 text-center truncate">Arıza</span>
                  </button>
                )}

                {/* Bitiş Resmi */}
                {task.completedImage && (
                  <button 
                    onClick={() => setIsImageExpanded({url: task.completedImage!, title: 'Tamamlanan İş'})}
                    className="relative group w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-emerald-200"
                  >
                    <img src={task.completedImage} alt="Bitiş" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-check text-white"></i>
                    </div>
                    <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/80 text-white text-[8px] p-1 text-center truncate">Yapılan İş</span>
                  </button>
                )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
              <span className="flex items-center gap-1">
                <i className="fas fa-user"></i> {task.masterName}
              </span>
              <span className="flex items-center gap-1">
                <i className="far fa-calendar"></i> {new Date(task.createdAt).toLocaleDateString('tr-TR')}
              </span>
            </div>

            {/* Süre Takip Alanı */}
            {(task.startedAt || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.COMPLETED) && !isCancelled && (
              <div className="grid grid-cols-3 gap-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-center">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Başlama</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{formatTime(task.startedAt)}</span>
                </div>
                <div className="text-center border-l border-slate-200 border-r">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Bitiş</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{task.completedAt ? formatTime(task.completedAt) : '--:--'}</span>
                </div>
                <div className="text-center">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Süre</span>
                    <span className="text-xs font-mono font-bold text-blue-600">{calculateDuration()}</span>
                </div>
              </div>
            )}

            {task.comments && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-400 text-sm italic text-slate-700">
                <p className="font-bold text-[10px] text-emerald-600 uppercase mb-1">
                  {isCancelled ? 'İptal Notu:' : 'Usta Raporu:'}
                </p>
                "{task.comments}"
              </div>
            )}

            {user.role === 'USTA' && !isCancelled && task.status !== TaskStatus.COMPLETED && (
              <div className="space-y-3">
                {!showCommentInput ? (
                  <button 
                    onClick={handleStatusChange}
                    className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 ${
                      task.status === TaskStatus.PENDING 
                      ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg' 
                      : 'bg-emerald-600 text-white shadow-emerald-200 shadow-lg'
                    }`}
                  >
                    <i className={`fas ${task.status === TaskStatus.PENDING ? 'fa-play' : 'fa-check-double'}`}></i>
                    {task.status === TaskStatus.PENDING ? 'BAŞLA' : 'BİTİR VE ONAYLA'}
                  </button>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Tamamlama Raporu</h4>
                    
                    <textarea 
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm mb-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      rows={3}
                      placeholder="Yapılan işlemleri detaylı yazınız..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    ></textarea>

                    <div className="mb-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            <i className="fas fa-camera"></i> Fotoğraf Ekle
                        </label>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleCompletedImageChange}
                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                        {isProcessing && <p className="text-[10px] text-blue-500 mt-1">Fotoğraf işleniyor...</p>}
                        {completedImage && (
                            <div className="mt-2 relative inline-block">
                                <img src={completedImage} alt="Önizleme" className="h-16 rounded border border-slate-300" />
                                <button onClick={() => setCompletedImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setShowCommentInput(false); setComment(''); setCompletedImage(null); }}
                        className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50"
                      >
                        İPTAL
                      </button>
                      <button 
                        onClick={submitCompletion}
                        disabled={!comment.trim() || isProcessing}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-emerald-200 shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ONAYLA
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Resim Büyütme Modalı */}
        {isImageExpanded && (
            <div 
                className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={() => setIsImageExpanded(null)}
            >
                <div className="max-w-full max-h-full flex flex-col items-center">
                    <img src={isImageExpanded.url} alt="Büyük" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                    <p className="text-white mt-4 font-bold text-lg">{isImageExpanded.title}</p>
                    <button className="mt-4 bg-white/20 text-white px-6 py-2 rounded-full backdrop-blur-sm border border-white/30">
                        Kapat
                    </button>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default TaskCard;
