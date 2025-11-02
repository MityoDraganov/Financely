import { ref, uploadBytes, getDownloadURL, deleteObject } from "@firebase/storage";
import { firebase } from "@/infrastructure";

export interface UploadFileOptions {
  file: File;
  path: string;
  metadata?: {
    contentType?: string;
    customMetadata?: Record<string, string>;
  };
}

export interface StorageService {
  uploadFile(options: UploadFileOptions): Promise<string>;
  deleteFile(path: string): Promise<void>;
  getFileUrl(path: string): Promise<string>;
}

export const storageService: StorageService = {
  async uploadFile({ file, path, metadata }: UploadFileOptions): Promise<string> {
    const storageRef = ref(firebase.storage, path);
    
    const metadataObj = {
      contentType: metadata?.contentType || file.type,
      customMetadata: metadata?.customMetadata || {},
    };

    await uploadBytes(storageRef, file, metadataObj);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  },

  async deleteFile(path: string): Promise<void> {
    const storageRef = ref(firebase.storage, path);
    await deleteObject(storageRef);
  },

  async getFileUrl(path: string): Promise<string> {
    const storageRef = ref(firebase.storage, path);
    return await getDownloadURL(storageRef);
  },
};

