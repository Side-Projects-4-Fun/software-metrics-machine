import { defineConfig, HeadConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

const head: HeadConfig[] = [];
// @ts-ignore
const { NODE_ENV } = process.env;

const base = '/software-metrics-machine/';

if (NODE_ENV === 'production') {
  const id = 'G-0WD7NN88MZ';
  head.push([
    'script',
    {
      async: 'true',
      src: 'https://www.googletagmanager.com/gtag/js?id=' + id,
    },
  ]);
  head.push(
    [
      'script',
      {},
      "window.dataLayer = window.dataLayer || [];  function gtag(){dataLayer.push(arguments);}  gtag('js', new Date());  gtag('config', '" + id + "'); gtag('set', 'cookie_flags', 'SameSite=None;Secure');",
    ]);
}

head.push(['link', { rel: 'icon', href: `${base}favicon.ico` }]);

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    sitemap: {
      hostname: 'https://marabesi.com/software-metrics-machine'
    },
    title: "Software metrics machine",
    description: "Stop pointing, start measuring",
    base,
    head,
    // mermaid pulls in the CommonJS `fastdom` package. Pre-bundling it lets Vite
    // add the ESM default interop; without it the dev server serves the raw
    // CommonJS file and the browser fails with "does not provide an export
    // named 'default'".
    vite: {
      optimizeDeps: {
        include: ['fastdom', 'fastdom/extensions/fastdom-promised.js'],
      },
      plugins: [
        {
          // VitePress injects `head` on the client, so the first paint has no
          // icon link and the browser falls back to `/favicon.ico`, which sits
          // outside the configured base. Redirect it in the dev server.
          name: 'smm-favicon-fallback',
          apply: 'serve',
          configureServer(server) {
            server.middlewares.use((request, response, next) => {
              if (request.url === '/favicon.ico') {
                response.statusCode = 302;
                response.setHeader('Location', `${base}favicon.ico`);
                response.end();
                return;
              }
              next();
            });
          },
        },
      ],
    },
    markdown: {
      config(md) {
        md.use(tabsMarkdownPlugin)
      },
    },
    themeConfig: {
      lastUpdated: {
        text: 'Last updated'
      },
      returnToTopLabel: 'Back to top',
      editLink: {
        pattern: 'https://github.com/marabesi/software-metrics-machine/edit/main/docs/:path',
        text: 'Edit this page on GitHub'
      },
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2025-present Matheus Marabesi marabesi.com'
      },
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Team', link: '/team' }
      ],

      sidebar: [
        {
          text: 'Introduction',
          items: [
            { text: 'What is SMM', link: '/what-is-smm', items: [] },
            { text: 'Privacy first', link: '/privacy-first' },
            { text: 'Supported providers', link: '/supported-providers' },
            { text: 'Getting started', link: '/getting-started' },
          ]
        },
        {
          text: 'Using SMM',
          items: [
            { text: 'Your first analysis', link: '/your-first-analysis-with-github' },
            { text: 'Keeping your data up to date', link: '/keeping-your-data-up-to-date' },
          ]
        },
        {
          text: 'SMM',
          items: [
            { text: 'Features', link: '/features', items: [
              { text: 'Project management', link: '/project' },
              { text: 'Engineering Health', link: '/features/engineering-health' },
              { text: 'Metric catalog', link: '/features/metric-catalog' },
              { text: 'Dashboard', link: '/features/dashboard' },
              { text: 'Insights', link: '/features/insights' },
              { text: 'Change requests', link: '/features/change-requests' },
              { text: 'Pipelines', link: '/features/pipelines' },
              { text: 'Source code', link: '/features/code' },
              { text: 'Architecture', link: '/features/architecture' },
              { text: 'SonarQube', link: '/sonarqube' },
              {
                text: 'Tools', link: '/tools', items: []
              },
            ] },
            { text: 'Configuration', link: '/features/configuration' },
            { text: 'REST API', link: '/rest-api' },
            { text: 'MCP server', link: '/mcp' },
          ]
        },
        {
          text: 'Integrations',
          items: [
            {
              text: 'GitHub', link: '/github', items: []
            },
            {
              text: 'GitLab', link: '/gitlab'
            },
            {
              text: 'Jira', link: '/jira'
            },
            {
              text: 'SonarQube', link: '/sonarqube'
            },
            {
              text: 'Codemaat', link: '/codemaat', items: [ ]
            },
          ]
        },
        {
          text: 'Investigations',
          items: [
            {
              text: 'Change request review process', link: '/investigations/change-request-review-process', items: [ ]
            },
            {
              text: 'Pipeline run time', link: '/investigations/pipeline-run-time', items: [ ]
            },
            {
              text: 'Assessing technical debt', link: '/investigations/technical-debt', items: [ ]
            },
          ]
        }
      ],

      socialLinks: [
        { icon: 'github', link: 'https://github.com/marabesi/software-metrics-machine' }
      ],

      search: {
        provider: 'local'
      }
    }
  })
)
