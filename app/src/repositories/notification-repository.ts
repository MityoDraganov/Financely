import { DatabaseService } from "@/core";
import { getGenericRepository } from "./generic-repository";
import { DatabaseCollection } from "./config";

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  status: "unread" | "read";
  createdAt: string;
  readAt?: string;
  data?: Record<string, unknown>;
}

export interface NotificationData {
  userId: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  status: "unread" | "read";
  data?: Record<string, unknown>;
}

export interface NotificationRepository {
  create(data: NotificationData): Promise<string>;
  get(id: string): Promise<Notification | null>;
  getAll(params?: {
    queryConstraints?: any[];
    orderBy?: any;
    pagination?: any;
  }): Promise<Notification[]>;
  update(id: string, data: Partial<NotificationData>): Promise<void>;
  delete(id: string): Promise<void>;
  markAsRead(id: string): Promise<void>;
  getUnreadByUser(userId: string): Promise<Notification[]>;
}

export function getNotificationRepository(databaseService: DatabaseService): NotificationRepository {
  const baseRepo = getGenericRepository<Notification, NotificationData>(
    () => DatabaseCollection.NOTIFICATIONS,
    databaseService,
  );

  return {
    async create(data) {
      const notificationData = {
        ...data,
        createdAt: new Date().toISOString(),
      };
      return baseRepo.create({ data: notificationData });
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
      return baseRepo.update({ id, data });
    },

    async delete(id) {
      return baseRepo.delete({ id });
    },

    async markAsRead(id) {
      return baseRepo.update({ 
        id, 
        data: { 
          status: "read", 
          readAt: new Date().toISOString() 
        } 
      });
    },

    async getUnreadByUser(userId) {
      return baseRepo.getAll({
        queryConstraints: [
          { field: "userId", operator: "==", value: userId },
          { field: "status", operator: "==", value: "unread" }
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
  };
}
