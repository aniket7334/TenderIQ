import React from 'react';
import { clsx } from 'clsx';
import { Button, ButtonProps } from './button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  eyebrow,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-20 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center border border-rule-strong text-ink-muted">
          {icon}
        </div>
      )}
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h3 className="font-display text-[22px] font-normal leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          <Button
            variant={action.variant || 'secondary'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};

export { EmptyState };
