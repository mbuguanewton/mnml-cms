'use client';

import { slotted } from '../ui-context.js';
import { buttonVariants } from './button-variants.js';
import type { ButtonSlotProps } from './slots.js';

export { buttonVariants };

function ButtonBase({ className, variant, size, type = 'button', ...props }: ButtonSlotProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}

/** The admin's button, or the site's `Button` slot. */
export const Button = slotted('Button', ButtonBase);
