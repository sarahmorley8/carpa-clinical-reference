import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App.tsx';
import type { LoadedRelease } from '../../src/content/release.ts';
import { DEFAULT_PREFERENCES, DISCLAIMER_VERSION, PREFERENCES_KEY } from '../../src/state/preferences.ts';
import { loadRealRelease } from '../helpers.ts';

let release: LoadedRelease;
beforeAll(async () => {
  release = await loadRealRelease();
  // jsdom has no scrolling
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const accepted = { ...DEFAULT_PREFERENCES, disclaimerAccepted: DISCLAIMER_VERSION };

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('first launch', () => {
  it('shows the disclaimer until accepted', async () => {
    render(<App release={release} preferences={DEFAULT_PREFERENCES} />);
    expect(screen.getByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(screen.getByRole('heading', { name: /CRITICAL/ })).toBeInTheDocument();
  });
});

describe('home screen', () => {
  it('shows the prototype banner, critical tiles and empty categories honestly', () => {
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByText(/NOT FOR CLINICAL USE/)).toBeInTheDocument();
    const critical = screen.getByRole('region', { name: /CRITICAL/ });
    expect(within(critical).getByRole('link', { name: 'Chest pain' })).toHaveAttribute('href', '#/p/chest-pain');
    expect(within(critical).getByText('Cardiac arrest').closest('a')).toBeNull();
    expect(within(critical).getAllByText(/No content yet/).length).toBe(3);
  });

  it('critical pathway is one tap from home', async () => {
    render(<App release={release} preferences={accepted} />);
    await userEvent.click(screen.getByRole('link', { name: 'Anaphylaxis' }));
    expect(window.location.hash).toBe('#/p/anaphylaxis');
  });

  it('search shows matching presentations', async () => {
    render(<App release={release} preferences={accepted} />);
    await userEvent.type(screen.getByLabelText('Search presentations'), 'sepssis');
    const results = screen.getByRole('region', { name: 'Search results' });
    expect(within(results).getByRole('link', { name: /Sepsis/ })).toBeInTheDocument();
  });
});

describe('pathway screen', () => {
  it('shows every section in the agreed order with demonstration labelling', () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByText('DEMONSTRATION ONLY — NOT FOR CLINICAL USE')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
    const order = [
      'Red flags',
      'Assessment',
      'Observation reference ranges',
      'Investigations',
      'Management steps',
      'Medication reference',
      'Consultation and retrieval',
      'Monitoring and reassessment',
      'Follow-up',
      'Source and version',
    ];
    const positions = order.map((t) => headings.findIndex((h) => h.startsWith(t)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(screen.getByRole('link', { name: /Call for help/ })).toHaveAttribute(
      'href',
      '#/p/demo-fictional-fever/escalate',
    );
  });

  it('template placeholders display as NOT ENTERED, never blank', () => {
    go('#/p/asthma');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByText('TEMPLATE — NO CLINICAL CONTENT ENTERED')).toBeInTheDocument();
    expect(screen.getAllByText('NOT ENTERED').length).toBeGreaterThan(10);
    expect(screen.getAllByText('NUMBER NOT ENTERED').length).toBe(2);
  });

  it('without a patient group, group-specific items are labelled; selecting a group filters them', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const wings = () => screen.queryByText('DEMO: Check for wings (child only, fictional)');
    expect(wings()).toBeInTheDocument();
    expect(screen.getAllByText('CHILD ONLY').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: 'Adult' }));
    expect(wings()).toBeNull();
    expect(screen.queryByText('CHILD ONLY')).toBeNull();
  });

  it('ticks are cleared by End session, and never written to storage', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    const box = screen.getByRole('checkbox', { name: /When did the sparkling start/ });
    await userEvent.click(box);
    expect(box).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Add to favourites' }));

    const stored = Object.keys(window.localStorage)
      .map((k) => `${k}=${window.localStorage.getItem(k)}`)
      .join('\n');
    expect(Object.keys(window.localStorage)).toEqual([PREFERENCES_KEY]);
    expect(stored).not.toMatch(/hx-onset|sparkling start/);
    expect(stored).toMatch(/demo-fictional-fever/); // favourite id only

    await userEvent.click(screen.getByRole('button', { name: 'End session' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear everything' }));
    expect(screen.getByRole('checkbox', { name: /When did the sparkling start/ })).not.toBeChecked();
  });

  it('changing patient group with ticks asks first, then clears ticks', async () => {
    go('#/p/demo-fictional-fever');
    render(<App release={release} preferences={accepted} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /When did the sparkling start/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Child' }));
    expect(screen.getByRole('alertdialog', { name: 'Change patient group?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('checkbox', { name: /When did the sparkling start/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Child' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change and clear ticks' }));
    expect(screen.getByRole('checkbox', { name: /When did the sparkling start/ })).not.toBeChecked();
  });

  it('blocked or unknown presentations tell the user to use the manual', () => {
    go('#/p/no-such-thing');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/not found.*Use the printed manual/s);
  });
});

describe('settings', () => {
  it('shows versions and honest offline status', () => {
    go('#/settings');
    render(<App release={release} preferences={accepted} />);
    expect(screen.getByText(release.manifest.releaseId)).toBeInTheDocument();
    // Offline is inactive outside built releases, and the app says so rather than claiming readiness.
    expect(screen.getByText('Offline inactive (development build)')).toBeInTheDocument();
  });
});
