export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskComment {
  _id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  conversationId: string;
  createdBy: string;
  batchId?: string | null;
  title: string;
  description?: string;
  assigneeId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  comments?: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
}
