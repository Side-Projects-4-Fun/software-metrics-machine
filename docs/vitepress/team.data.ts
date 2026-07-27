interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

async function fetchContributors(): Promise<Contributor[]> {
  const response = await fetch(
    'https://api.github.com/repos/Side-Projects-4-Fun/software-metrics-machine/contributors',
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SMM-Docs-Build',
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<Contributor[]>;
}

export default {
  async load() {
    const contributors = await fetchContributors();
    return { contributors };
  },
};
