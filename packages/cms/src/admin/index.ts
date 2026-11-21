// Building blocks for extra admin pages (the `pages` option), so they match the rest of the admin.
export { Button, buttonVariants } from './ui/button.js';
export { Checkbox, Switch } from './ui/checkbox.js';
export { Input, Textarea } from './ui/input.js';
export { Menu } from './ui/menu.js';
export { Select } from './ui/select.js';
export { Tooltip } from './ui/tooltip.js';
export type {
  ButtonProps,
  CheckboxProps,
  InputProps,
  MenuAction,
  MenuProps,
  SelectOption,
  SelectProps,
  SwitchProps,
  TextareaProps,
  ToastOptions,
  ToastTone,
  TooltipProps,
} from './ui/slots.js';
export { useAdmin } from './context.js';
export { AdminHeader, type Crumb } from './header.js';
export { bodyClass, cardClass, inputClass, labelClass } from './styles.js';
export type { ConfirmOptions } from './confirm.js';
// The client half of the editor config (see `@n3wtou/mnml-cms/editor`).
export { editorProvider } from './editor-context.js';
