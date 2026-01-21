import { DatabaseService } from "../core";
import { MagicLinkToken } from "../core/entities/magic-link";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export interface MagicLinkRepository {
  create(token: MagicLinkToken): Promise<string>;
  get(id: string): Promise<MagicLinkToken | null>;
  getByToken(token: string): Promise<MagicLinkToken | null>;
  update(id: string, updates: Partial<MagicLinkToken>): Promise<void>;
  delete(id: string): Promise<void>;
}

export function getMagicLinkRepository(
  databaseService: DatabaseService,
): MagicLinkRepository {
  const genericRepo = getGenericRepository<MagicLinkToken, MagicLinkToken>(
    () => DatabaseCollection.MAGIC_LINKS,
    databaseService,
  );

  return {
    ...genericRepo,
    
    async getByToken(token: string): Promise<MagicLinkToken | null> {
      const results = await databaseService.getAllByFields<MagicLinkToken>(
        DatabaseCollection.MAGIC_LINKS,
        [{ field: "token", operator: "==", value: token }],
        { limit: 1 },
      );
      
      return results.length > 0 ? results[0] : null;
    },
  };
}
