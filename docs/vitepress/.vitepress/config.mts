import { defineConfig, HeadConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

const head: HeadConfig[] = [];
// @ts-ignore
const { NODE_ENV } = process.env;

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

head.push(['link', { rel: 'icon', href: 'favicon.ico' }]);

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    sitemap: {
      hostname: 'https://marabesi.com/software-metrics-machine'
    },
    title: "Software metrics machine",
    description: "Stop pointing, start measuring",
    base: '/software-metrics-machine/',
    head,
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
      ],

      sidebar: [
        {
          text: 'Introduction',
          items: [
            { text: 'What is SMM', link: '/what-is-smm', items: [] },
            { text: 'Privacy first', link: '/privacy-first' },
            { text: 'Supported providers', link: '/supported-providers' },
            { text: 'Getting started', link: '/getting-started' },
            { text: 'Your first analysis', link: '/your-first-analysis-with-github' },
          ]
        },
        {
          text: 'SMM',
          items: [
            { text: 'Features', link: '/features' },
            { text: 'Insights', link: '/features/insights' },
            { text: 'Engineering Health', link: '/features/engineering-health' },
            { text: 'Pull requests', link: '/features/prs' },
            { text: 'Pipelines', link: '/features/pipelines' },
            { text: 'Source code', link: '/features/code' },
            { text: 'Architecture', link: '/features/architecture' },
            { text: 'SonarQube', link: '/sonarqube' },
            { text: 'REST API', link: '/rest-api' },
            { text: 'MCP server', link: '/mcp' },
            { text: 'Configuration', link: '/features/configuration' },
          ]
        },
        {
          text: 'Integrations',
          items: [
            {
              text: 'GitHub', link: '/github', items: [
                { text: 'CLI', link: '/github/cli' },
                { text: 'Pull requests', link: '/github/cli-prs' },
                { text: 'Pipelines', link: '/github/cli-workflows' },
              ]
            },
            {
              text: 'Jira', link: '/jira'
            },
            {
              text: 'GitLab', link: '/gitlab'
            },
            {
              text: 'SonarQube', link: '/sonarqube'
            },
            {
              text: 'Codemaat', link: '/codemaat', items: [
                { text: 'CLI', link: '/codemaat/cli' },
              ]
            },
            {
              text: 'Tools', link: '/tools', items: [
                { text: 'CLI', link: '/tools/cli' },
                { text: 'Health check', link: '/tools#health-check' },
              ]
            }
          ]
        },
        {
          text: 'Investigations',
          items: [
            {
              text: 'Team review process', link: '/investigations/review-process', items: [ ]
            },
            {
              text: 'Pipeline run time', link: '/investigations/pipeline-run-time', items: [ ]
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
