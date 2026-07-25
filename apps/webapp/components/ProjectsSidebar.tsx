'use client';

import { useProjects } from '@/components/providers/ProjectsContext';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function ProjectsSidebar() {
  const { projects, activeProject, selectProject } = useProjects();

  const handleProjectClick = (projectName: string) => {
    // Switch project and drop stale filter params from the current URL.
    selectProject(projectName);

    const nextUrl = new URL(window.location.href);
    nextUrl.search = '';
    window.location.assign(nextUrl.toString());
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <List component="nav" disablePadding>
      {projects.map((project) => {
        const isActive = project.github_repository === activeProject;
        return (
          <ListItemButton
            key={project.github_repository}
            selected={isActive}
            onClick={() => handleProjectClick(project.github_repository)}
          >
            <ListItemIcon>
              {isActive ? (
                <CheckCircleIcon color="primary" />
              ) : (
                <FolderIcon />
              )}
            </ListItemIcon>
            <ListItemText
              primary={project.github_repository}
              slotProps={{
                primary: {
                  variant: 'body2',
                  noWrap: true,
                  title: project.github_repository,
                },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
