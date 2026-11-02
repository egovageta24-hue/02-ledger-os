"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { applyServerErrors, FormError, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { CURRENCIES, onboardingSchema, type OnboardingInput } from "@/lib/validation";
import { createWorkspaceAction } from "./actions";

const STEPS = [
  { title: "Your workspace", description: "Name your business and pick the currency you invoice in." },
  { title: "Invoice defaults", description: "These pre-fill every new invoice. You can change them any time in Settings." },
] as const;

const STEP_FIELDS: (keyof OnboardingInput)[][] = [
  ["name", "currency"],
  ["invoicePrefix", "paymentTermsDays", "taxName", "taxRate"],
];

export function OnboardingWizard({ userName }: { userName: string }) {
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingInput, unknown, ReturnType<typeof onboardingSchema.parse>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: "", currency: "USD", invoicePrefix: "INV-", paymentTermsDays: "14", taxName: "", taxRate: "" },
  });

  async function next() {
    if (await form.trigger(STEP_FIELDS[0])) setStep(1);
  }

  const submit = form.handleSubmit((_, e) => {
    e?.preventDefault();
    setError(null);
    start(async () => {
      const res = await createWorkspaceAction(form.getValues());
      if (res && !res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        // Jump back to the step that owns the first server error.
        const first = Object.keys(res.fieldErrors ?? {})[0] as keyof OnboardingInput | undefined;
        if (first && STEP_FIELDS[0].includes(first)) setStep(0);
      }
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {userName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two quick steps and you&apos;re ready to send your first invoice.</p>
      </div>

      <ol className="flex items-center gap-3" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2">
            <span
              className={
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                (i < step ? "bg-success text-success-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
              }
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={"text-sm " + (i === step ? "font-medium" : "text-muted-foreground")}>{s.title}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={
              step === 0
                ? (e) => {
                    e.preventDefault();
                    void next();
                  }
                : submit
            }
            noValidate
            className="space-y-5"
          >
            <FormError message={error} />
            {step === 0 ? (
              <FieldGroup>
                <TextField control={form.control} name="name" label="Business name" placeholder="Northwind Studio" autoFocus />
                <SelectField
                  control={form.control}
                  name="currency"
                  label="Currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </FieldGroup>
            ) : (
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField control={form.control} name="invoicePrefix" label="Invoice prefix" placeholder="INV-" description="e.g. INV-0001" />
                  <TextField
                    control={form.control}
                    name="paymentTermsDays"
                    label="Payment terms (days)"
                    inputMode="numeric"
                    description="Due date = issue date + days"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField control={form.control} name="taxName" label="Default tax name" placeholder="Sales tax (optional)" />
                  <TextField control={form.control} name="taxRate" label="Tax rate (%)" inputMode="decimal" placeholder="0" />
                </div>
              </FieldGroup>
            )}

            <div className="flex items-center justify-between pt-1">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft /> Back
                </Button>
              ) : (
                <span />
              )}
              {step === 0 ? (
                <Button type="button" onClick={next}>
                  Continue <ArrowRight />
                </Button>
              ) : (
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating workspace…" : "Create workspace"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
