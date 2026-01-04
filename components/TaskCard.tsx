
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

  const statusColors = {
    [TaskStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
    [TaskStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  const priorityColors = {
    [TaskPriority.LOW]: 'text-slate-500',
    [TaskPriority.MEDIUM]: 'text-blue-500',
    [TaskPriority.HIGH]: 'text-orange-500',
    [TaskPriority.CRITICAL]: 'text-red-600 font-bold',
  };

  const handleStatusChange = () => {
    if (task.status === TaskStatus.PENDING) {
      onUpdateStatus(task.id, TaskStatus.IN_PROGRESS);
    } else if (task.status === TaskStatus.IN_PROGRESS) {
      setShowCommentInput(true);
    }
  };

  const submitCompletion = () => {
    onUpdateStatus(task.id, TaskStatus.COMPLETED, comment);
    setShowCommentInput(false);
    setComment('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${statusColors[task.status]}`}>
            {task.status === TaskStatus.PENDING ? 'BEKLİYOR' : task.status === TaskStatus.IN_PROGRESS ? 'ÇALIŞILIYOR' : 'TAMAMLANDI'}
          </span>
          <h3 className="mt-2 font-bold text-slate-800 text-lg leading-tight">{task.machineName}</h3>
        </div>
        <div className={`text-xs flex items-center gap-1 ${priorityColors[task.priority]}`}>
          <i className="fas fa-circle text-[8px]"></i>
          {task.priority}
        </div>
      </div>

      <div className="text-sm text-slate-600 mb-4 whitespace-pre-wrap line-clamp-4 leading-relaxed">
        {task.description}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
        <span className="flex items-center gap-1">
          <i className="fas fa-user"></i> {task.masterName}
        </span>
        <span className="flex items-center gap-1">
          <i className="far fa-clock"></i> {new Date(task.createdAt).toLocaleDateString('tr-TR')}
        </span>
      </div>

      {task.comments && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-400 text-sm italic text-slate-700">
          <p className="font-bold text-[10px] text-emerald-600 uppercase mb-1">Usta Raporu:</p>
          "{task.comments}"
        </div>
      )}

      {user.role === 'USTA' && task.status !== TaskStatus.COMPLETED && (
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
  );
};

export default TaskCard;
