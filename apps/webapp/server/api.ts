// Re-export all API modules for backward compatibility
export { sourceCodeAPI } from './api/sourceCode';
export { pipelineAPI } from './api/pipeline';
export { changeRequestAPI } from './api/changeRequest';
export { sonarqubeAPI } from './api/sonarqube';
export { architectureAPI } from './api/architecture';
export { engineeringHealthAPI } from './api/engineeringHealth';
export { configurationAPI, projectsAPI } from './api/configuration';
export { versionAPI } from './api/version';
export type { ApiParams } from './api/client';
export { fetchAPI, fetchPutAPI } from './api/client';
