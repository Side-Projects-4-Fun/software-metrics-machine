/**
 * Generic repository interface for file system operations
 */
export interface IRepository<T> {
  /**
   * Save item to file system
   */
  save(item: T): Promise<void>;

  /**
   * Save multiple items to file system
   */
  saveAll(items: T[]): Promise<void>;

  /**
   * Load item from file system
   */
  load(): Promise<T | null>;

  /**
   * Load multiple items from file system
   */
  loadAll(): Promise<T[]>;

  /**
   * Delete item from file system
   */
  delete(): Promise<void>;

  /**
   * Check if item exists
   */
  exists(): Promise<boolean>;
}
