"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { applyServerErrors, FormError, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { loginSchema, type LoginInput } from "@/lib/validation";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await loginAction(values, next);
      // On success the action redirects; we only get here on failure.
      if (res && !res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={error} />
      <FieldGroup>
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" inputMode="email" autoFocus />
        <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
      </FieldGroup>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
