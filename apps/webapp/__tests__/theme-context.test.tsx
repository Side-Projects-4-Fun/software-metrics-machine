import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeContextProvider, useTheme } from '@/app/theme-context';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();

  return <button onClick={toggleTheme}>{theme}</button>;
}

function stubPrefersDark(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && prefersDark,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('ThemeContextProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    stubPrefersDark(false);
  });

  it('hydrates the server markup unchanged and then applies the stored preference', async () => {
    window.localStorage.setItem('theme', 'dark');

    const serverHtml = renderToString(
      <ThemeContextProvider>
        <ThemeProbe />
      </ThemeContextProvider>,
    );

    expect(serverHtml).toContain('light');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const loggedErrors: string[] = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      loggedErrors.push(args.map(String).join(' '));
    });

    await act(async () => {
      hydrateRoot(
        container,
        <ThemeContextProvider>
          <ThemeProbe />
        </ThemeContextProvider>,
      );
    });

    consoleError.mockRestore();

    expect(loggedErrors.join(' ')).not.toContain('did not match');
    expect(container.textContent).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    container.remove();
  });

  it('toggles the theme and persists the choice', async () => {
    render(
      <ThemeContextProvider>
        <ThemeProbe />
      </ThemeContextProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'light' }));

    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});
