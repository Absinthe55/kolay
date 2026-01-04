
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

export interface Task {
  id: string;
  machineName: string;
  masterName: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  comments?: string;
  image?: string; // Görev oluşturulurken eklenen resim
  completedImage?: string; // Görev bitirilirken eklenen resim
}

export interface User {
  id: string;
  name: string;
  role: 'AMIR' | 'USTA';
}

export interface Member {
  name: string;
  password?: string;
}

export interface AppState {
  tasks: Task[];
  currentUser: User | null;
}
