import React, { useState, useEffect, useRef } from 'react';
import { Task, User, TaskPriority, TaskStatus } from '../types';

interface TaskCardProps {
  task: Task;
  user: User;
  onMarkSeen?: (taskId: string) => void;
  isArchived?: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus, completedImage?: string) => void;
  onDelete?: (taskId: string) => void;
  onAddComment?: (taskId: string, comment: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  user, 
  onMarkSeen, 
  isArchived = false,
  onStatusChange,
  onDelete,
  onAddComment
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [comment, setComment] = useState('');
  const [pendingCompletionImage, setPendingCompletionImage] = useState<string | undefined>(undefined);
  const [fullImageModal, setFullImageModal] = useState<string | null>(null);
  const completionImageRef = useRef<HTMLInputElement>(null);

  // Mark seen logic
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (!isArchived && user.role === 'USTA' && task.masterName === user.name && !task.seenAt && onMarkSeen) {
        timer = setTimeout(() => { onMarkSeen(task.id); }, 500);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [user.role, task.masterName, user.name, task.seenAt, task.id, onMarkSeen, isArchived]);

  const priorityStyles = {
    [TaskPriority.CRITICAL]: 'bg-red-500/20 text-red-400 border-red-500/30',
    [TaskPriority.HIGH]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    [TaskPriority.MEDIUM]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    [TaskPriority.LOW]: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const statusStyles = {
      [TaskStatus.COMPLETED]: 'border-emerald-500/50 from-emerald-900/20 to-emerald-900/5',
      [TaskStatus.IN_PROGRESS]: 'border-blue-500/50 from-blue-900/20 to-blue-900/5',
      [TaskStatus.PENDING]: 'border-slate-700 from-slate-800/50 to-slate-900/50',
      [TaskStatus.CANCELLED]: 'border-red-900/50 opacity-60 grayscale',
  };

  const handleAddComment = () => {
      if (comment.trim() && onAddComment) { onAddComment(task.id, comment); setComment(''); }
  };

  const handleCompletionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          setPendingCompletionImage(reader.result as string);
      };
      reader.readAsDataURL(file);
  };

  const handleStatusChangeClick = (status: TaskStatus) => {
      if (onStatusChange) {
          onStatusChange(task.id, status, pendingCompletionImage);
          setPendingCompletionImage(undefined);
      }
  };

  return (
    <>
      <div className={`relative rounded-3xl border overflow-hidden transition-all duration-300 bg-gradient-to-br backdrop-blur-sm ${statusStyles[task.status]} ${task.status === TaskStatus.COMPLETED ? 'shadow-none' : 'shadow-lg'}`}>
        
        {/* Status Bar Indicator */}
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' : task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-slate-600'}`}></div>

        <div className="p-5 pl-7">
            {/* Header */}
            <div className="flex justify-between items-start mb-3" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${priorityStyles[task.priority]}`}>
                            {task.priority}
                        </span>
                        {task.seenAt && user.role === 'AMIR' && (
                            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-900/50">
                                <i className="fas fa-check-double"></i> Görüldü
                            </span>
                        )}
                    </div>
                    <h3 className={`text-lg font-black leading-tight ${task.status === TaskStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                        {task.machineName}
                    </h3>
                </div>
                
                {/* Status Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-lg ${
                    task.status === TaskStatus.COMPLETED ? 'bg-emerald-500 border-emerald-400 text-white' : 
                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-600 border-blue-400 text-white animate-pulse' : 
                    'bg-slate-800 border-slate-600 text-slate-500'
                }`}>
                    <i className={`fas ${
                        task.status === TaskStatus.COMPLETED ? 'fa-check' : 
                        task.status === TaskStatus.IN_PROGRESS ? 'fa-cog fa-spin' : 
                        'fa-hourglass-start'
                    }`}></i>
                </div>
            </div>

            {/* Details (Collapsible) */}
            <div className={`transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1000px] opacity-100'}`}>
                
                {/* Task Image (If exists) */}
                {task.image && (
                    <div className="mb-4 relative rounded-2xl overflow-hidden border border-white/5 cursor-pointer group" onClick={() => setFullImageModal(task.image!)}>
                        <img src={task.image} className="w-full h-32 object-cover" alt="Task" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest"><i className="fas fa-search-plus mr-1"></i> Görevi Gör</span>
                        </div>
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black text-white uppercase border border-white/10">Arıza Kaydı</div>
                    </div>
                )}

                <div className="bg-slate-950/30 rounded-xl p-4 border border-white/5 mb-4">
                    <p className="text-sm text-slate-300 font-medium leading-relaxed">{task.description}</p>
                </div>

                {/* Completion Image (If exists) */}
                {task.completedImage && (
                    <div className="mb-4 relative rounded-2xl overflow-hidden border border-emerald-500/20 cursor-pointer group" onClick={() => setFullImageModal(task.completedImage!)}>
                        <img src={task.completedImage} className="w-full h-32 object-cover" alt="Completion" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest"><i className="fas fa-search-plus mr-1"></i> Sonucu Gör</span>
                        </div>
                        <div className="absolute top-2 left-2 bg-emerald-600/80 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black text-white uppercase border border-emerald-400/20">İş Tamamlandı</div>
                    </div>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">
                    <span><i className="far fa-clock mr-1"></i> {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span><i className="far fa-user mr-1"></i> {task.masterName}</span>
                </div>

                {/* Comments */}
                {task.comments && (
                    <div className="mb-4 pl-3 border-l-2 border-slate-600">
                        <p className="text-xs text-slate-400 italic whitespace-pre-line">"{task.comments}"</p>
                    </div>
                )}

                {/* Controls */}
                <div className="pt-2 border-t border-white/5 space-y-3">
                    {/* USTA Controls */}
                    {user.role === 'USTA' && task.status !== TaskStatus.COMPLETED && (
                        <div className="space-y-3">
                            {task.status === TaskStatus.PENDING && (
                                <button onClick={() => handleStatusChangeClick(TaskStatus.IN_PROGRESS)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black shadow-lg shadow-blue-900/40 transition-all active:scale-95 text-xs uppercase tracking-widest">
                                    <i className="fas fa-play mr-2"></i> BAŞLA
                                </button>
                            )}
                            {task.status === TaskStatus.IN_PROGRESS && (
                                <div className="space-y-3">
                                    {/* Completion Photo Selection */}
                                    <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-2xl border border-dashed border-slate-700">
                                        <input type="file" ref={completionImageRef} onChange={handleCompletionImageUpload} accept="image/*" className="hidden" />
                                        <button 
                                            onClick={() => completionImageRef.current?.click()}
                                            className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:text-emerald-500 transition-colors border border-white/5"
                                        >
                                            <i className="fas fa-camera"></i>
                                        </button>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tamamlanma Fotoğrafı</p>
                                            <p className="text-[9px] text-slate-600 italic">Görevi bitirirken fotoğraf ekle</p>
                                        </div>
                                        {pendingCompletionImage && (
                                            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30">
                                                <img src={pendingCompletionImage} className="w-full h-full object-cover" />
                                                <button onClick={() => setPendingCompletionImage(undefined)} className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[8px]"><i className="fas fa-times"></i></button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleStatusChangeClick(TaskStatus.COMPLETED)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black shadow-lg shadow-emerald-900/40 transition-all active:scale-95 text-xs uppercase tracking-widest">
                                        <i className="fas fa-check-circle mr-2"></i> GÖREVİ TAMAMLA
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comment Input */}
                    {(task.status === TaskStatus.IN_PROGRESS || user.role === 'AMIR') && (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={comment} 
                                onChange={e => setComment(e.target.value)} 
                                placeholder="Not ekle..." 
                                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 text-xs text-white outline-none focus:border-blue-500"
                            />
                            <button onClick={handleAddComment} disabled={!comment.trim()} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">OK</button>
                        </div>
                    )}

                    {/* AMIR Delete */}
                    {user.role === 'AMIR' && (
                        <button onClick={() => onDelete && onDelete(task.id)} className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors">
                            <i className="fas fa-trash-alt mr-1"></i> GÖREVİ SİL
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Image Modal */}
      {fullImageModal && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setFullImageModal(null)}>
              <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center backdrop-blur-md">
                  <i className="fas fa-times text-xl"></i>
              </button>
              <img src={fullImageModal} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" alt="Full view" />
              <div className="absolute bottom-10 left-0 right-0 text-center">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Kapatmak için herhangi bir yere dokunun</p>
              </div>
          </div>
      )}
    </>
  );
};

export default TaskCard;