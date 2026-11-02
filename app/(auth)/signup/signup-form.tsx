"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { applyServerErrors, FormError, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { signupSchema, type SignupInput } from "@/lib/validation";
import { signupAction } from "../actions";

export function SignupForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await signupAction(values);
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
        <TextField control={form.control} name="name" label="Your name" autoComplete="name" autoFocus />
        <TextField control={form.control} name="email" label="Work email" type="email" autoComplete="email" inputMode="email" />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters."
        />
      </FieldGroup>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
