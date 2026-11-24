import React from 'react';
import { clsx } from 'clsx';

const variantStyles = {
  default:  'bg-canvas border border-rule',
  bordered: 'bg-canvas border border-rule',
  sunken:   'bg-paper-tint border border-rule-soft',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantStyles;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow?: string;
}

const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  header,
  footer,
  eyebrow,
  children,
  ...props
}) => {
  return (
    <div className={clsx(variantStyles[variant], className)} {...props}>
      {(header || eyebrow) && (
        <div className="border-b border-rule px-6 py-5">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          {typeof header === 'string' ? (
            <h3 className="font-display text-[20px] font-normal leading-none tracking-[-0.015em] text-ink">
              {header}
            </h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="border-t border-rule px-6 py-4">{footer}</div>
      )}
    </div>
  );
};

export { Card };
