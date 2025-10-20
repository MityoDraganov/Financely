import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { InviteRepository } from "../core/ports/repositories/invite-repository";
import { Invite, CreateInviteInput } from "../core/entities/invite";
import { DatabaseService } from "../core/ports/services/database-service";

export function getInviteRepository(databaseService: DatabaseService): InviteRepository {
  const db = databaseService.getFirestore();

  return {
    async create(input: CreateInviteInput): Promise<Invite> {
      const now = new Date().toISOString();
      const expiresAt = input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days default

      const inviteData = {
        ...input,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(collection(db, "invites"), inviteData);
      
      return {
        id: docRef.id,
        ...inviteData,
      };
    },

    async getById(id: string): Promise<Invite | null> {
      const docRef = doc(db, "invites", id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
      } as Invite;
    },

    async getByCode(code: string): Promise<Invite | null> {
      const q = query(
        collection(db, "invites"),
        where("code", "==", code)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
      } as Invite;
    },

    async getByOrganizationId(organizationId: string): Promise<Invite[]> {
      const q = query(
        collection(db, "invites"),
        where("organizationId", "==", organizationId),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invite));
    },

    async getActiveByOrganizationId(organizationId: string): Promise<Invite[]> {
      const q = query(
        collection(db, "invites"),
        where("organizationId", "==", organizationId),
        where("status", "==", "active"),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invite));
    },

    async update(id: string, updates: Partial<Invite>): Promise<Invite> {
      const docRef = doc(db, "invites", id);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      await updateDoc(docRef, updateData);
      
      const updatedDoc = await getDoc(docRef);
      const data = updatedDoc.data();
      
      return {
        id: updatedDoc.id,
        ...data,
      } as Invite;
    },

    async markAsUsed(id: string, usedBy: string): Promise<Invite> {
      const now = new Date().toISOString();
      return this.update(id, {
        status: "used",
        usedAt: now,
        usedBy,
      });
    },

    async markAsRevoked(id: string, revokedBy: string): Promise<Invite> {
      const now = new Date().toISOString();
      return this.update(id, {
        status: "revoked",
        revokedAt: now,
        revokedBy,
      });
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(db, "invites", id);
      await deleteDoc(docRef);
    },

    async isCodeUnique(code: string): Promise<boolean> {
      const q = query(
        collection(db, "invites"),
        where("code", "==", code)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    },
  };
}
