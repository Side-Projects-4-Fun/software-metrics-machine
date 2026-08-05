type ConsoleMethod = 'error' | 'warn' | 'log' | 'info';

interface ConsoleSuppression {
  restore: () => void;
}

export function suppressConsole(method: ConsoleMethod): ConsoleSuppression {
  const spy = jest.spyOn(console, method).mockImplementation(() => {});
  return {
    restore: () => spy.mockRestore(),
  };
}

export function suppressConsoleError(): ConsoleSuppression {
  return suppressConsole('error');
}

export function suppressConsoleWarn(): ConsoleSuppression {
  return suppressConsole('warn');
}
