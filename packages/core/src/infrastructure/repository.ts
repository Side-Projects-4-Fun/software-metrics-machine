/**
 * Generic persistence interface for project-scoped records.
 *
 * Implementations are storage-agnostic; the current backend is SQLite.
 */
export interface IRepository<T> {
  /**
   * Save item to storage
   */
  save(item: T): Promise<void>;

  /**
   * Save multiple items to storage
   */
  saveAll(items: T[]): Promise<void>;

  /**
   * Load item from storage
   */
  load(): Promise<T | null>;

  /**
   * Load multiple items from storage
   */
  loadAll(): Promise<T[]>;

  /**
   * Delete item from storage
   */
  delete(): Promise<void>;

  /**
   * Check if item exists
   */
  exists(): Promise<boolean>;
}
