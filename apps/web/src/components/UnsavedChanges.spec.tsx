import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useUnsavedChanges } from './UnsavedChanges';

function Harness({ action }: { action: () => void }) {
  const { setDirty, confirmDiscard } = useUnsavedChanges();
  return <><button onClick={() => setDirty(true)}>Stage change</button><button onClick={() => confirmDiscard(action)}>Leave workspace</button></>;
}

describe('UnsavedChangesProvider', () => {
  it('blocks global navigation until staged membership changes are confirmed', () => {
    const action = vi.fn(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<UnsavedChangesProvider><Harness action={action} /></UnsavedChangesProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Stage change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved membership changes?');
    expect(action).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));
    expect(action).toHaveBeenCalledOnce();
  });
});
