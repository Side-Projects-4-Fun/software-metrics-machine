'use client';

import { useProjects } from '@/components/providers/ProjectsContext';

interface ActiveProjectNameProps {
  fallback?: string;
}

export default function ActiveProjectName({ fallback = 'Not selected' }: ActiveProjectNameProps): React.ReactElement {
  const { activeProject } = useProjects();

  return <>{activeProject ?? fallback}</>;
}
