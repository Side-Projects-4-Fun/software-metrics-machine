'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function EngineeringHealthFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="body2" sx={{ mr: 2 }}>
            <Link href="/" className="text-white no-underline opacity-80 hover:opacity-100">
              &larr; Home
            </Link>
          </Typography>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            <Link href="/" className="text-white no-underline">
              Software Metrics Machine
            </Link>
          </Typography>
          <ThemeToggle />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
