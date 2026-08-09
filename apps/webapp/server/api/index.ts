export { sourceCodeAPI } from './sourceCode';
export { pipelineAPI } from './pipeline';
export { changeRequestAPI } from './changeRequest';
export { sonarqubeAPI } from './sonarqube';
export { architectureAPI } from './architecture';
export { engineeringHealthAPI } from './engineeringHealth';
export { configurationAPI, projectsAPI } from './configuration';
export { versionAPI } from './version';
export { fetchAPI, type ApiParams } from './client';

function sourceCodeAPI() {
  return () => import('./sourceCode').then(m => m.sourceCodeAPI);
}
function sonarqubeAPI() {
  return () => import('./sonarqube').then(m => m.sonarqubeAPI);
}
const changeRequestAPI = () => import('./changeRequest').then(m => m.changeRequestAPI);
function pipelineAPI() {
  return () => import('./pipeline').then(m => m.pipelineAPI);
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  sourceCodeAPI,
  sonarqubeAPI,
  pipelineAPI,
  changeRequestAPI,
};

