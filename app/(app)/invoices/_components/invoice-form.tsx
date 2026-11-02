"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
import { Money } from "@/components/app/money";
import { applyServerErrors, FormError, SelectField, TextareaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcInvoiceTotals, formatBps, parseMoneyToCents, parsePercentToBps, parseQuantity } from "@/lib/money";
import { invoiceSchema, type InvoiceInput, type InvoiceValues } from "@/lib/validation";
import { createInvoiceAction, updateInvoiceAction } from "../actions";

export type ClientOption = { id: string; name: string; company: string | null };
export type TaxOption = { id: string; name: string; rateBps: number };

const CUSTOM_TAX = "__custom";
const NO_TAX = "__none";

export function InvoiceForm({
  mode,
  invoiceId,
  initial,
  clients: initialClients,
  taxes,
  currency,
  termsDays,
  invoiceNumber,
  isDraft,
}: {
  mode: "create" | "edit";
  invoiceId?: string;
  initial: InvoiceInput;
  clients: ClientOption[];
  taxes: TaxOption[];
  currency: string;
  /** Workspace default payment terms, used to auto-fill the due date. */
  termsDays: number;
  /** Shown in the header when editing. */
  invoiceNumber?: string;
  /** In edit mode: whether the invoice is still a draft (offers "Save & send"). */
  isDraft?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState(initialClients);
  const [clientDialog, setClientDialog] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const dueTouched = useRef(mode === "edit");

  const taxOptions = useMemo(
    () => [
      { value: NO_TAX, label: "No tax" },
      ...taxes.map((t) => ({ value: t.id, label: `${t.name} (${formatBps(t.rateBps)})` })),
      { value: CUSTOM_TAX, label: "Custom…" },
    ],
    [taxes],
  );
  const [taxPreset, setTaxPreset] = useState<string>(() => {
    const rate = parsePercentToBps(initial.taxRate) ?? 0;
    if (rate === 0) return NO_TAX;
    const m = taxes.find((t) => t.name === initial.taxName && t.rateBps === rate);
    return m ? m.id : CUSTOM_TAX;
  });

  const form = useForm<InvoiceInput, unknown, InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initial,
  });
  const { control, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watched = useWatch({ control });
  const totals = useMemo(
    () =>
      calcInvoiceTotals({
        items: (watched.items ?? []).map((i) => ({
          quantity: parseQuantity(i?.quantity) ?? 0,
          rateCents: parseMoneyToCents(i?.rate) ?? 0,
        })),
        discountType: watched.discountType ?? "percent",
        discountValue:
          (watched.discountType === "fixed" ? parseMoneyToCents(watched.discountValue) : parsePercentToBps(watched.discountValue)) ?? 0,
        taxRateBps: parsePercentToBps(watched.taxRate) ?? 0,
      }),
    [watched],
  );

  const clientId = watched.clientId;
  const selectedClient = clients.find((c) => c.id === clientId);

  function submit(intent: "draft" | "send") {
    return form.handleSubmit(() => {
      setFormError(null);
      start(async () => {
        const values = getValues();
        const res = mode === "create" ? await createInvoiceAction(values, intent) : await updateInvoiceAction(invoiceId!, values, intent);
        if (!res.ok) {
          setFormError(res.error ?? null);
          applyServerErrors(form.setError, res);
          return;
        }
        toast.success(mode === "create" ? (intent === "send" ? "Invoice created and marked as sent" : "Draft saved") : "Invoice updated");
        router.push(`/invoices/${res.id}`);
      });
    });
  }

  /** Keep due date = issue date + payment terms until the user sets a due date themselves. */
  function onIssueDateChange(value: string) {
    if (dueTouched.current || !value) return;
    const issued = parseISO(value);
    if (Number.isNaN(issued.getTime())) return;
    setValue("dueDate", format(addDays(issued, termsDays), "yyyy-MM-dd"), { shouldDirty: true });
  }

  return (
    <form onSubmit={submit(mode === "create" ? "draft" : isDraft ? "draft" : "send")} noValidate className="space-y-6">
      <FormError message={formError} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Client + dates */}
          <Card>
            <CardHeader>
              <CardTitle>{mode === "edit" && invoiceNumber ? `Edit ${invoiceNumber}` : "Invoice details"}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="f-clientId">Client</FieldLabel>
                      <Popover open={clientPicker} onOpenChange={setClientPicker}>
                        <PopoverTrigger
                          render={
                            <Button
                              id="f-clientId"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-invalid={fieldState.invalid}
                              className="h-9 w-full justify-between font-normal"
                            />
                          }
                        >
                          {selectedClient ? (
                            <span className="truncate">
                              {selectedClient.name}
                              {selectedClient.company ? <span className="text-muted-foreground"> · {selectedClient.company}</span> : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select a client…</span>
                          )}
                          <ChevronsUpDown className="opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[--anchor-width] min-w-72 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search clients…" />
                            <CommandList>
                              <CommandEmpty>No clients found.</CommandEmpty>
                              <CommandGroup>
                                {clients.map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={`${c.name} ${c.company ?? ""}`}
                                    onSelect={() => {
                                      field.onChange(c.id);
                                      setClientPicker(false);
                                    }}
                                  >
                                    <Check className={field.value === c.id ? "opacity-100" : "opacity-0"} />
                                    <span>{c.name}</span>
                                    {c.company && <span className="text-muted-foreground">· {c.company}</span>}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandGroup>
                                <CommandItem
                                  value="__new-client"
                                  onSelect={() => {
                                    setClientPicker(false);
                                    setClientDialog(true);
                                  }}
                                >
                                  <UserPlus /> New client…
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="issueDate"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="f-issueDate">Issue date</FieldLabel>
                        <Input
                          {...field}
                          id="f-issueDate"
                          type="date"
                          aria-invalid={fieldState.invalid}
                          onChange={(e) => {
                            field.onChange(e);
                            onIssueDateChange(e.target.value);
                          }}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    control={control}
                    name="dueDate"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="f-dueDate">Due date</FieldLabel>
                        <Input
                          {...field}
                          id="f-dueDate"
                          type="date"
                          aria-invalid={fieldState.invalid}
                          onChange={(e) => {
                            dueTouched.current = true;
                            field.onChange(e);
                          }}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden grid-cols-[1fr_88px_120px_110px_36px] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Description</span>
                <span>Qty</span>
                <span>Rate</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              {fields.map((f, index) => (
                <div
                  key={f.id}
                  className="grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-[1fr_88px_120px_110px_36px] md:items-start md:border-0 md:p-0"
                >
                  <TextField
                    control={control}
                    name={`items.${index}.description`}
                    placeholder="Description of work or product"
                    className="col-span-2 md:col-span-1"
                  />
                  <TextField control={control} name={`items.${index}.quantity`} inputMode="decimal" placeholder="1" />
                  <TextField control={control} name={`items.${index}.rate`} inputMode="decimal" placeholder="0.00" />
                  <div className="flex h-8 items-center justify-end">
                    <Money cents={totals.lineAmounts[index] ?? 0} currency={currency} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    className="justify-self-end"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {(form.formState.errors.items?.root?.message || form.formState.errors.items?.message) && (
                <FieldError>{form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message}</FieldError>
              )}
              <Button type="button" variant="outline" onClick={() => append({ description: "", quantity: "1", rate: "" })}>
                <Plus /> Add line item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes &amp; terms</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <TextareaField control={control} name="notes" label="Notes to client" placeholder="Thank you for your business." />
                <TextareaField control={control} name="terms" label="Payment terms" placeholder="Payment due within 14 days. Bank transfer preferred." />
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldGroup>
                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <TextField
                    control={control}
                    name="discountValue"
                    label="Discount"
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <SelectField
                    control={control}
                    name="discountType"
                    label=" "
                    options={[
                      { value: "percent", label: "%" },
                      { value: "fixed", label: currency },
                    ]}
                  />
                </div>

                <Field>
                  <FieldLabel htmlFor="tax-preset">Tax</FieldLabel>
                  <Select
                    items={taxOptions}
                    value={taxPreset}
                    onValueChange={(v) => {
                      const next = v ?? NO_TAX;
                      setTaxPreset(next);
                      if (next === NO_TAX) {
                        setValue("taxName", "", { shouldDirty: true });
                        setValue("taxRate", "", { shouldDirty: true });
                      } else if (next !== CUSTOM_TAX) {
                        const t = taxes.find((x) => x.id === next)!;
                        setValue("taxName", t.name, { shouldDirty: true });
                        setValue("taxRate", String(t.rateBps / 100), { shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger id="tax-preset" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {taxPreset === CUSTOM_TAX && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField control={control} name="taxName" label="Tax name" placeholder="VAT" />
                    <TextField control={control} name="taxRate" label="Rate (%)" inputMode="decimal" placeholder="0" />
                  </div>
                )}
              </FieldGroup>

              <dl className="space-y-2 border-t pt-4 text-sm">
                <Line label="Subtotal" cents={totals.subtotalCents} currency={currency} />
                {totals.discountCents > 0 && <Line label="Discount" cents={-totals.discountCents} currency={currency} />}
                {(parsePercentToBps(watched.taxRate) ?? 0) > 0 && (
                  <Line
                    label={`${watched.taxName || "Tax"} (${formatBps(parsePercentToBps(watched.taxRate) ?? 0)})`}
                    cents={totals.taxCents}
                    currency={currency}
                  />
                )}
                <div className="flex items-baseline justify-between border-t pt-3">
                  <dt className="font-medium">Total due</dt>
                  <dd>
                    <Money cents={totals.totalCents} currency={currency} size="xl" />
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2">
                {mode === "create" ? (
                  <>
                    <Button type="button" disabled={pending} onClick={submit("send")}>
                      {pending ? "Saving…" : "Save & mark as sent"}
                    </Button>
                    <Button type="button" variant="outline" disabled={pending} onClick={submit("draft")}>
                      Save as draft
                    </Button>
                  </>
                ) : isDraft ? (
                  <>
                    <Button type="button" disabled={pending} onClick={submit("send")}>
                      {pending ? "Saving…" : "Save & mark as sent"}
                    </Button>
                    <Button type="button" variant="outline" disabled={pending} onClick={submit("draft")}>
                      Save draft
                    </Button>
                  </>
                ) : (
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save changes"}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ClientFormDialog
        open={clientDialog}
        onOpenChange={setClientDialog}
        onSaved={(c) => {
          setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
          setValue("clientId", c.id, { shouldDirty: true, shouldValidate: true });
        }}
      />
    </form>
  );
}

function Line({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money cents={cents} currency={currency} />
      </dd>
    </div>
  );
}
