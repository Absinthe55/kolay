
import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, User } from '../types';

interface TaskCardProps {
  task: Task;
  user: User;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus, comment?: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, user, onUpdateStatus }) => {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const [isImageExpanded, setIsImageExpanded] = useState(false);

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
    }
  };

  const handleCancelTask = () => {
    if (confirm('Bu görevi iptal etmek istediğinize emin misiniz?')) {
      onUpdateStatus(task.id, TaskStatus.CANCELLED, 'Yönetici tarafından iptal edildi.');
    }
  };

  const submitCompletion = () => {
    onUpdateStatus(task.id, TaskStatus.COMPLETED, comment);
    setShowCommentInput(false);
    setComment('');
  };

  const isCancelled = task.status === TaskStatus.CANCELLED;

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 transition-all hover:shadow-md ${isCancelled ? 'opacity-60 grayscale' : ''}`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${statusColors[task.status]}`}>
              {task.status === TaskStatus.PENDING ? 'BEKLİYOR' : 
              task.status === TaskStatus.IN_PROGRESS ? 'ÇALIŞILIYOR' : 
              task.status === TaskStatus.COMPLETED ? 'TAMAMLANDI' : 'İPTAL EDİLDİ'}
            </span>
            <h3 className={`mt-2 font-bold text-slate-800 text-lg leading-tight ${isCancelled ? 'line-through decoration-2 decoration-red-400' : ''}`}>
              {task.machineName}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1">
              <div className={`text-xs flex items-center gap-1 ${priorityColors[task.priority]}`}>
                  <i className="fas fa-circle text-[8px]"></i>
                  {task.priority}
              </div>
              {user.role === 'AMIR' && !isCancelled && task.status !== TaskStatus.COMPLETED && (
                  <button 
                      onClick={handleCancelTask}
                      className="text-[10px] text-red-500 font-bold border border-red-200 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors mt-1"
                  >
                      İPTAL ET
                  </button>
              )}
          </div>
        </div>

        <div className="text-sm text-slate-600 mb-3 whitespace-pre-wrap line-clamp-4 leading-relaxed">
          {task.description}
        </div>

        {/* Resim Önizleme */}
        {task.image && (
          <div className="mb-4">
            <button 
              onClick={() => setIsImageExpanded(true)}
              className="relative group w-full h-48 rounded-lg overflow-hidden border border-slate-200"
            >
              <img src={task.image} alt="Görev Görseli" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-2xl drop-shadow-md transition-opacity"></i>
              </div>
            </button>
          </div>
        )}

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
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <textarea 
                  placeholder="Yapılan işlemler hakkında kısa not bırakın..."
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowCommentInput(false)}
                    className="flex-1 py-2 text-slate-500 font-medium text-sm"
                  >
                    Vazgeç
                  </button>
                  <button 
                    onClick={submitCompletion}
                    className="flex-[2] py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-md"
                  >
                    Kaydet ve Görevi Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resim Büyütme Modalı */}
      {isImageExpanded && task.image && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsImageExpanded(false)}>
          <button className="absolute top-4 right-4 text-white text-3xl">
            <i className="fas fa-times"></i>
          </button>
          <img 
            src={task.image} 
            alt="Detaylı Görünüm" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
};

export default TaskCard;
