import { DatabaseService } from "../services/database-service";

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
