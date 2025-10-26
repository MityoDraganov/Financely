import { DatabaseService } from "../services/database-service";

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  completedAt?: string;
}

export interface TaskData {
  title: string;
  description: string;
  assigneeId?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate?: string;
}

export interface TaskRepository {
  create(data: TaskData): Promise<string>;
  get(id: string): Promise<Task | null>;
  getAll(params?: {
    queryConstraints?: any[];
    orderBy?: any;
    pagination?: any;
  }): Promise<Task[]>;
  update(id: string, data: Partial<TaskData>): Promise<void>;
  delete(id: string): Promise<void>;
}
