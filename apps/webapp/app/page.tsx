import { getServerEnv } from '@/server/config/server-env';
import Link from 'next/link';
import SavedFiltersOverview from '@/components/home/SavedFiltersOverview';
import AppProviders from '@/components/providers/AppProviders';
import { loadAppProviderData } from '@/server/app-provider-data';
import { getApplicationVersion } from '@smmachine/utils';

const resources = [
  {
    title: 'GitHub Repository',
    description: 'View source code, contribute, and report issues',
    href: 'https://github.com/marabesi/software-metrics-machine',
    icon: '🔗',
  },
  {
    title: 'Documentation',
    description: 'Learn how to use Software Metrics Machine',
    href: 'https://marabesi.github.io/software-metrics-machine/getting-started.html',
    icon: '📚',
  },
  {
    title: 'Configuration Guide',
    description: 'Set up providers and configure your workspace',
    href: 'https://marabesi.github.io/software-metrics-machine/features/configuration.html',
    icon: '⚙️',
  },
  {
    title: 'CLI Tools',
    description: 'Access SMM through command-line interface',
    href: 'https://marabesi.github.io/software-metrics-machine/tools.html',
    icon: '💻',
  },
  {
    title: 'SonarQube Integration',
    description: 'Learn about SonarQube provider configuration',
    href: 'https://marabesi.github.io/software-metrics-machine/sonarqube.html',
    icon: '🔍',
  },
  {
    title: 'Resources used in SMM',
    description: 'Learn about the resources used in SMM',
    href: '/dashboard/references',
    icon: '📦',
  },
];

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { smmRestBaseUrl: apiBaseUrl } = getServerEnv();
  const providerData = await loadAppProviderData();
  const applicationVersion = getApplicationVersion();

  return (
    <AppProviders {...providerData}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8 mb-16">
            <h1 className="text-5xl font-bold text-gray-900">
              <Link href="/" className="inline-block">
                Software Metrics Machine
              </Link>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Analyze your repository&apos;s health with comprehensive metrics for source code,
              CI/CD pipelines, and pull requests.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/dashboard"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                View Dashboard
              </Link>
              <a
                href={`${apiBaseUrl}/api/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                API Docs
              </a>
            </div>
          </div>

          <div className="mb-16">
            <div className="mb-4 text-center text-sm font-medium text-gray-600">
              Version {applicationVersion}
            </div>
            <SavedFiltersOverview />
          </div>

          {/* Resources Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">Learn More</h2>
              <p className="text-gray-600 mt-2">Explore additional resources and documentation</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource) => (
                <a
                  key={resource.title}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  <div className="text-4xl mb-3">{resource.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600">{resource.description}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppProviders>
  );
}
