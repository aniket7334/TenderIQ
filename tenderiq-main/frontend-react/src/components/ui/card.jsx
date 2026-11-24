import React from 'react';
import { clsx } from 'clsx';

const variantStyles = {
  default: 'bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(29,28,25,0.04),0_4px_16px_-8px_rgba(29,28,25,0.08)]',
  bordered: 'bg-white border border-gray-200',
};

const Card = ({
  className,
  variant = 'default',
  header,
  footer,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx('rounded-xl', variantStyles[variant], className)}
      {...props}
    >
      {header && (
        <div className="border-b border-gray-100 px-6 py-4">
          {typeof header === 'string' ? (
            <h3 className="text-base font-semibold text-gray-900">{header}</h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
      {footer && (
        <div className="border-t border-gray-100 px-6 py-4">{footer}</div>
      )}
    </div>
  );
};

export { Card };
