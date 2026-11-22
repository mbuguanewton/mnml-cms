// Building blocks for extra admin pages (the `pages` option), so they match the rest of the admin.
export { Button } from './ui/button.js';
export { buttonVariants } from './ui/button-variants.js';
export { Checkbox, Switch } from './ui/checkbox.js';
export { DatePicker } from './ui/date-picker.js';
export { Input, Textarea } from './ui/input.js';
export { Menu } from './ui/menu.js';
export { Select } from './ui/select.js';
export { Tooltip } from './ui/tooltip.js';
// Swap in a site's own components for any of the above (the `ui` option of createCms).
export { uiProvider, useAdminPortal, type UiSlotProps, type UiSlots } from './ui/context.js';
export type {
  ButtonProps,
  ButtonSlotProps,
  CheckboxProps,
  DatePickerProps,
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
export { useAdmin } from './shell/context.js';
export { AdminHeader, type Crumb } from './shell/header.js';
export { bodyClass, cardClass, inputClass, labelClass } from './ui/styles.js';
export type { ConfirmOptions } from './shell/confirm.js';
// The client half of the editor config (see `@n3wtou/mnml-cms/editor`).
export { editorProvider } from './editor/editor-context.js';
