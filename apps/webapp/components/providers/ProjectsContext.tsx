'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { ProjectItem } from '@/server/api/configuration';

interface ProjectsContextValue {
  projects: ProjectItem[];
  activeProject: string | undefined;
  selectProject: (projectName: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const useProjects = (): ProjectsContextValue => {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};

export const ProjectsProvider = ({
  projects,
  initialActiveProject,
  children,
}: {
  projects: ProjectItem[];
  initialActiveProject?: string;
  children?: ReactNode | undefined;
}) => {
  const [activeProject, setActiveProject] = useState<string | undefined>(initialActiveProject);

  const selectProject = useCallback((projectName: string) => {
    setActiveProject(projectName);
    document.cookie = `smm_active_project=${encodeURIComponent(projectName)};path=/;max-age=31536000`;
  }, []);

  const contextValue = useMemo(
    () => ({ projects, activeProject, selectProject }),
    [activeProject, projects, selectProject],
  );

  return (
    <ProjectsContext.Provider value={contextValue}>
      {children}
    </ProjectsContext.Provider>
  );
};
