"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Plus, Search, Trash2, type LucideIcon } from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ControlSize = "sm" | "md" | "lg";
type ButtonVariant = "primary" | "secondary" | "dangerGhost" | "ghost";
type ButtonSize = "sm" | "md" | "lg";
export type BadgeTone = "green" | "blue" | "orange" | "rose" | "neutral";

const controlBaseClassName =
  "w-full rounded-lg border border-[#d8d1c2] bg-white text-sm outline-none transition focus:border-[#173f35] focus:ring-4 focus:ring-[#173f35]/10 disabled:cursor-not-allowed disabled:opacity-60";

const controlSizeClassNames: Record<ControlSize, string> = {
  lg: "h-12 px-4 text-base",
  md: "h-11 px-3",
  sm: "h-10 px-3",
};

const buttonVariantClassNames: Record<ButtonVariant, string> = {
  dangerGhost: "border border-[#ded8cb] bg-transparent text-[#716b61] hover:border-[#be123c] hover:text-[#be123c]",
  ghost: "border border-[#ded8cb] bg-white text-[#3c3933] hover:border-[#173f35] hover:text-[#173f35]",
  primary: "bg-[#173f35] text-white hover:bg-[#0f3028]",
  secondary: "border border-[#d8d1c2] bg-white text-[#173f35] hover:border-[#173f35]",
};

const buttonSizeClassNames: Record<ButtonSize, string> = {
  lg: "h-12 px-4",
  md: "h-11 px-4",
  sm: "h-10 px-3",
};

const badgeToneClassNames: Record<BadgeTone, string> = {
  blue: "bg-[#e8f0ff] text-[#2563eb]",
  green: "bg-[#e7f4ef] text-[#0f766e]",
  neutral: "bg-[#f4efe5] text-[#716b61]",
  orange: "bg-[#fff1e7] text-[#c2410c]",
  rose: "bg-[#fff1f2] text-[#be123c]",
};

type TextInputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  controlSize?: ControlSize;
};

export function TextInput({ className, controlSize = "md", ...props }: TextInputProps) {
  return <input className={cn(controlBaseClassName, controlSizeClassNames[controlSize], className)} {...props} />;
}

type SelectInputProps = Omit<ComponentPropsWithoutRef<"select">, "size"> & {
  controlSize?: ControlSize;
};

export function SelectInput({ children, className, controlSize = "md", ...props }: SelectInputProps) {
  return (
    <select className={cn(controlBaseClassName, controlSizeClassNames[controlSize], className)} {...props}>
      {children}
    </select>
  );
}

type FieldProps = TextInputProps & {
  inputClassName?: string;
  label: string;
  labelClassName?: string;
};

export function Field({ inputClassName, label, labelClassName, ...props }: FieldProps) {
  return (
    <label className={cn("block text-sm font-medium text-[#3c3933]", labelClassName)}>
      {label}
      <TextInput className={cn("mt-2", inputClassName)} {...props} />
    </label>
  );
}

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type SelectFieldProps = SelectInputProps & {
  inputClassName?: string;
  label: string;
  labelClassName?: string;
  options?: Record<string, string> | SelectOption[];
};

export function SelectField({ children, inputClassName, label, labelClassName, options, ...props }: SelectFieldProps) {
  const renderedOptions: SelectOption[] = Array.isArray(options)
    ? options
    : Object.entries(options ?? {}).map(([value, optionLabel]) => ({ label: optionLabel, value }));

  return (
    <label className={cn("block text-sm font-medium text-[#3c3933]", labelClassName)}>
      {label}
      <SelectInput className={cn("mt-2", inputClassName)} {...props}>
        {children ??
          renderedOptions.map((option) => (
            <option disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </SelectInput>
    </label>
  );
}

export function ColorField({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <Field
      defaultValue={defaultValue}
      inputClassName="px-2"
      label={label}
      name={name}
      type="color"
    />
  );
}

type ActionButtonProps = ComponentPropsWithoutRef<"button"> & {
  full?: boolean;
  icon?: LucideIcon;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ActionButton({
  children,
  className,
  full = false,
  icon: Icon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        buttonSizeClassNames[size],
        buttonVariantClassNames[variant],
        full && "w-full",
        className,
      )}
      type={type}
      {...props}
    >
      {Icon ? <Icon size={17} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function SubmitButton({ label }: { label: string }) {
  return (
    <ActionButton className="mt-2" icon={Plus} type="submit">
      {label}
    </ActionButton>
  );
}

export function IconButton({
  className,
  icon: Icon = Trash2,
  iconSize = 16,
  label,
  tone = "danger",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  icon?: LucideIcon;
  iconSize?: number;
  label: string;
  tone?: "danger" | "neutral";
}) {
  return (
    <button
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "border-[#ded8cb] text-[#716b61] hover:border-[#be123c] hover:text-[#be123c]"
          : "border-[#ded8cb] bg-white text-[#3c3933] hover:border-[#173f35] hover:text-[#173f35]",
        className,
      )}
      title={label}
      type="button"
      {...props}
    >
      <Icon size={iconSize} aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function Notice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-[#d7c7a0] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b541d]", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", badgeToneClassNames[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("rounded-lg border border-[#ded8cb] bg-white p-5 shadow-sm", className)}>{children}</article>;
}

export function Surface({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#ded8cb] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({
  className,
  color = "#0f766e",
  value,
}: {
  className?: string;
  color?: string;
  value: number;
}) {
  const clampedValue = Math.max(0, Math.min(value, 100));

  return (
    <div className={cn("h-2.5 rounded-full bg-[#eee8dc]", className)}>
      <div className="h-full rounded-full" style={{ width: `${clampedValue}%`, backgroundColor: color }} />
    </div>
  );
}

export function ColorDot({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function SearchField({
  className,
  inputClassName,
  ...props
}: TextInputProps & {
  inputClassName?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#716b61]" size={16} />
      <TextInput className={cn("pl-9", inputClassName)} {...props} />
    </label>
  );
}
