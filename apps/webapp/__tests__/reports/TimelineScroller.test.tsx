import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimelineScroller from '@/components/reports/TimelineScroller';
import { renderWithProviders } from '../utils/test-providers';

describe('TimelineScroller', () => {
  const makeWindows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      startDate: `2026-06-${String(i * 7 + 1).padStart(2, '0')}`,
      endDate: `2026-06-${String(i * 7 + 7).padStart(2, '0')}`,
      label: `Week ${i + 1}`,
    }));

  it('renders all windows as buttons', () => {
    const windows = makeWindows(3);
    renderWithProviders(
      <TimelineScroller windows={windows} activeIndex={0} onSelect={jest.fn()} />,
    );

    expect(screen.getByText('Week 1')).toBeVisible();
    expect(screen.getByText('Week 2')).toBeVisible();
    expect(screen.getByText('Week 3')).toBeVisible();
  });

  it('highlights the active window', () => {
    const windows = makeWindows(3);
    renderWithProviders(
      <TimelineScroller windows={windows} activeIndex={1} onSelect={jest.fn()} />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[1].className).toContain('bg-blue-600');
    expect(buttons[0].className).not.toContain('bg-blue-600');
  });

  it('calls onSelect with the clicked index', async () => {
    const onSelect = jest.fn();
    const windows = makeWindows(3);
    renderWithProviders(
      <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByText('Week 2'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('shows date range below label when dates are present', () => {
    const windows = makeWindows(1);
    renderWithProviders(
      <TimelineScroller windows={windows} activeIndex={0} onSelect={jest.fn()} />,
    );

    // The date range text uses short format like "Jun 1 – Jun 7"
    expect(screen.getByText(/Jun/)).toBeVisible();
  });

  it('shows "Default" for null windows', () => {
    renderWithProviders(
      <TimelineScroller
        windows={[null]}
        activeIndex={0}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Default')).toBeVisible();
  });

  describe('keyboard navigation', () => {
    it('moves to next window on ArrowRight', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 1/ }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('moves to previous window on ArrowLeft', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={1} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 2/ }).focus();
      await userEvent.keyboard('{ArrowLeft}');

      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('does nothing on ArrowRight when at last window', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={2} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 3/ }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does nothing on ArrowLeft when at first window', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 1/ }).focus();
      await userEvent.keyboard('{ArrowLeft}');

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('ignores other keys', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 1/ }).focus();
      await userEvent.keyboard('{ArrowUp}');
      await userEvent.keyboard('{Tab}');

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('moves focus to the next window button after ArrowRight', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      const { rerender } = renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 1/ }).focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(onSelect).toHaveBeenCalledWith(1);

      rerender(
        <TimelineScroller windows={windows} activeIndex={1} onSelect={onSelect} />,
      );

      const week2Button = screen.getByRole('button', { name: /Week 2/ });
      expect(week2Button).toHaveFocus();
    });

    it('moves focus to the previous window button after ArrowLeft', async () => {
      const onSelect = jest.fn();
      const windows = makeWindows(3);
      const { rerender } = renderWithProviders(
        <TimelineScroller windows={windows} activeIndex={1} onSelect={onSelect} />,
      );

      screen.getByRole('button', { name: /Week 2/ }).focus();
      await userEvent.keyboard('{ArrowLeft}');
      expect(onSelect).toHaveBeenCalledWith(0);

      rerender(
        <TimelineScroller windows={windows} activeIndex={0} onSelect={onSelect} />,
      );

      const week1Button = screen.getByRole('button', { name: /Week 1/ });
      expect(week1Button).toHaveFocus();
    });
  });
});
