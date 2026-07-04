import type { AppRouterClient } from "@RetailOS/api/routers/index";
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
import {
  BookOpen,
  CalendarRange,
  Landmark,
  Lock,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/financials")({
  component: FinancialsScreen,
});

type AccountingClient = AppRouterClient["accounting"];
type LedgerAccountRow = Awaited<
  ReturnType<AccountingClient["ledgerAccountList"]>
>[number];
type PostingPeriodRow = Awaited<
  ReturnType<AccountingClient["postingPeriodList"]>
>[number];
type JournalRow = Awaited<ReturnType<AccountingClient["journalList"]>>[number];
type JournalDetail = Awaited<ReturnType<AccountingClient["journalDetail"]>>;

const SKELETON_KEYS = ["a", "b", "c"] as const;
const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

// Posting-period bounds are DATE-ONLY columns (no time, no zone). They arrive
// as UTC-midnight instants, so a local-time render in any zone west of UTC
// (Guyana is UTC-4) would show the PREVIOUS day — "July 1" becoming "Jun 30".
// Rendering in UTC keeps the calendar date the user actually entered.
function formatDateOnly(value: Date | string | null): string {
  return value
    ? new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
    : "—";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ── Chart of accounts ────────────────────────────────────────────────────

function ChartOfAccountsTable({ rows }: { rows: LedgerAccountRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Normal balance</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.code}</TableCell>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {capitalize(row.type)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {capitalize(row.normalBalance)}
            </TableCell>
            <TableCell>
              <Badge
                variant={row.status === "active" ? "outline" : "secondary"}
              >
                {capitalize(row.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateLedgerAccountDialog({
  onCreated,
  onOpenChange,
}: {
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const codeFieldId = useId();
  const nameFieldId = useId();
  const typeFieldId = useId();
  const balanceFieldId = useId();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("asset");
  const [normalBalance, setNormalBalance] = useState<string>("debit");
  const createAccount = useMutation(
    orpc.accounting.ledgerAccountCreate.mutationOptions()
  );

  async function submit() {
    if (!(code.trim() && name.trim())) {
      toast.error("Code and name are required.");
      return;
    }
    try {
      await createAccount.mutateAsync({
        code: code.trim(),
        name: name.trim(),
        normalBalance: normalBalance as "credit" | "debit",
        type: type as (typeof ACCOUNT_TYPES)[number],
      });
      toast.success("Ledger account created");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create account."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New ledger account</DialogTitle>
          <DialogDescription>
            Chart-of-accounts entries are the debit/credit targets for journal
            lines.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={codeFieldId}>Code</Label>
            <Input
              id={codeFieldId}
              onChange={(event) => setCode(event.target.value)}
              placeholder="1000"
              value={code}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={nameFieldId}>Name</Label>
            <Input
              id={nameFieldId}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cash"
              value={name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={typeFieldId}>Type</Label>
              <Select
                onValueChange={(next) => setType(next ?? "asset")}
                value={type}
              >
                <SelectTrigger className="w-full" id={typeFieldId}>
                  {/* Render the human label, not the raw stored value — the
                      trigger otherwise shows lowercase "asset" until the
                      option list has mounted. */}
                  <SelectValue>
                    {(value: string | null) => capitalize(value ?? "asset")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((accountType) => (
                    <SelectItem key={accountType} value={accountType}>
                      {capitalize(accountType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={balanceFieldId}>Normal balance</Label>
              <Select
                onValueChange={(next) => setNormalBalance(next ?? "debit")}
                value={normalBalance}
              >
                <SelectTrigger className="w-full" id={balanceFieldId}>
                  <SelectValue>
                    {(value: string | null) => capitalize(value ?? "debit")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createAccount.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createAccount.isPending} onClick={submit}>
            {createAccount.isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChartOfAccountsPanel() {
  const [createOpen, setCreateOpen] = useState(false);
  const accounts = useQuery(
    orpc.accounting.ledgerAccountList.queryOptions({ input: {} })
  );
  const rows = accounts.data ?? [];
  const settled = !(accounts.isLoading || accounts.isError);

  return (
    <>
      <DataTableCard
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New account
          </Button>
        }
        count={settled ? rows.length : undefined}
        title="Chart of accounts"
      >
        {accounts.isError ? (
          <div className="p-4">
            <ErrorState
              message={accounts.error?.message ?? "Could not load accounts."}
              onRetry={() => accounts.refetch()}
            />
          </div>
        ) : null}
        {!accounts.isError && accounts.isLoading ? (
          <div className="flex flex-col gap-px">
            {SKELETON_KEYS.map((key) => (
              <Skeleton className="h-[52px] rounded-none" key={key} />
            ))}
          </div>
        ) : null}
        {!(accounts.isError || accounts.isLoading) && rows.length === 0 ? (
          <EmptyState
            description="Add accounts (Cash, Sales Revenue, COGS…) before posting journals."
            icon={BookOpen}
            title="No ledger accounts yet"
          />
        ) : null}
        {!(accounts.isError || accounts.isLoading) && rows.length > 0 ? (
          <ChartOfAccountsTable rows={rows} />
        ) : null}
      </DataTableCard>
      {createOpen ? (
        <CreateLedgerAccountDialog
          onCreated={async () => {
            await accounts.refetch();
          }}
          onOpenChange={setCreateOpen}
        />
      ) : null}
    </>
  );
}

// ── Posting periods ──────────────────────────────────────────────────────

function CreatePostingPeriodDialog({
  onCreated,
  onOpenChange,
}: {
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const nameFieldId = useId();
  const startFieldId = useId();
  const endFieldId = useId();
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const createPeriod = useMutation(
    orpc.accounting.postingPeriodCreate.mutationOptions()
  );

  async function submit() {
    if (!(name.trim() && startsOn && endsOn)) {
      toast.error("Name, start date, and end date are required.");
      return;
    }
    try {
      await createPeriod.mutateAsync({
        endsOn: new Date(endsOn),
        name: name.trim(),
        startsOn: new Date(startsOn),
      });
      toast.success("Posting period created");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create period."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New posting period</DialogTitle>
          <DialogDescription>
            Journals can only post while their period is open.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={nameFieldId}>Name</Label>
            <Input
              id={nameFieldId}
              onChange={(event) => setName(event.target.value)}
              placeholder="2026-07"
              value={name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={startFieldId}>Starts on</Label>
              <Input
                id={startFieldId}
                onChange={(event) => setStartsOn(event.target.value)}
                type="date"
                value={startsOn}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={endFieldId}>Ends on</Label>
              <Input
                id={endFieldId}
                onChange={(event) => setEndsOn(event.target.value)}
                type="date"
                value={endsOn}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createPeriod.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createPeriod.isPending} onClick={submit}>
            {createPeriod.isPending ? "Creating…" : "Create period"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostingPeriodsTable({
  onClose,
  rows,
}: {
  onClose: (id: string) => void;
  rows: PostingPeriodRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Starts</TableHead>
          <TableHead>Ends</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateOnly(row.startsOn)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateOnly(row.endsOn)}
            </TableCell>
            <TableCell>
              <Badge variant={row.status === "open" ? "outline" : "secondary"}>
                {capitalize(row.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {row.status === "open" ? (
                <Button
                  onClick={() => onClose(row.id)}
                  size="sm"
                  variant="outline"
                >
                  <Lock className="size-4" />
                  Close
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PostingPeriodsPanel() {
  const [createOpen, setCreateOpen] = useState(false);
  const periods = useQuery(
    orpc.accounting.postingPeriodList.queryOptions({ input: {} })
  );
  const closePeriod = useMutation(
    orpc.accounting.postingPeriodClose.mutationOptions()
  );
  const rows = periods.data ?? [];
  const settled = !(periods.isLoading || periods.isError);

  async function handleClose(id: string) {
    try {
      await closePeriod.mutateAsync({ postingPeriodId: id });
      toast.success("Posting period closed");
      await periods.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not close period."
      );
    }
  }

  return (
    <>
      <DataTableCard
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New period
          </Button>
        }
        count={settled ? rows.length : undefined}
        title="Posting periods"
      >
        {periods.isError ? (
          <div className="p-4">
            <ErrorState
              message={periods.error?.message ?? "Could not load periods."}
              onRetry={() => periods.refetch()}
            />
          </div>
        ) : null}
        {!periods.isError && periods.isLoading ? (
          <div className="flex flex-col gap-px">
            {SKELETON_KEYS.map((key) => (
              <Skeleton className="h-[52px] rounded-none" key={key} />
            ))}
          </div>
        ) : null}
        {!(periods.isError || periods.isLoading) && rows.length === 0 ? (
          <EmptyState
            description="Create a posting period before drafting journals."
            icon={CalendarRange}
            title="No posting periods yet"
          />
        ) : null}
        {!(periods.isError || periods.isLoading) && rows.length > 0 ? (
          <PostingPeriodsTable onClose={handleClose} rows={rows} />
        ) : null}
      </DataTableCard>
      {createOpen ? (
        <CreatePostingPeriodDialog
          onCreated={async () => {
            await periods.refetch();
          }}
          onOpenChange={setCreateOpen}
        />
      ) : null}
    </>
  );
}

// ── Journals ─────────────────────────────────────────────────────────────

interface DraftJournalLine {
  accountId: string;
  amount: string;
  key: string;
  side: "debit" | "credit";
}

function CreateJournalDialog({
  accounts,
  onCreated,
  onOpenChange,
  periods,
}: {
  accounts: LedgerAccountRow[];
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  periods: PostingPeriodRow[];
}) {
  const periodFieldId = useId();
  const memoFieldId = useId();
  const currencyFieldId = useId();
  const [postingPeriodId, setPostingPeriodId] = useState("");
  const [memo, setMemo] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lines, setLines] = useState<DraftJournalLine[]>([
    { accountId: "", amount: "0.00", key: crypto.randomUUID(), side: "debit" },
    { accountId: "", amount: "0.00", key: crypto.randomUUID(), side: "credit" },
  ]);
  const createJournal = useMutation(
    orpc.accounting.journalCreateDraft.mutationOptions()
  );

  function updateLine(key: string, patch: Partial<DraftJournalLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  async function submit() {
    if (!postingPeriodId) {
      toast.error("Pick a posting period.");
      return;
    }
    const built = lines
      .filter((line) => line.accountId)
      .map((line) => {
        const amountMinor = Math.round(Number.parseFloat(line.amount) * 100);
        return {
          accountId: line.accountId,
          creditMinor: line.side === "credit" ? amountMinor : undefined,
          currency,
          debitMinor: line.side === "debit" ? amountMinor : undefined,
        };
      })
      .filter(
        (line) =>
          Number.isInteger(line.debitMinor ?? line.creditMinor ?? 0) &&
          (line.debitMinor ?? line.creditMinor ?? 0) > 0
      );
    if (built.length < 2) {
      toast.error(
        "A journal needs at least two lines with an account and amount."
      );
      return;
    }
    try {
      await createJournal.mutateAsync({
        lines: built,
        memo: memo.trim() || undefined,
        postingPeriodId,
      });
      toast.success("Journal drafted");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create journal."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New manual journal</DialogTitle>
          <DialogDescription>
            Starts as a draft. Debits and credits must balance before posting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={periodFieldId}>Posting period</Label>
              <Select
                onValueChange={(next) => setPostingPeriodId(next ?? "")}
                value={postingPeriodId}
              >
                <SelectTrigger className="w-full" id={periodFieldId}>
                  <SelectValue placeholder="Pick a period" />
                </SelectTrigger>
                <SelectContent>
                  {periods
                    .filter((period) => period.status === "open")
                    .map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={currencyFieldId}>Currency</Label>
              <Input
                id={currencyFieldId}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                value={currency}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={memoFieldId}>Memo (optional)</Label>
            <Input
              id={memoFieldId}
              onChange={(event) => setMemo(event.target.value)}
              value={memo}
            />
          </div>
          <div className="grid gap-2 rounded-md border p-3">
            <p className="font-medium text-sm">Lines</p>
            {lines.map((line) => (
              <div
                className="grid grid-cols-[1fr_5rem_6rem_auto] items-center gap-2"
                key={line.key}
              >
                <Select
                  onValueChange={(next) =>
                    updateLine(line.key, { accountId: next ?? "" })
                  }
                  value={line.accountId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  onValueChange={(next) =>
                    updateLine(line.key, {
                      side: (next ?? "debit") as "debit" | "credit",
                    })
                  }
                  value={line.side}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) => capitalize(value ?? "debit")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="text-right"
                  min={0}
                  onChange={(event) =>
                    updateLine(line.key, { amount: event.target.value })
                  }
                  step="0.01"
                  type="number"
                  value={line.amount}
                />
                <Button
                  aria-label="Remove line"
                  disabled={lines.length <= 2}
                  onClick={() =>
                    setLines((prev) =>
                      prev.filter((entry) => entry.key !== line.key)
                    )
                  }
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              className="w-fit"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    accountId: "",
                    amount: "0.00",
                    key: crypto.randomUUID(),
                    side: "debit",
                  },
                ])
              }
              size="sm"
              variant="outline"
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createJournal.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createJournal.isPending} onClick={submit}>
            {createJournal.isPending ? "Creating…" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JournalsTable({
  onSelect,
  rows,
}: {
  onSelect: (id: string) => void;
  rows: JournalRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Memo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className="cursor-pointer"
            key={row.id}
            onClick={() => onSelect(row.id)}
          >
            <TableCell className="font-medium">
              {row.postingPeriodName}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {capitalize(row.source)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.memo ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant={row.status === "posted" ? "default" : "outline"}>
                {capitalize(row.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function JournalDetailBody({
  detail,
  isError,
  isLoading,
  onPost,
  posting,
}: {
  detail: JournalDetail | undefined;
  isError: boolean;
  isLoading: boolean;
  onPost: () => void;
  posting: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (isError || !detail) {
    return <ErrorState message="Could not load journal detail." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-sm">{detail.postingPeriodName}</span>
        <Badge variant={detail.status === "posted" ? "default" : "outline"}>
          {capitalize(detail.status)}
        </Badge>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-sm">
                  {line.accountCode} · {line.accountName}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.debitMinor > 0
                    ? formatMoney(line.debitMinor, line.currency, line.scale)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.creditMinor > 0
                    ? formatMoney(line.creditMinor, line.currency, line.scale)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {detail.status === "draft" ? (
        <div className="flex justify-end">
          <Button disabled={posting} onClick={onPost}>
            {posting ? "Posting…" : "Post journal"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function JournalsContent({
  errorMessage,
  hasAccounts,
  isError,
  isLoading,
  onRetry,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  hasAccounts: boolean;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  rows: JournalRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load journals."}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[52px] rounded-none" key={key} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description={
          hasAccounts
            ? "Create a manual journal to post a transaction."
            : "Add ledger accounts first, then draft a journal."
        }
        icon={ScrollText}
        title="No journals yet"
      />
    );
  }
  return <JournalsTable onSelect={onSelect} rows={rows} />;
}

function JournalsPanel({
  accounts,
  periods,
}: {
  accounts: LedgerAccountRow[];
  periods: PostingPeriodRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const journals = useQuery(
    orpc.accounting.journalList.queryOptions({ input: {} })
  );
  const detail = useQuery(
    orpc.accounting.journalDetail.queryOptions({
      enabled: selectedId != null,
      input: { journalId: selectedId ?? "" },
    })
  );
  const postJournal = useMutation(
    orpc.accounting.journalPost.mutationOptions()
  );

  const rows = journals.data ?? [];
  const settled = !(journals.isLoading || journals.isError);

  async function handlePost() {
    if (!selectedId) {
      return;
    }
    try {
      await postJournal.mutateAsync({ journalId: selectedId });
      toast.success("Journal posted");
      await Promise.all([journals.refetch(), detail.refetch()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post journal."
      );
    }
  }

  return (
    <>
      <DataTableCard
        actions={
          <Button
            disabled={accounts.length === 0 || periods.length === 0}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            New journal
          </Button>
        }
        count={settled ? rows.length : undefined}
        title="Journals"
      >
        <JournalsContent
          errorMessage={journals.error?.message}
          hasAccounts={accounts.length > 0}
          isError={journals.isError}
          isLoading={journals.isLoading}
          onRetry={() => journals.refetch()}
          onSelect={setSelectedId}
          rows={rows}
        />
      </DataTableCard>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId != null}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Journal detail</DialogTitle>
            <DialogDescription>Lines and posting status.</DialogDescription>
          </DialogHeader>
          <JournalDetailBody
            detail={detail.data}
            isError={detail.isError}
            isLoading={detail.isLoading}
            onPost={handlePost}
            posting={postJournal.isPending}
          />
        </DialogContent>
      </Dialog>

      {createOpen ? (
        <CreateJournalDialog
          accounts={accounts}
          onCreated={async () => {
            await journals.refetch();
          }}
          onOpenChange={setCreateOpen}
          periods={periods}
        />
      ) : null}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function FinancialsScreen() {
  const accounts = useQuery(
    orpc.accounting.ledgerAccountList.queryOptions({ input: {} })
  );
  const periods = useQuery(
    orpc.accounting.postingPeriodList.queryOptions({ input: {} })
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <Landmark className="size-6" />
          Financials
        </h1>
        <p className="text-muted-foreground">
          Chart of accounts, posting periods, and manual journals — the
          accounting foundation. Automatic event-driven posting (sales,
          payments, procurement) and financial statements (trial balance,
          P&amp;L, balance sheet) are not built yet.
        </p>
      </div>

      <Tabs defaultValue="journals">
        <TabsList>
          <TabsTrigger value="journals">
            <ScrollText className="size-4" />
            Journals
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <BookOpen className="size-4" />
            Chart of accounts
          </TabsTrigger>
          <TabsTrigger value="periods">
            <CalendarRange className="size-4" />
            Posting periods
          </TabsTrigger>
        </TabsList>
        <TabsContent value="journals">
          <JournalsPanel
            accounts={accounts.data ?? []}
            periods={periods.data ?? []}
          />
        </TabsContent>
        <TabsContent value="accounts">
          <ChartOfAccountsPanel />
        </TabsContent>
        <TabsContent value="periods">
          <PostingPeriodsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
