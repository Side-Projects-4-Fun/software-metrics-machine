'use client';

import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import GitHubIcon from '@mui/icons-material/GitHub';
import Print from '@mui/icons-material/Print';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SettingsIcon from '@mui/icons-material/Settings';
import Link from 'next/link';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FiltersContainer from '@/components/filters/FiltersContainer';
import ProjectsSidebar from '@/components/ProjectsSidebar';
import DashboardTabs from '@/components/tabs/TabContext';
import { ThemeToggle } from '@/components/ThemeToggle';

const drawerWidth = 410;
const leftDrawerWidth = 280;

const Main = styled('main', {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'leftOpen',
})<{
  open?: boolean;
  leftOpen?: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginRight: `-${drawerWidth}px`,
  marginLeft: `-${leftDrawerWidth}px`,
  variants: [
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: 0,
      },
    },
    {
      props: ({ leftOpen }) => leftOpen,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
      },
    },
  ],
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'leftOpen',
})<{ open?: boolean; leftOpen?: boolean }>(({ theme, open, leftOpen }) => {
  const totalLeft = leftOpen ? leftDrawerWidth : 0;
  const totalRight = open ? drawerWidth : 0;
  return {
    width: `calc(100% - ${totalLeft}px - ${totalRight}px)`,
    marginLeft: `${totalLeft}px`,
    marginRight: `${totalRight}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: open || leftOpen
        ? theme.transitions.easing.easeOut
        : theme.transitions.easing.sharp,
      duration: open || leftOpen
        ? theme.transitions.duration.enteringScreen
        : theme.transitions.duration.leavingScreen,
    }),
  };
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

export default function DrawerLayout({
  repository,
  children,
}: {
  repository: string,
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [rightOpen, setRightOpen] = React.useState(true);
  const [leftOpen, setLeftOpen] = React.useState(false);

  const handleRightDrawerOpen = () => {
    setRightOpen(true);
  };

  const handleRightDrawerClose = () => {
    setRightOpen(false);
  };

  const handleLeftDrawerOpen = () => {
    setLeftOpen(true);
  };

  const handleLeftDrawerClose = () => {
    setLeftOpen(false);
  };

  return (
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" open={rightOpen} leftOpen={leftOpen}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open projects panel"
              onClick={handleLeftDrawerOpen}
              edge="start"
              sx={[
                { mr: 2 },
                leftOpen && { display: 'none' },
              ]}
            >
              <FolderOpenIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              <Link href="/" className="text-white no-underline">
                Software Metrics Machine
              </Link>
            {repository && ` - ${repository}`}
            </Typography>
            <ThemeToggle />
            <IconButton
              color="inherit"
              aria-label="print page"
              onClick={() => window.print()}
              edge="end"
              sx={{ ml: 1 }}
              className="no-print"
            >
              <Print />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="open repository in github"
              component="a"
              href="https://github.com/marabesi/software-metrics-machine"
              target="_blank"
              rel="noreferrer"
              edge="end"
              sx={{ ml: 1 }}
            >
              <GitHubIcon />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="view references and sources"
              component={Link}
              href="/dashboard/references"
              edge="end"
              sx={{ ml: 1 }}
            >
              <MenuBookIcon />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="open settings"
              component={Link}
              href="/dashboard/settings"
              edge="end"
              sx={{ ml: 1 }}
            >
              <SettingsIcon />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleRightDrawerOpen}
              edge="end"
              sx={[
                {
                  ml: 2,
                },
                rightOpen && { display: 'none' },
              ]}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Left Drawer - Projects */}
        <Drawer
          sx={{
            width: leftDrawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: leftDrawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="persistent"
          anchor="left"
          open={leftOpen}
        >
          <DrawerHeader sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ ml: 1 }}>Projects</Typography>
            <IconButton onClick={handleLeftDrawerClose}>
              {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </DrawerHeader>
          <Divider />
          <Box sx={{ overflowY: 'auto' }}>
            <ProjectsSidebar />
          </Box>
        </Drawer>

        {/* Main Content */}
        <Main open={rightOpen} leftOpen={leftOpen}>
          <DrawerHeader />
          <DashboardTabs />
          {children}
        </Main>

        {/* Right Drawer - Filters */}
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="persistent"
          anchor="right"
          open={rightOpen}
        >
          <DrawerHeader>
            <IconButton onClick={handleRightDrawerClose}>
              {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </DrawerHeader>
          <Divider />
          <Box sx={{ p: 2, overflowY: 'auto' }}>
            <FiltersContainer repository={repository} />
          </Box>
        </Drawer>
      </Box>
  );
}
