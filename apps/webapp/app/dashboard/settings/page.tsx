'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

const WEBAPP_SETTINGS_COOKIE_NAME = 'smm_webapp_settings';

type WebappSettings = {
  fetchCache?: boolean;
};

const defaultSettings: WebappSettings = {
  fetchCache: false,
};

function readWebappSettingsCookie(): WebappSettings {
  const cookieValue = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${WEBAPP_SETTINGS_COOKIE_NAME}=`))
    ?.slice(WEBAPP_SETTINGS_COOKIE_NAME.length + 1);

  if (!cookieValue) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue)) as WebappSettings;
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    return defaultSettings;
  }
}

function readFetchCacheCookie() {
  return readWebappSettingsCookie().fetchCache === true;
}

function writeFetchCacheCookie(enabled: boolean) {
  const settings = {
    ...readWebappSettingsCookie(),
    fetchCache: enabled,
  };

  document.cookie = `${WEBAPP_SETTINGS_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(settings))}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function SettingsPage() {
  const [fetchCacheEnabled, setFetchCacheEnabled] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setFetchCacheEnabled(readFetchCacheCookie());
    setLoaded(true);
  }, []);

  const handleFetchCacheChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;

    setFetchCacheEnabled(enabled);
    writeFetchCacheCookie(enabled);
  };

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Settings
          </Typography>
        </Box>

        <Paper elevation={1} sx={{ borderRadius: 1, p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Webapp
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={fetchCacheEnabled}
                  disabled={!loaded}
                  onChange={handleFetchCacheChange}
                  slotProps={{ input: { 'aria-label': 'toggle REST API cache' } }}
                />
              }
              label="REST API cache"
            />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
