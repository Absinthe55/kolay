import React, { useState, useEffect } from 'react';
import { Task, User, TaskPriority, TaskStatus } from '../types';

interface TaskCardProps {
  task: Task;
  user: User;
  onMarkSeen?: (taskId: string) => void;
  isArchived?: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
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

  // Otomatik Görüldü İşaretleme
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Arşivlenmişse veya collapsed ise işaretleme
    if (!isCollapsed && !isArchived && user.role === 'USTA' && task.masterName === user.name && !task.seenAt && onMarkSeen) {
        timer = setTimeout(() => {
            onMarkSeen(task.id);
        }, 500); // Gecikme 500ms'ye düşürüldü (Daha hızlı tepki)
    }
    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [isCollapsed, user.role, task.masterName, user.name, task.seenAt, task.id, onMarkSeen, isArchived]);

  const getPriorityColor = (p: TaskPriority) => {
    switch(p) {
        case TaskPriority.CRITICAL: return 'text-red-500 border-red-500/50 bg-red-900/20';
        case TaskPriority.HIGH: return 'text-orange-500 border-orange-500/50 bg-orange-900/20';
        case TaskPriority.MEDIUM: return 'text-blue-500 border-blue-500/50 bg-blue-900/20';
        default: return 'text-slate-400 border-slate-600/50 bg-slate-800';
    }
  };

  const getStatusColor = (s: TaskStatus) => {
      switch(s) {
          case TaskStatus.COMPLETED: return 'text-emerald-500';
          case TaskStatus.IN_PROGRESS: return 'text-blue-500';
          case TaskStatus.CANCELLED: return 'text-slate-500';
          default: return 'text-amber-500';
      }
  };

  const handleAddComment = () => {
      if (comment.trim() && onAddComment) {
          onAddComment(task.id, comment);
          setComment('');
      }
  };

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 p-4 mb-3 transition-all ${task.status === TaskStatus.COMPLETED ? 'opacity-75' : ''} ${task.seenAt ? 'border-l-4 border-l-slate-700' : 'border-l-4 border-l-blue-500'}`}>
      {/* Header */}
      <div className="flex justify-between items-start cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
         <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                </span>
                <span className={`text-[9px] font-bold ${getStatusColor(task.status)}`}>
                    {task.status}
                </span>
                {task.seenAt && <i className="fas fa-eye text-[10px] text-slate-500" title="Görüldü"></i>}
             </div>
             <h3 className="text-slate-200 font-bold text-sm">{task.machineName}</h3>
             <p className="text-[10px] text-slate-500">
                {new Date(task.createdAt).toLocaleDateString('tr-TR')} • {task.masterName}
             </p>
         </div>
         <div className="ml-2">
             <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'} text-slate-500 text-xs`}></i>
         </div>
      </div>
      
      {!isCollapsed && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 whitespace-pre-wrap">
                  {task.description}
              </p>
              
              {task.image && (
                  <div className="rounded-lg overflow-hidden border border-slate-700/50">
                      <img src={task.image} alt="Task attachment" className="w-full h-auto object-cover max-h-60" />
                  </div>
              )}

              {task.comments && (
                  <div className="bg-slate-900/30 p-2 rounded-lg text-xs text-slate-400 italic border border-slate-800">
                      <i className="fas fa-comment-alt mr-1"></i> {task.comments}
                  </div>
              )}
              
              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                  {user.role === 'USTA' && task.status === TaskStatus.PENDING && (
                      <button 
                        onClick={() => onStatusChange && onStatusChange(task.id, TaskStatus.IN_PROGRESS)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                          Başla
                      </button>
                  )}
                  
                  {user.role === 'USTA' && task.status === TaskStatus.IN_PROGRESS && (
                       <button 
                        onClick={() => onStatusChange && onStatusChange(task.id, TaskStatus.COMPLETED)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                          Tamamla
                      </button>
                  )}

                  {/* Comments Input */}
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Not ekle..."
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                      />
                      <button 
                        onClick={handleAddComment}
                        disabled={!comment.trim()}
                        className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-600 disabled:opacity-50"
                      >
                          Ekle
                      </button>
                  </div>
                  
                  {user.role === 'AMIR' && (
                      <button 
                        onClick={() => onDelete && onDelete(task.id)}
                        className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-bold transition-colors mt-2"
                      >
                          Görevi Sil
                      </button>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default TaskCard;