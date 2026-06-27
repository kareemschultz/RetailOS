import { Button } from "@RetailOS/ui/components/button";
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
import { Tabs, TabsList, TabsTrigger } from "@RetailOS/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { formatMoney, minorToAmountString } from "@/lib/format";
import { orpc } from "@/utils/orpc";

import { ErrorState } from "../states";
import type { CreateSaleResult, SaleQuote } from "./types";
import type { SaleLineInput } from "./use-cart";

// MSP tender methods. Stored-value tenders (store_credit / gift_card) are
// reserved + rejected by the backend in this slice, so the picker omits them.
// TODO: import the shared TENDER_METHODS constant once it is exported from the
// schema/constants package (locked decision: static enum, no runtime endpoint).
const POS_TENDER_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Transfer" },
  { value: "mobile_money", label: "Mobile" },
  { value: "cheque", label: "Cheque" },
] as const;

type TenderMethod = (typeof POS_TENDER_METHODS)[number]["value"];

// Parse a cashier-entered major-unit amount into minor units. This is INPUT
// PARSING (text -> integer minor units), not business math: the settlement
// (change, balance due, settleable) is computed by the backend re-quote below,
// never here.
function toMinor(amountText: string, scale: number): number {
  const value = Number.parseFloat(amountText);
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 10 ** scale);
}

export function TenderDialog({
  open,
  onOpenChange,
  quote,
  lines,
  locationId,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: SaleQuote;
  lines: SaleLineInput[];
  locationId: string;
  onPaid: (result: CreateSaleResult) => void;
}) {
  const amountFieldId = useId();
  const [method, setMethod] = useState<TenderMethod>("cash");
  const [amountText, setAmountText] = useState("");
  // ONE idempotency key per checkout ATTEMPT, minted when the dialog opens and
  // reused for every retry of THIS sale — so a double-click or a retry after a
  // lost response collapses to a SINGLE sale on the backend (Codex HIGH). A new
  // dialog-open is a new logical sale and gets a new key.
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Default the amount to the exact total (a single DTO value) when the dialog
  // opens, so non-cash methods are one tap and cash starts at exact.
  useEffect(() => {
    if (open) {
      setAmountText(minorToAmountString(quote.totals.totalMinor, quote.scale));
      setMethod("cash");
    }
  }, [open, quote.totals.totalMinor, quote.scale]);

  // Mint a fresh idempotency key on each open (client-only; no SSR mismatch).
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  const amountMinor = toMinor(amountText, quote.scale);
  const tenders =
    amountMinor > 0
      ? [{ method, currency: quote.currency, amountMinor }]
      : undefined;

  // Re-quote WITH the tender so the backend tells us change / balance due /
  // settleable. The frontend never computes settlement.
  const settlement = useQuery(
    orpc.pos.quote.queryOptions({
      input: { locationId, lines, tenders },
      enabled: open && tenders != null,
    })
  );

  const saleMutation = useMutation(orpc.pos.createSale.mutationOptions());

  const payments = settlement.data?.payments;
  const settleable = payments?.settleable ?? false;

  function pay() {
    // Guard against double-submission: no tender/unsettleable, an in-flight
    // sale, or a not-yet-minted key all short-circuit. The stable key is the
    // real protection (the backend collapses a duplicate); this is belt-and-braces.
    if (!(tenders && settleable) || saleMutation.isPending || !idempotencyKey) {
      return;
    }
    saleMutation.mutate(
      {
        locationId,
        idempotencyKey,
        lines,
        tenders,
      },
      { onSuccess: (result) => onPaid(result) }
    );
  }

  const money = (minor: number) =>
    formatMoney(minor, quote.currency, quote.scale);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Total due {money(quote.totals.totalMinor)}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          onValueChange={(v) => setMethod(v as TenderMethod)}
          value={method}
        >
          <TabsList className="grid w-full grid-cols-5">
            {POS_TENDER_METHODS.map((tender) => (
              <TabsTrigger key={tender.value} value={tender.value}>
                {tender.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2">
          <Label htmlFor={amountFieldId}>Amount tendered</Label>
          <Input
            className="h-12 font-mono text-lg tabular-nums"
            id={amountFieldId}
            inputMode="decimal"
            onChange={(event) => setAmountText(event.target.value)}
            value={amountText}
          />
        </div>

        {settlement.isError ? (
          <ErrorState
            message="Could not validate this payment."
            onRetry={() => settlement.refetch()}
          />
        ) : (
          <dl className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-3 text-sm">
            <SummaryRow label="Tendered">
              {payments ? money(payments.summary.tenderedMinor) : "—"}
            </SummaryRow>
            <SummaryRow label="Balance due">
              {payments ? money(payments.summary.balanceDueMinor) : "—"}
            </SummaryRow>
            <SummaryRow accent label="Change">
              {payments ? money(payments.summary.changeMinor) : "—"}
            </SummaryRow>
            {payments && !payments.settleable && payments.settlementError ? (
              <p className="text-destructive text-xs">
                {payments.settlementError}
              </p>
            ) : null}
          </dl>
        )}

        {saleMutation.isError ? (
          <p className="text-destructive text-sm">
            Sale failed: {saleMutation.error.message}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            className="h-12 w-full text-base"
            disabled={!settleable || saleMutation.isPending}
            onClick={pay}
            size="lg"
          >
            {saleMutation.isPending ? "Completing…" : "Complete sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          accent
            ? "font-mono font-semibold tabular-nums"
            : "font-mono tabular-nums"
        }
      >
        {children}
      </dd>
    </div>
  );
}
