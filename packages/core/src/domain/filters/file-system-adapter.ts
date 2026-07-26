import * as fs from 'fs';
import * as path from 'path';
import type { SavedFiltersStorageAdapter } from './saved-filters-store';

export class FileSystemSavedFiltersAdapter implements SavedFiltersStorageAdapter {
  constructor(private readonly baseDir: string) {}

  private filePath(): string {
    return path.join(this.baseDir, 'saved-filters.json');
  }

  async getItem(_key: string): Promise<string | null> {
    const fp = this.filePath();
    if (!fs.existsSync(fp)) {
      return null;
    }
    return fs.readFileSync(fp, 'utf-8');
  }

  async setItem(_key: string, value: string): Promise<void> {
    const fp = this.filePath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });

    const tmp = `${fp}.tmp`;
    fs.writeFileSync(tmp, value, 'utf-8');
    fs.renameSync(tmp, fp);
  }
}
