import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/dashboard/settings/page';

function getWebappSettingsCookie() {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('smm_webapp_settings='))
    ?.slice('smm_webapp_settings='.length);

  return value ? JSON.parse(decodeURIComponent(value)) : undefined;
}

describe('SettingsPage', () => {
  beforeEach(() => {
    document.cookie = 'smm_webapp_settings=; path=/; max-age=0';
  });

  it('loads the REST API cache toggle from the JSON settings cookie', async () => {
    document.cookie = `smm_webapp_settings=${encodeURIComponent(JSON.stringify({ fetchCache: true }))}; path=/`;

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'toggle REST API cache' })).toBeChecked();
    });
  });

  it('writes the REST API cache setting into the JSON settings cookie', async () => {
    render(<SettingsPage />);

    const toggle = await screen.findByRole('switch', { name: 'toggle REST API cache' });
    fireEvent.click(toggle);

    expect(getWebappSettingsCookie()).toEqual({ fetchCache: true });
  });
});
