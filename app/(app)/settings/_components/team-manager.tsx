"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { applyServerErrors, FormError, SelectField, TextField } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteSchema, type InviteInput } from "@/lib/validation";
import { addMemberAction, removeMemberAction, updateMemberRoleAction } from "../actions";

type Member = { membershipId: string; userId: string; name: string; email: string; role: "owner" | "admin" };

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Finance / admin" },
];

function RoleSelect({ member, disabled }: { member: Member; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Select
      items={ROLES}
      value={member.role}
      disabled={disabled || pending}
      onValueChange={(v) =>
        v &&
        v !== member.role &&
        start(async () => {
          const res = await updateMemberRoleAction(member.membershipId, v as "owner" | "admin");
          if (res.ok) toast.success("Role updated");
          else toast.error(res.error ?? "Something went wrong");
        })
      }
    >
      <SelectTrigger className="w-40" size="sm" aria-label={`Role for ${member.name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddMemberDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults: InviteInput = { name: "", email: "", password: "", role: "admin" };
  const form = useForm<InviteInput, unknown, ReturnType<typeof inviteSchema.parse>>({ resolver: zodResolver(inviteSchema), defaultValues: defaults });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await addMemberAction(form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success("Team member added");
      setOpen(false);
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaults);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus /> Add team member
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Create their login with a temporary password and share it with them. If they already have a LedgerOS account, their existing password is kept.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" autoFocus />
            <TextField control={form.control} name="email" label="Email" type="email" inputMode="email" />
            <TextField control={form.control} name="password" label="Temporary password" type="password" autoComplete="new-password" description="At least 8 characters." />
            <SelectField control={form.control} name="role" label="Role" options={ROLES} />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamManager({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  return (
    <div className="max-w-2xl space-y-4">
      <ul className="divide-y rounded-lg border bg-card">
        {members.map((m) => (
          <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                {m.name}
                {m.userId === currentUserId && <Badge variant="secondary">You</Badge>}
              </p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>
            <div className="flex items-center gap-1">
              <RoleSelect member={m} disabled={false} />
              <ConfirmDelete
                label={`Remove ${m.name}`}
                title={`Remove ${m.name}?`}
                description="They'll lose access to this workspace immediately. Their past activity stays in the log."
                confirmLabel="Remove"
                successMessage="Team member removed"
                disabled={m.userId === currentUserId}
                onConfirm={() => removeMemberAction(m.membershipId)}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Owners</strong> manage the workspace, team and roles. <strong className="font-medium text-foreground">Finance / admin</strong> users create
        invoices, record payments and expenses, and manage taxes and categories.
      </p>
      <AddMemberDialog />
    </div>
  );
}
