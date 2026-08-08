import { fetchAPI } from './client';

export interface VersionResult {
  version: string;
}

export interface VersionResponse {
  result: VersionResult;
}

export const versionAPI = {
  getVersion: () => fetchAPI<VersionResponse>('/version'),
};
