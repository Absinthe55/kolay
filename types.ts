
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
  LOW = 'Düşük',
  MEDIUM = 'Orta',
  HIGH = 'Yüksek',
  CRITICAL = 'Kritik'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Task {
  id: string;
  machineName: string;
  masterName: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  seenAt?: number; // Görevin usta tarafından ilk görüldüğü zaman
  startedAt?: number;
  completedAt?: number;
  comments?: string;
  image?: string; // Görev oluşturulurken eklenen resim
  completedImage?: string; // Görev bitirilirken eklenen resim
}

export interface UstaRequest {
  id: string;
  ustaName: string;
  content: string;
  status: RequestStatus;
  createdAt: number;
  responseNote?: string; // Yöneticinin notu
}

export interface LeaveRequest {
  id: string;
  ustaName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: RequestStatus;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  role: 'AMIR' | 'USTA';
}

export interface Member {
  name: string;
  password?: string;
  phoneNumber?: string; // Whatsapp için telefon numarası
}

export interface AppState {
  tasks: Task[];
  requests: UstaRequest[];
  currentUser: User | null;
}
