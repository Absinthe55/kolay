
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
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
  completedAt?: number;
  comments?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'AMIR' | 'USTA';
}

export interface AppState {
  tasks: Task[];
  currentUser: User | null;
}
