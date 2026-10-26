import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App.tsx';
import type { LoadedRelease } from '../../src/content/release.ts';
import { DEFAULT_PREFERENCES, DISCLAIMER_VERSION } from '../../src/state/preferences.ts';
import { INACTIVITY_LIMIT_MS } from '../../src/tools/inactivity.ts';
import { loadRealRelease } from '../helpers.ts';

let release: LoadedRelease;
beforeAll(async () => {
  release = await loadRealRelease();
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  vi.useRealTimers();
});

const accepted = { ...DEFAULT_PREFERENCES, disclaimerAccepted: DISCLAIMER_VERSION };
function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
const management = () => screen.getByRole('region', { name: /Management steps/ });

describe('step-through pathway', () => {
  it('asks group-specific steps only after a group is chosen, then follows source branches', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const m = management();
    await userEvent.click(within(m).getByRole('button', { name: 'No' }));
    await userEvent.type(within(m).getByLabelText(/Enter value/), '3');
    await userEvent.click(within(m).getByRole('button', { name: 'Confirm' }));
    // The action step is for both groups, so it continues to the next question
    expect(within(m).getByText('DEMO: Has the sparkling settled? (fictional)')).toBeInTheDocument();
    await userEvent.click(within(m).getByRole('button', { name: 'Yes' }));
    expect(within(m).getByText('End of pathway: continue as described in the source')).toBeInTheDocument();
  });

  it('changing an earlier answer recalculates and says which answers were cleared', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const m = management();
    await userEvent.click(within(m).getByRole('button', { name: 'No' }));
    await userEvent.type(within(m).getByLabelText(/Enter value/), '3');
    await userEvent.click(within(m).getByRole('button', { name: 'Confirm' }));
    await userEvent.click(within(m).getAllByRole('button', { name: 'Change' })[0]!);
    // The first "Yes" belongs to the question being edited (step 1).
    await userEvent.click(within(m).getAllByRole('button', { name: 'Yes' })[0]!);
    expect(within(m).getByRole('status')).toHaveTextContent(
      '1 later answer(s) were cleared because an earlier answer changed.',
    );
    expect(within(m).queryByText('DEMO: Measure the glow level (fictional)')).toBeNull();
    expect(within(m).getByText('End of pathway: consult')).toBeInTheDocument();
  });

  it('an unknown answer with no defined branch stops with an explanation', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const m = management();
    await userEvent.click(within(m).getByRole('button', { name: 'Unknown / not assessed' }));
    expect(within(m).getByRole('alert')).toHaveTextContent(/STOPPED.*does not define what to do when this is unknown/s);
  });

  it('rejects non-numeric input for number questions', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const m = management();
    await userEvent.click(within(m).getByRole('button', { name: 'No' }));
    await userEvent.type(within(m).getByLabelText(/Enter value/), '3 units');
    await userEvent.click(within(m).getByRole('button', { name: 'Confirm' }));
    expect(within(m).getByRole('alert')).toHaveTextContent('Enter a number using digits only');
  });

  it('starting a timer from a step uses the duration from the pathway', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const m = management();
    await userEvent.click(within(m).getByRole('button', { name: 'No' }));
    await userEvent.type(within(m).getByLabelText(/Enter value/), '3');
    await userEvent.click(within(m).getByRole('button', { name: 'Confirm' }));
    await userEvent.click(within(m).getByRole('button', { name: /Start timer: DEMO: Recheck in 7 minutes/ }));
    expect(screen.getByRole('link', { name: /1 timer/ })).toHaveTextContent(/0[67]:\d\d/);
  });
});

describe('timers screen', () => {
  it('has no default duration and validates input', async () => {
    go('#/timers');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByLabelText('Minutes')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('between 1 second and 24 hours');
    await userEvent.type(screen.getByLabelText('Minutes'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    expect(screen.getByRole('timer')).toHaveTextContent(/0[12]:\d\d/);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('timer')).toHaveTextContent('PAUSED');
  });

  it('raises an alert when a timer finishes', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    go('#/timers');
    render(<App release={release} preferences={accepted} />);
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole('alertdialog', { name: /Timer finished/ })).toHaveTextContent('Repeat observations');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('inactivity clear', () => {
  it('warns at 59 minutes, and "Keep working" keeps the session', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    go('#/p/sepsis');
    render(<App release={release} preferences={accepted} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_LIMIT_MS - 59_000);
    });
    expect(screen.getByRole('alertdialog', { name: /Clear session in \d+ s/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });

  it('clears everything after 60 minutes without activity and says why', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    go('#/p/sepsis');
    render(<App release={release} preferences={accepted} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_LIMIT_MS + 2000);
    });
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
    expect(screen.getByText('Session cleared after 60 minutes of inactivity.')).toBeInTheDocument();
  });

  it('does nothing when there is no patient data', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    render(<App release={release} preferences={accepted} />);
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_LIMIT_MS * 2);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText(/Session cleared/)).toBeNull();
  });
});

describe('ISBAR', () => {
  it('fills only from ticked items, warns before copying, and clears', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /When did the sparkling start/ }));
    go('#/isbar');
    await userEvent.click(screen.getByRole('button', { name: 'Fill from ticked items and answers' }));
    expect(screen.getByLabelText(/Background/)).toHaveValue('DEMO: When did the sparkling start? (fictional)');
    expect(screen.getByLabelText(/Identify/)).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    expect(screen.getByRole('alertdialog', { name: 'Copy to clipboard?' })).toHaveTextContent(/clipboard history/);
    expect(writeText).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('B — Background:\nDEMO: When did the sparkling start? (fictional)'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear ISBAR' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText(/Background/)).toHaveValue('');
  });
});

describe('dose calculator screen', () => {
  it('requires a patient group and shows a hard stop above the maximum', async () => {
    go('#/calculator');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByText(/SYNTHETIC TEST HARNESS — NOT FOR PATIENT CARE/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Weight/), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select the patient group first.');
    await userEvent.click(screen.getByRole('radio', { name: 'Child' }));
    await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByRole('status')).toHaveTextContent('30 mg');
    await userEvent.clear(screen.getByLabelText(/Weight/));
    await userEvent.type(screen.getByLabelText(/Weight/), '41');
    await userEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/STOP/);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
