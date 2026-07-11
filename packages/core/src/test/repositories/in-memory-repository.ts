import type { IRepository } from '../../index';

export class InMemoryRepository<T> implements IRepository<T> {
  private items: T[] = [];

  async save(item: T): Promise<void> {
    this.items = [item];
  }

  async saveAll(items: T[]): Promise<void> {
    this.items = [...items];
  }

  async load(): Promise<T | null> {
    return this.items.length > 0 ? this.items[0] : null;
  }

  async loadAll(): Promise<T[]> {
    return [...this.items];
  }

  async delete(): Promise<void> {
    this.items = [];
  }

  async exists(): Promise<boolean> {
    return this.items.length > 0;
  }
}
