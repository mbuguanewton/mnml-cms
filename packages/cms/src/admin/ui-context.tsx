'use client';

import { createContext, use, useState, type ComponentType, type ReactNode } from 'react';
import type {
  ButtonSlotProps,
  CheckboxProps,
  DatePickerProps,
  InputProps,
  MenuProps,
  SelectProps,
  SwitchProps,
  TextareaProps,
  TooltipProps,
} from './ui/slots.js';

/** The admin's swappable components, by slot name, with the props each one gets. */
export type UiSlotProps = {
  Button: ButtonSlotProps;
  Input: InputProps;
  Textarea: TextareaProps;
  Select: SelectProps;
  Checkbox: CheckboxProps;
  DatePicker: DatePickerProps;
  Switch: SwitchProps;
  Tooltip: TooltipProps;
  Menu: MenuProps;
};

/** A site's own components for any of the admin's slots. Slots left out use the built-in ones. */
export type UiSlots = { [K in keyof UiSlotProps]?: ComponentType<UiSlotProps[K]> };

const UiContext = createContext<UiSlots>({});

/**
 * Hands a site's own components to the admin. Call it in a 'use client' file and pass the result as `ui` to
 * `createCms`:
 *
 *   export const AdminUi = uiProvider({ Select: MySelect });
 */
export function uiProvider(slots: UiSlots) {
  return function UiProvider({ children }: { children: ReactNode }) {
    return <UiContext value={slots}>{children}</UiContext>;
  };
}

/**
 * The admin's component for `name`: the site's one when it gave that slot, else `Builtin`. The site's component
 * renders without its own slot, so one that wraps the admin's component (e.g. to add a class) gets the built-in.
 */
export function slotted<K extends keyof UiSlotProps>(name: K, Builtin: ComponentType<UiSlotProps[K]>) {
  function Slotted(props: UiSlotProps[K]) {
    const ui = use(UiContext);
    const Custom = ui[name] as ComponentType<UiSlotProps[K]> | undefined;
    if (!Custom) return <Builtin {...props} />;
    return (
      <UiContext value={{ ...ui, [name]: undefined }}>
        <Custom {...props} />
      </UiContext>
    );
  }
  Slotted.displayName = name;
  return Slotted;
}

const PortalContext = createContext<HTMLElement | null>(null);

/**
 * Where a site component should portal its popover (Radix `Portal container`): an element inside the open admin
 * dialog, so the popover sits above it and stays clickable. `undefined` outside a dialog (portal to `<body>`).
 */
export const useAdminPortal = () => use(PortalContext) ?? undefined;

/** Gives the children a portal target inside this element (a modal dialog) while `active`. */
export function PortalHost({ active = true, children }: { active?: boolean; children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <PortalContext value={active ? el : null}>
      {children}
      <div ref={setEl} />
    </PortalContext>
  );
}
