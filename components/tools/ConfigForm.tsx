"use client";

import { useEffect, useState } from "react";
import type { ConfigField } from "@/lib/types";
import { Field, Input, Select, Slider, Switch, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Button";

export type ConfigValues = Record<string, string | number | boolean>;

export function useConfigValues(fields: ConfigField[]): [
  ConfigValues,
  (key: string, value: string | number | boolean) => void,
] {
  const [values, setValues] = useState<ConfigValues>({});
  useEffect(() => {
    const initial: ConfigValues = {};
    for (const field of fields) {
      initial[field.key] = field.default;
    }
    setValues(initial);
  }, [fields]);
  const set = (key: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };
  return [values, set];
}

export function ConfigForm({
  fields,
  values,
  onChange,
  loading = false,
}: {
  fields: ConfigField[];
  values: ConfigValues;
  onChange: (key: string, value: string | number | boolean) => void;
  loading?: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <ConfigFieldControl
          key={field.key}
          field={field}
          value={values[field.key] ?? field.default}
          onChange={onChange}
          disabled={loading}
        />
      ))}
    </div>
  );
}

function ConfigFieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ConfigField;
  value: string | number | boolean;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled: boolean;
}) {
  switch (field.type) {
    case "select":
      return (
        <Field label={field.label} htmlFor={field.key} help={field.help}>
          <Select
            id={field.key}
            value={String(value)}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{field.label}</p>
            {field.help ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{field.help}</p>
            ) : null}
          </div>
          <Switch
            checked={Boolean(value)}
            onChange={(v) => onChange(field.key, v)}
            label={field.label}
          />
        </div>
      );
    case "slider":
      return (
        <Field label={field.label} help={field.help}>
          <Slider
            value={Number(value)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(v) => onChange(field.key, v)}
            label={field.label}
          />
        </Field>
      );
    case "number":
      return (
        <Field label={field.label} help={field.help}>
          <Input
            id={field.key}
            type="number"
            min={field.min}
            max={field.max}
            value={Number(value)}
            disabled={disabled}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
          />
        </Field>
      );
    case "textarea":
      return (
        <Field label={field.label} help={field.help}>
          <Textarea
            id={field.key}
            value={String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </Field>
      );
    case "text":
    default:
      return (
        <Field label={field.label} help={field.help}>
          <Input
            id={field.key}
            value={String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </Field>
      );
  }
}

export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 animate-fade-in"
      role="status"
    >
      <Spinner className="h-5 w-5 text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
