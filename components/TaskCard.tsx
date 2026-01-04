
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
  const [isCollapsed, setIsCollapsed] = useState(task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modern Dark Mode Renk Paletleri
  const statusConfig = {
    [TaskStatus.PENDING]: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-800/50', icon: 'fa-clock', label: 'Beklemede' },
    [TaskStatus.IN_PROGRESS]: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800/50', icon: 'fa-spinner fa-spin', label: 'İşlemde' },
    [TaskStatus.COMPLETED]: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-800/50', icon: 'fa-check-circle', label: 'Tamamlandı' },
    [TaskStatus.CANCELLED]: { bg: 'bg-slate-700/50', text: 'text-slate-400', border: 'border-slate-600/50', icon: 'fa-ban', label: 'İptal' },
  };

  const priorityConfig = {
    [TaskPriority.LOW]: { color: 'text-slate-400', bg: 'bg-slate-700/50' },
    [TaskPriority.MEDIUM]: { color: 'text-blue-400', bg: 'bg-blue-900/30' },
    [TaskPriority.HIGH]: { color: 'text-orange-400', bg: 'bg-orange-900/30' },
    [TaskPriority.CRITICAL]: { color: 'text-red-400', bg: 'bg-red-900/30' },
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
    
    if (hours > 0) return `${hours}sa ${mins}dk`;
    return `${mins}dk`;
  };

  const handleStatusChange = () => {
    if (task.status === TaskStatus.PENDING) {
      onUpdateStatus(task.id, TaskStatus.IN_PROGRESS);
    } else if (task.status === TaskStatus.IN_PROGRESS) {
      setShowCommentInput(true);
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
    setIsCollapsed(true); 
  };

  const isCancelled = task.status === TaskStatus.CANCELLED;
  const currentStatus = statusConfig[task.status];
  const currentPriority = priorityConfig[task.priority];

  return (
    <>
      <div className={`bg-slate-800 rounded-[1.25rem] shadow-lg transition-all duration-300 border border-slate-700 overflow-hidden relative ${isCancelled ? 'opacity-60 grayscale-[0.8]' : ''}`}>
        
        {/* Sol Kenar Çizgisi (Renkli Bar) */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${currentStatus.bg.replace('/30', '').replace('bg-', 'bg-').replace('-900', '-500')}`}></div>

        {/* Header - Tıklanabilir Alan */}
        <div 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className={`relative pl-5 pr-4 py-4 cursor-pointer select-none bg-slate-800`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-2">
               <div className="flex items-center gap-2 mb-2">
                   {/* Status Badge */}
                   <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}>
                       <i className={`fas ${currentStatus.icon}`}></i>
                       {currentStatus.label}
                   </span>
                   {/* Priority Badge */}
                   <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${currentPriority.bg} ${currentPriority.color}`}>
                       <i className="fas fa-flag"></i>
                       {task.priority}
                   </span>
               </div>
               
               <h3 className={`text-lg font-black text-slate-100 leading-tight ${isCancelled ? 'line-through decoration-2 decoration-red-900 text-slate-500' : ''}`}>
                 {task.machineName}
               </h3>

               {isCollapsed && (
                   <p className="text-xs text-slate-400 mt-1 truncate pr-8">{task.description}</p>
               )}
            </div>

            {/* Sağ Üst Aksiyonlar */}
            <div className="flex flex-col items-end gap-2">
                 {/* Amir Aksiyonları */}
                 {user.role === 'AMIR' && (
                     <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!isCancelled && task.status !== TaskStatus.COMPLETED && (
                            <button onClick={handleCancelTask} className="w-8 h-8 rounded-full bg-red-900/30 text-red-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors" title="İptal Et">
                                <i className="fas fa-ban text-xs"></i>
                            </button>
                        )}
                        {onDelete && (
                            <button onClick={handleDeleteTask} className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors" title="Sil">
                                <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                        )}
                     </div>
                 )}
                 
                 <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                        <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                 </div>
            </div>
          </div>
          
          {/* Usta İsmi ve Tarih (Collapsed) */}
          {isCollapsed && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-2">
                  <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                          {task.masterName.substring(0,1)}
                      </div>
                      <span className="text-xs font-bold text-slate-400">{task.masterName}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{new Date(task.createdAt).toLocaleDateString('tr-TR')}</span>
              </div>
          )}
        </div>

        {/* Genişletilmiş İçerik */}
        {!isCollapsed && (
          <div className="pl-5 pr-4 pb-5 animate-in slide-in-from-top-2 duration-300 bg-slate-800">
            <div className="bg-slate-900/50 p-4 rounded-xl text-sm text-slate-300 mb-4 border border-slate-700 leading-relaxed shadow-inner">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">İş Emri Açıklaması</h4>
              {task.description}
            </div>

            {/* Resimler */}
            <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                {task.image && (
                  <button 
                    onClick={() => setIsImageExpanded({url: task.image!, title: 'Arıza Görüntüsü'})}
                    className="relative group w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 border-slate-700 shadow-sm hover:border-blue-500 transition-colors"
                  >
                    <img src={task.image} alt="Görev" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-blue-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-search-plus text-white"></i>
                    </div>
                  </button>
                )}
                {task.completedImage && (
                  <button 
                    onClick={() => setIsImageExpanded({url: task.completedImage!, title: 'Tamamlanan İş'})}
                    className="relative group w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 border-emerald-800 shadow-sm hover:border-emerald-500 transition-colors"
                  >
                    <img src={task.completedImage} alt="Bitiş" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-check text-white"></i>
                    </div>
                  </button>
                )}
            </div>

            {/* Detay Bilgileri Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-700/30 border border-slate-700 p-2.5 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400"><i className="fas fa-user text-xs"></i></div>
                    <div>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Görevli</p>
                        <p className="text-xs font-bold text-slate-300">{task.masterName}</p>
                    </div>
                </div>
                <div className="bg-slate-700/30 border border-slate-700 p-2.5 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400"><i className="far fa-calendar text-xs"></i></div>
                    <div>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Tarih</p>
                        <p className="text-xs font-bold text-slate-300">{new Date(task.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                </div>
            </div>

            {/* Süreç Takibi (Timeline benzeri) */}
            {(task.startedAt || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.COMPLETED) && !isCancelled && (
              <div className="mb-4 bg-slate-700/30 rounded-xl p-3 border border-slate-700 flex items-center justify-between text-center relative overflow-hidden">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-700 -z-0"></div>
                <div className="relative z-10 bg-slate-800 px-2 rounded">
                    <div className="text-[10px] font-bold text-slate-500 mb-1">BAŞLAMA</div>
                    <div className="inline-block bg-slate-700 border border-slate-600 text-slate-300 text-xs font-mono font-bold px-2 py-1 rounded-md shadow-sm">
                        {formatTime(task.startedAt)}
                    </div>
                </div>
                 <div className="relative z-10 bg-slate-800 px-2 rounded">
                     <div className="w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center text-xs font-bold shadow-sm ring-4 ring-slate-800 border border-blue-900/50">
                         {calculateDuration()}
                     </div>
                 </div>
                <div className="relative z-10 bg-slate-800 px-2 rounded">
                    <div className="text-[10px] font-bold text-slate-500 mb-1">BİTİŞ</div>
                    <div className={`inline-block border text-xs font-mono font-bold px-2 py-1 rounded-md shadow-sm ${task.completedAt ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-500'}`}>
                        {task.completedAt ? formatTime(task.completedAt) : '--:--'}
                    </div>
                </div>
              </div>
            )}

            {task.comments && (
              <div className="mb-5 p-4 bg-emerald-900/10 rounded-xl border border-emerald-900/30 relative">
                 <i className="fas fa-quote-left absolute top-3 left-3 text-emerald-800 text-xl"></i>
                 <div className="relative z-10 pl-6">
                    <p className="text-[9px] font-black text-emerald-500 uppercase mb-1">
                    {isCancelled ? 'İPTAL NOTU' : 'USTA RAPORU'}
                    </p>
                    <p className="text-sm text-slate-300 italic">"{task.comments}"</p>
                 </div>
              </div>
            )}

            {/* Aksiyon Butonları */}
            {user.role === 'USTA' && !isCancelled && task.status !== TaskStatus.COMPLETED && (
              <div className="pt-2 border-t border-slate-700">
                {!showCommentInput ? (
                  <button 
                    onClick={handleStatusChange}
                    className={`w-full py-4 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${
                      task.status === TaskStatus.PENDING 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-900/40 hover:shadow-blue-900/60' 
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40 hover:shadow-emerald-900/60'
                    }`}
                  >
                    <i className={`fas ${task.status === TaskStatus.PENDING ? 'fa-play' : 'fa-clipboard-check'} text-lg`}></i>
                    {task.status === TaskStatus.PENDING ? 'İŞE BAŞLA' : 'GÖREVİ TAMAMLA'}
                  </button>
                ) : (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <h4 className="text-sm font-black text-slate-200 mb-3 flex items-center gap-2">
                        <i className="fas fa-file-signature text-emerald-500"></i>
                        Tamamlama Raporu
                    </h4>
                    
                    <textarea 
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-emerald-500 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 text-white"
                      rows={3}
                      placeholder="Yapılan işlemleri detaylıca yazınız..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    ></textarea>

                    <div className="mb-4">
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-600 hover:border-emerald-500 hover:bg-emerald-900/10 transition-colors cursor-pointer group">
                             <div className="w-10 h-10 rounded-full bg-slate-700 group-hover:bg-emerald-900/30 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                                 <i className="fas fa-camera"></i>
                             </div>
                             <div className="flex-1">
                                 <span className="block text-xs font-bold text-slate-300 group-hover:text-emerald-400">Fotoğraf Ekle</span>
                                 <span className="block text-[10px] text-slate-500">Yapılan işin fotoğrafı</span>
                             </div>
                             <input type="file" accept="image/*" onChange={handleCompletedImageChange} className="hidden" />
                        </label>

                        {isProcessing && <p className="text-xs text-blue-400 mt-2 font-bold animate-pulse">Fotoğraf işleniyor...</p>}
                        
                        {completedImage && (
                            <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden shadow-md border border-slate-600">
                                <img src={completedImage} alt="Önizleme" className="w-full h-full object-cover" />
                                <button onClick={() => setCompletedImage(null)} className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setShowCommentInput(false); setComment(''); setCompletedImage(null); }}
                        className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-600 transition-colors"
                      >
                        VAZGEÇ
                      </button>
                      <button 
                        onClick={submitCompletion}
                        disabled={!comment.trim() || isProcessing}
                        className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/40 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        ONAYLA VE BİTİR
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
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={() => setIsImageExpanded(null)}
            >
                <div className="relative w-full max-w-lg flex flex-col items-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setIsImageExpanded(null)} className="absolute -top-12 right-0 text-white/70 hover:text-white text-3xl">
                        <i className="fas fa-times-circle"></i>
                    </button>
                    <img src={isImageExpanded.url} alt="Büyük" className="w-full rounded-2xl shadow-2xl object-contain max-h-[70vh] bg-black border border-slate-800" />
                    <div className="mt-6 bg-slate-800/80 backdrop-blur-md px-6 py-2 rounded-full border border-slate-700">
                        <p className="text-white font-bold">{isImageExpanded.title}</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default TaskCard;
