import '@testing-library/jest-dom';

const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() })),
  useSearchParams: jest.fn(() => mockSearchParams),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => undefined),
  })),
}));
