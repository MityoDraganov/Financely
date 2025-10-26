import { DatabaseService } from "@/core";
import { getGenericRepository } from "./generic-repository";
import { DatabaseCollection } from "./config";

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

export function getTaskRepository(databaseService: DatabaseService): TaskRepository {
  const baseRepo = getGenericRepository<Task, TaskData>(
    () => DatabaseCollection.TASKS,
    databaseService,
  );

  return {
    async create(data) {
      const taskData = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return baseRepo.create({ data: taskData });
    },

    async get(id) {
      return baseRepo.get({ id });
    },

    async getAll(params = {}) {
      return baseRepo.getAll({
        queryConstraints: params.queryConstraints || [],
        orderBy: params.orderBy,
        pagination: params.pagination,
      });
    },

    async update(id, data) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return baseRepo.update({ id, data: updateData });
    },

    async delete(id) {
      return baseRepo.delete({ id });
    },
  };
}
