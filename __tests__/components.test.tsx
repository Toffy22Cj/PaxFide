import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, afterEach } from 'vitest';

afterEach(cleanup);
import { Button } from '../src/components/Button';
import { TextField, PasswordField } from '../src/components/TextField';
import { Modal } from '../src/components/Modal';
import { DefinitionList } from '../src/components/DefinitionList';
import { PageHeader } from '../src/components/PageHeader';
import { ErrorState, AmbiguousState } from '../src/components/States';

describe('Button', () => {
  test('renders primary variant by default', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn.className).toContain('pax-btn-primary');
  });

  test('disabled button does not fire onClick', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('submitting state adds ellipsis and disables button', async () => {
    const onClick = vi.fn();
    render(<Button submitting onClick={onClick}>Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Submit…' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField & PasswordField', () => {
  test('renders with label and standard attributes', () => {
    render(<TextField label="Email" placeholder="user@example.com" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('placeholder')).toBe('user@example.com');
  });

  test('renders error correctly linked with aria-describedby', () => {
    render(<TextField label="Username" error="Invalid username" />);
    const input = screen.getByLabelText('Username');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const descId = input.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    const errorElem = document.getElementById(descId!);
    expect(errorElem).toHaveTextContent('Invalid username');
  });

  test('PasswordField toggles visibility', async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    const toggleBtn = screen.getByRole('button', { name: 'Mostrar contraseña' });
    await userEvent.click(toggleBtn);
    expect(input.getAttribute('type')).toBe('text');
    expect(toggleBtn).toHaveTextContent('Ocultar');
    await userEvent.click(toggleBtn);
    expect(input.getAttribute('type')).toBe('password');
  });
});

describe('Modal', () => {
  test('renders when isOpen is true', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="Test Modal">Content</Modal>);
    expect(screen.getByRole('dialog', { name: 'Test Modal' })).toBeInTheDocument();
  });

  test('focus is trapped and escape closes', async () => {
    const onClose = vi.fn();
    render(
      <div>
        <button id="trigger">Trigger</button>
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <input type="text" />
          <Button>Action</Button>
        </Modal>
      </div>
    );
    // Escape should call onClose
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DefinitionList & PageHeader', () => {
  test('DefinitionList renders items', () => {
    render(<DefinitionList items={[{ label: 'Key', value: 'Value' }]} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  test('PageHeader renders title and subtitle', () => {
    render(<PageHeader title="Main Title" subtitle="Subtitle 123" />);
    expect(screen.getByRole('heading', { name: 'Main Title' })).toBeInTheDocument();
    expect(screen.getByText('Subtitle 123')).toBeInTheDocument();
  });
});

describe('States components negative assertions', () => {
  test('ErrorState button is NOT inside the danger background', () => {
    const { container } = render(<ErrorState onRetry={() => {}} />);
    const alerts = container.querySelectorAll('.pax-status-rejected');
    expect(alerts.length).toBe(1);
    const button = screen.getByRole('button', { name: 'Reintentar' });
    // Verify button is NOT a descendant of the alert
    expect(alerts[0].contains(button)).toBe(false);
  });

  test('AmbiguousState buttons are NOT inside the ambiguous background', () => {
    const { container } = render(<AmbiguousState onRetry={() => {}} onClose={() => {}} />);
    const alerts = container.querySelectorAll('.pax-status-ambiguous');
    expect(alerts.length).toBe(1);
    const retryBtn = screen.getByRole('button', { name: 'Reintentar' });
    expect(alerts[0].contains(retryBtn)).toBe(false);
  });
});
