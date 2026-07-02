import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, TriangleAlert, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/staff")({
  component: StaffScreen,
});

type StaffRole =
  | "tenant_admin"
  | "manager"
  | "warehouse"
  | "bond_officer"
  | "cashier";

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Administrator",
  manager: "Manager",
  warehouse: "Warehouse",
  bond_officer: "Bond officer",
  cashier: "Cashier",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  tenant_admin:
    "Full access — setup, staff, tax, audit trail, and every operation.",
  manager: "Runs the floor — catalog, inventory, POS including refunds/voids.",
  warehouse: "Moves stock — receiving, transfers, counts. No POS, no finance.",
  bond_officer: "Customs clearance — bonded receiving and duty release only.",
  cashier: "Rings sales and works a drawer. Nothing else.",
};

const ROLE_OPTIONS: Array<{ label: string; value: StaffRole }> = [
  { label: "Administrator", value: "tenant_admin" },
  { label: "Manager", value: "manager" },
  { label: "Warehouse", value: "warehouse" },
  { label: "Bond officer", value: "bond_officer" },
  { label: "Cashier", value: "cashier" },
];

const SKELETON_KEYS = ["a", "b", "c", "d"] as const;

interface MemberRow {
  createdAt: string | Date;
  email: string;
  id: string;
  name: string;
  role: string;
  userId: string;
}

function GrantDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { email: string; role: StaffRole }) => Promise<void>;
  open: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give someone access</DialogTitle>
          <DialogDescription>
            They must sign up for a RetailOS account first (Google or email) —
            then enter the same email here and pick their role.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({ email: email.trim().toLowerCase(), role });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="grant-email">Email</Label>
            <Input
              autoFocus
              id="grant-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@business.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              onValueChange={(value) =>
                setRole((value ?? "cashier") as StaffRole)
              }
              value={role}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Granting…" : "Grant access"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({
  isSaving,
  member,
  onOpenChange,
  onSubmit,
  open,
}: {
  isSaving: boolean;
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  onSubmit: (role: StaffRole) => Promise<void>;
  open: boolean;
}) {
  const [role, setRole] = useState<StaffRole>(
    (member.role as StaffRole) ?? "cashier"
  );
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {member.name} ({member.email})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select
              onValueChange={(value) =>
                setRole((value ?? "cashier") as StaffRole)
              }
              value={role}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} onClick={() => onSubmit(role)}>
              {isSaving ? "Saving…" : "Save role"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  isSaving,
  member,
  onConfirm,
  onOpenChange,
  open,
}: {
  isSaving: boolean;
  member: MemberRow;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove access?</DialogTitle>
          <DialogDescription>
            {member.name} ({member.email}) will immediately lose all access to
            this business. Their account is not deleted — you can grant access
            again later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Keep access
          </Button>
          <Button disabled={isSaving} onClick={onConfirm} variant="destructive">
            {isSaving ? "Removing…" : "Remove access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersContent({
  errorMessage,
  isError,
  isLoading,
  onChangeRole,
  onRevoke,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onChangeRole: (row: MemberRow) => void;
  onRevoke: (row: MemberRow) => void;
  rows: MemberRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load staff</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "You need administrator access to manage staff."}
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-14 rounded-none" key={k} />
        ))}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Person</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Since</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{member.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {member.email}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  member.role === "tenant_admin" ? "default" : "secondary"
                }
              >
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(member.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onChangeRole(member)}
                  size="sm"
                  variant="outline"
                >
                  Change role
                </Button>
                <Button
                  onClick={() => onRevoke(member)}
                  size="sm"
                  variant="destructive"
                >
                  Remove
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RolesMatrix() {
  const roles = useQuery(orpc.membership.roles.queryOptions({ input: {} }));
  if (roles.isLoading) {
    return <Skeleton className="h-64 rounded-lg" />;
  }
  if (roles.isError) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        {roles.error?.message ?? "Couldn’t load the role matrix."}
      </p>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(roles.data ?? []).map((role) => (
        <div className="rounded-xl border p-4" key={role.role}>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <p className="font-medium">{ROLE_LABELS[role.role] ?? role.role}</p>
            <Badge variant="outline">
              {role.permissions.length} permission
              {role.permissions.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mb-3 text-muted-foreground text-sm">
            {ROLE_DESCRIPTIONS[role.role]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {role.permissions.map((permission) => (
              <Badge key={permission} variant="secondary">
                <span className="font-mono text-[11px]">{permission}</span>
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffScreen() {
  const [grantOpen, setGrantOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<MemberRow | undefined>();
  const [revokeTarget, setRevokeTarget] = useState<MemberRow | undefined>();

  const members = useQuery(orpc.membership.list.queryOptions({ input: {} }));
  const grant = useMutation(orpc.membership.grant.mutationOptions());
  const updateRole = useMutation(orpc.membership.updateRole.mutationOptions());
  const revoke = useMutation(orpc.membership.revoke.mutationOptions());

  const rows = (members.data ?? []) as MemberRow[];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Staff &amp; access
        </h1>
        <p className="text-muted-foreground">
          Who can sign in to this business and what each role lets them do. The
          backend enforces every permission — this page controls the grants.
        </p>
      </div>
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck className="size-4" />
            Roles &amp; permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <DataTableCard
            actions={
              <Button onClick={() => setGrantOpen(true)}>
                <UserPlus className="size-4" />
                Give access
              </Button>
            }
            count={members.isSuccess ? rows.length : undefined}
            title="Members"
          >
            <MembersContent
              errorMessage={members.error?.message}
              isError={members.isError}
              isLoading={members.isLoading}
              onChangeRole={setRoleTarget}
              onRevoke={setRevokeTarget}
              rows={rows}
            />
          </DataTableCard>
        </TabsContent>
        <TabsContent value="roles">
          <RolesMatrix />
        </TabsContent>
      </Tabs>

      {grantOpen ? (
        <GrantDialog
          isSaving={grant.isPending}
          onOpenChange={setGrantOpen}
          onSubmit={async (values) => {
            try {
              await grant.mutateAsync(values);
              toast.success("Access granted");
              setGrantOpen(false);
              await members.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not grant access."
              );
            }
          }}
          open={grantOpen}
        />
      ) : null}

      {roleTarget ? (
        <RoleDialog
          isSaving={updateRole.isPending}
          key={roleTarget.id}
          member={roleTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRoleTarget(undefined);
            }
          }}
          onSubmit={async (role) => {
            try {
              await updateRole.mutateAsync({
                membershipId: roleTarget.id,
                role,
              });
              toast.success("Role updated");
              setRoleTarget(undefined);
              await members.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not update role."
              );
            }
          }}
          open={Boolean(roleTarget)}
        />
      ) : null}

      {revokeTarget ? (
        <RevokeDialog
          isSaving={revoke.isPending}
          key={revokeTarget.id}
          member={revokeTarget}
          onConfirm={async () => {
            try {
              await revoke.mutateAsync({ membershipId: revokeTarget.id });
              toast.success("Access removed");
              setRevokeTarget(undefined);
              await members.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not remove access."
              );
            }
          }}
          onOpenChange={(open) => {
            if (!open) {
              setRevokeTarget(undefined);
            }
          }}
          open={Boolean(revokeTarget)}
        />
      ) : null}
    </div>
  );
}
