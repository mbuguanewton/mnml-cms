import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

// The admin's own button, styled with the mnml-* tokens so it doesn't depend on the host's components.
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border border-transparent text-sm font-medium transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-mnml-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-mnml-primary text-mnml-on-primary hover:bg-mnml-primary/85',
        secondary: 'bg-mnml-accent text-mnml-on-accent hover:bg-mnml-accent/80',
        outline: 'border-mnml-line bg-mnml-bg text-mnml-text hover:bg-mnml-surface',
        ghost: 'text-mnml-text hover:bg-mnml-surface',
        danger: 'text-mnml-danger hover:bg-mnml-danger/10',
        destructive: 'bg-mnml-danger text-white hover:bg-mnml-danger/90',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[0.8rem] [&_svg:not([class*=size-])]:size-3.5',
        icon: 'size-8',
        'icon-sm': 'size-7',
        'icon-xs': 'size-6 [&_svg:not([class*=size-])]:size-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
