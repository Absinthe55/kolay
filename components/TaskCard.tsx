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
  const [isCollapsed, setIsCollapsed] = useState(false); // Default expanded
  const [comment, setComment] = useState('');

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

  return (
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
          <div className={`transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <div className="bg-slate-950/30 rounded-xl p-4 border border-white/5 mb-4">
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">{task.description}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 font-bold uppercase tracking-wider mb-4">
                  <span><i className="far fa-clock mr-1"></i> {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <span><i className="far fa-user mr-1"></i> {task.masterName}</span>
              </div>

              {/* Comments */}
              {task.comments && (
                  <div className="mb-4 pl-3 border-l-2 border-slate-600">
                      <p className="text-xs text-slate-400 italic">"{task.comments}"</p>
                  </div>
              )}

              {/* Controls */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                  {/* USTA Controls */}
                  {user.role === 'USTA' && task.status !== TaskStatus.COMPLETED && (
                      <div className="flex gap-3">
                          {task.status === TaskStatus.PENDING && (
                              <button onClick={() => onStatusChange && onStatusChange(task.id, TaskStatus.IN_PROGRESS)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95">
                                  BAŞLA
                              </button>
                          )}
                          {task.status === TaskStatus.IN_PROGRESS && (
                              <button onClick={() => onStatusChange && onStatusChange(task.id, TaskStatus.COMPLETED)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/40 transition-all active:scale-95">
                                  TAMAMLA
                              </button>
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
  );
};

export default TaskCard;