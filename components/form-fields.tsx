"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

type BaseProps<T extends FieldValues> = {
  // The transformed-output generic differs per form (Zod transforms), so that slot must stay open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<T, any, any>;
  name: FieldPath<T>;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
  autoFocus,
  prefix,
}: BaseProps<T> & {
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "tel";
  autoComplete?: string;
  autoFocus?: boolean;
  prefix?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {label && <FieldLabel htmlFor={`f-${name}`}>{label}</FieldLabel>}
          <div className="relative">
            {prefix && (
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                {prefix}
              </span>
            )}
            <Input
              {...field}
              value={field.value ?? ""}
              id={`f-${name}`}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              className={prefix ? "pl-6" : undefined}
            />
          </div>
          {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  placeholder,
  rows = 3,
}: BaseProps<T> & { placeholder?: string; rows?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {label && <FieldLabel htmlFor={`f-${name}`}>{label}</FieldLabel>}
          <Textarea
            {...field}
            value={field.value ?? ""}
            id={`f-${name}`}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export type Option = { value: string; label: string };

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  options,
  placeholder = "Select…",
}: BaseProps<T> & { options: Option[]; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {label && <FieldLabel htmlFor={`f-${name}`}>{label}</FieldLabel>}
          <Select
            items={options}
            value={field.value ?? null}
            onValueChange={(v) => field.onChange(v ?? "")}
            disabled={disabled}
          >
            <SelectTrigger id={`f-${name}`} className="w-full" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Copy field errors returned by a server action onto the react-hook-form instance. */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  result: Extract<ActionResult, { ok: false }>,
) {
  for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
    setError(path as FieldPath<T>, { type: "server", message });
  }
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}
