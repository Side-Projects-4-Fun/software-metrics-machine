export interface IRepository<T> {
  save(item: T): Promise<void>;

  saveAll(items: T[]): Promise<void>;

  load(): Promise<T | null>;

  loadAll(): Promise<T[]>;

  delete(): Promise<void>;

  exists(): Promise<boolean>;
}
