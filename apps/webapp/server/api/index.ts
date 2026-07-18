export { sourceCodeAPI } from './sourceCode';
export { pipelineAPI } from './pipeline';
export { pullRequestAPI } from './pullRequest';
export { sonarqubeAPI } from './sonarqube';
export { architectureAPI } from './architecture';
export { engineeringHealthAPI } from './engineeringHealth';
export { configurationAPI, projectsAPI } from './configuration';
export { fetchAPI, type ApiParams } from './client';

function sourceCodeAPI() {
  return () => import('./sourceCode').then(m => m.sourceCodeAPI);
}
function sonarqubeAPI() {
  return () => import('./sonarqube').then(m => m.sonarqubeAPI);
}
const pullRequestAPI = () => import('./pullRequest').then(m => m.pullRequestAPI);
function pipelineAPI() {
  return () => import('./pipeline').then(m => m.pipelineAPI);
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  sourceCodeAPI,
  sonarqubeAPI,
  pipelineAPI,
  pullRequestAPI,
};

