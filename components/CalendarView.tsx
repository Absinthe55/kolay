import React, { useState } from 'react';
import { LeaveRequest, RequestStatus, User } from '../types';

interface CalendarViewProps {
  leaves: LeaveRequest[];
  user: User;
  onAddLeave: (start: string, end: string, reason: string) => void;
  onDeleteLeave: (id: string) => void;
  onUpdateStatus: (id: string, status: RequestStatus) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ leaves, user, onAddLeave, onDeleteLeave, onUpdateStatus }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  // Takvim Yardımcıları
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Pazar, 1 = Pazartesi... Biz Pazartesi ile başlamak istiyoruz
    let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Pazar(0) -> 6, Pzt(1) -> 0
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  // Bir tarihte izinli olanları bul
  const getLeavesForDate = (dateStr: string) => {
    return leaves.filter(leave => {
       if (leave.status === RequestStatus.REJECTED) return false;
       return dateStr >= leave.startDate && dateStr <= leave.endDate;
    });
  };

  const handleDayClick = (day: number) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      // Saat dilimi sorununu çözmek için yerel string formatı
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      const dateStr = `${year}-${month}-${d}`;
      
      setSelectedDate(dateStr);

      // Eğer kullanıcı Usta ise ve bir güne tıkladıysa, o gün için izin penceresini otomatik aç
      if (user.role === 'USTA') {
          setStartInput(dateStr);
          setEndInput(dateStr);
          setShowAddModal(true);
      }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(startInput && endInput && reasonInput) {
          onAddLeave(startInput, endInput, reasonInput);
          setShowAddModal(false);
          setStartInput('');
          setEndInput('');
          setReasonInput('');
      }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Boş günler (Önceki ayın sonları)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 bg-slate-900/30 border border-slate-800/50"></div>);
    }

    // Ayın günleri
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(i).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;
        
        const dayLeaves = getLeavesForDate(dateStr);
        const hasApproved = dayLeaves.some(l => l.status === RequestStatus.APPROVED);
        const hasPending = dayLeaves.some(l => l.status === RequestStatus.PENDING);
        
        let bgClass = "bg-slate-800 hover:bg-slate-700";
        if (selectedDate === dateStr) bgClass = "bg-blue-900/40 border-blue-500 ring-1 ring-blue-500";
        else if (hasApproved) bgClass = "bg-emerald-900/20 border-emerald-900/50";
        else if (hasPending) bgClass = "bg-amber-900/20 border-amber-900/50";

        days.push(
            <div 
                key={i} 
                onClick={() => handleDayClick(i)}
                className={`h-14 border border-slate-700/50 p-1 cursor-pointer transition-colors relative flex flex-col justify-between ${bgClass}`}
            >
                <span className={`text-xs font-bold ${selectedDate === dateStr ? 'text-blue-400' : 'text-slate-400'}`}>{i}</span>
                
                {/* Göstergeler */}
                <div className="flex gap-1 flex-wrap content-end">
                    {dayLeaves.slice(0, 3).map((leave, idx) => (
                         <div key={idx} className={`w-1.5 h-1.5 rounded-full ${leave.status === RequestStatus.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'}`} title={leave.ustaName}></div>
                    ))}
                    {dayLeaves.length > 3 && <span className="text-[8px] text-slate-500 leading-none">+</span>}
                </div>
            </div>
        );
    }
    return days;
  };

  const selectedLeaves = selectedDate ? getLeavesForDate(selectedDate) : [];

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      <div className="flex justify-between items-center mb-6 px-1">
          <h2 className="text-2xl font-black text-slate-100">İzin Takvimi</h2>
          {user.role === 'USTA' && (
              <button 
                onClick={() => {
                    // Butona basınca bugünü varsayılan yap
                    const today = new Date().toISOString().split('T')[0];
                    setStartInput(today);
                    setEndInput(today);
                    setShowAddModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-900/30 flex items-center gap-2"
              >
                  <i className="fas fa-plus"></i> İzin İste
              </button>
          )}
      </div>

      {/* Takvim Kontrolleri */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden mb-6">
          <div className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-slate-700">
              <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
                  <i className="fas fa-chevron-left"></i>
              </button>
              <h3 className="font-bold text-slate-200 capitalize">
                  {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
                  <i className="fas fa-chevron-right"></i>
              </button>
          </div>
          
          {/* Gün İsimleri */}
          <div className="grid grid-cols-7 text-center bg-slate-800 border-b border-slate-700">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                  <div key={d} className="py-2 text-[10px] font-bold text-slate-500 uppercase">{d}</div>
              ))}
          </div>

          {/* Günler Grid */}
          <div className="grid grid-cols-7 bg-slate-900">
              {renderCalendarDays()}
          </div>
      </div>

      {/* Seçili Gün Detayları */}
      {selectedDate && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-slate-400 px-1 border-l-4 border-blue-500 pl-2">
                  {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
              </h3>
              
              {selectedLeaves.length === 0 ? (
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center text-slate-500 text-xs">
                      Bugün için kayıtlı izin bulunmuyor.
                  </div>
              ) : (
                  selectedLeaves.map(leave => (
                      <div key={leave.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm relative overflow-hidden group">
                           <div className={`absolute left-0 top-0 bottom-0 w-1 ${leave.status === RequestStatus.APPROVED ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                           
                           <div className="pl-2">
                               <p className="font-bold text-slate-200 text-sm">{leave.ustaName}</p>
                               <p className="text-xs text-slate-500">{leave.reason}</p>
                               <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                        {leave.daysCount} Gün
                                    </span>
                                    {leave.status === RequestStatus.PENDING && (
                                        <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                            <i className="fas fa-hourglass-start"></i> Onay Bekliyor
                                        </span>
                                    )}
                               </div>
                           </div>

                           <div className="flex flex-col gap-2">
                               {/* Silme (Kendi talebiyse veya Amir ise) */}
                               {(user.role === 'AMIR' || (user.role === 'USTA' && leave.ustaName === user.name && leave.status === RequestStatus.PENDING)) && (
                                   <button onClick={() => onDeleteLeave(leave.id)} className="w-8 h-8 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-red-900/20 flex items-center justify-center transition-colors">
                                       <i className="fas fa-trash-alt text-xs"></i>
                                   </button>
                               )}

                               {/* Onay/Ret (Sadece Amir) */}
                               {user.role === 'AMIR' && leave.status === RequestStatus.PENDING && (
                                   <div className="flex gap-1">
                                       <button onClick={() => onUpdateStatus(leave.id, RequestStatus.REJECTED)} className="w-8 h-8 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center">
                                           <i className="fas fa-times text-xs"></i>
                                       </button>
                                       <button onClick={() => onUpdateStatus(leave.id, RequestStatus.APPROVED)} className="w-8 h-8 rounded-lg bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 flex items-center justify-center">
                                           <i className="fas fa-check text-xs"></i>
                                       </button>
                                   </div>
                               )}
                           </div>
                      </div>
                  ))
              )}
          </div>
      )}

      {/* İzin Talep Modalı */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl p-6">
                  <h3 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
                      <i className="fas fa-calendar-plus text-blue-500"></i> İzin Talebi
                  </h3>
                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Başlangıç Tarihi</label>
                          <input 
                              type="date" 
                              required
                              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                              value={startInput}
                              onChange={e => setStartInput(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bitiş Tarihi (Dahil)</label>
                          <input 
                              type="date" 
                              required
                              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                              value={endInput}
                              onChange={e => setEndInput(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sebep / Açıklama</label>
                          <textarea 
                              required
                              rows={3}
                              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none resize-none"
                              placeholder="Yıllık izin, raporlu vb."
                              value={reasonInput}
                              onChange={e => setReasonInput(e.target.value)}
                          ></textarea>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-600">
                              Vazgeç
                          </button>
                          <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-lg shadow-blue-900/30">
                              Oluştur
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default CalendarView;