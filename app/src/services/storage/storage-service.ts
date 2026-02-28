import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
  listAll,
  StorageReference,
} from "@firebase/storage";
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
  listFiles(path: string): Promise<StorageListedFile[]>;
}

export interface StorageListedFile {
  path: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  customMetadata: Record<string, string>;
}

async function listAllItemsRecursive(storageRef: StorageReference): Promise<StorageReference[]> {
  const result = await listAll(storageRef);
  const nestedResults = await Promise.all(result.prefixes.map((prefixRef) => listAllItemsRecursive(prefixRef)));
  return [...result.items, ...nestedResults.flat()];
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

  async listFiles(path: string): Promise<StorageListedFile[]> {
    const rootRef = ref(firebase.storage, path);
    const itemRefs = await listAllItemsRecursive(rootRef);

    const files = await Promise.all(
      itemRefs.map(async (itemRef) => {
        const [url, metadata] = await Promise.all([getDownloadURL(itemRef), getMetadata(itemRef)]);
        return {
          path: itemRef.fullPath,
          name: itemRef.name,
          url,
          contentType: metadata.contentType || "application/octet-stream",
          size: metadata.size || 0,
          createdAt: metadata.timeCreated || new Date(0).toISOString(),
          updatedAt: metadata.updated || metadata.timeCreated || new Date(0).toISOString(),
          customMetadata: metadata.customMetadata || {},
        };
      }),
    );

    return files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
};
