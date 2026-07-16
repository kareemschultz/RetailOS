// Hire-purchase / layaway agreements — a core sales model for Guyanese
// appliance retail. A customer takes a big-ticket item on a deposit + monthly
// instalments, with a carrying charge on the financed balance. This mock is
// deterministic and built from the sample Everstock catalog + CRM customers so
// the preview shows believable, internally-consistent numbers.

export type PaymentStatus = "paid" | "due" | "upcoming" | "overdue";
export type AgreementStatus = "active" | "completed" | "overdue" | "defaulted";

export interface HirePurchasePayment {
  amountMinor: number;
  dueAt: string;
  number: number;
  paidAt?: string;
  status: PaymentStatus;
}

export interface HirePurchaseAgreement {
  balanceMinor: number;
  cashPriceMinor: number;
  currency: string;
  customerId: string;
  customerName: string;
  depositMinor: number;
  financeChargeMinor: number;
  financedMinor: number;
  id: string;
  monthlyPaymentMinor: number;
  paidToDateMinor: number;
  productName: string;
  productSku: string;
  reference: string;
  scale: number;
  schedule: HirePurchasePayment[];
  startAt: string;
  status: AgreementStatus;
  termMonths: number;
}

const CURRENCY = "GYD";
const SCALE = 2;
const MS_PER_DAY = 86_400_000;
// "Today" is pinned so the mock's overdue/upcoming split is stable in preview.
const TODAY = new Date("2026-07-10T00:00:00Z");

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface BuildInput {
  cashPriceMinor: number;
  // annual-equivalent carrying charge applied to the financed balance
  chargeRate: number;
  customerId: string;
  customerName: string;
  depositPct: number;
  id: string;
  // how many scheduled instalments the customer has actually paid
  paidCount: number;
  productName: string;
  productSku: string;
  ref: string;
  // months since the agreement started (drives how many are due/paid)
  startedMonthsAgo: number;
  termMonths: number;
}

function buildAgreement(input: BuildInput): HirePurchaseAgreement {
  const depositMinor = Math.round(input.cashPriceMinor * input.depositPct);
  const financedMinor = input.cashPriceMinor - depositMinor;
  const financeChargeMinor = Math.round(
    (financedMinor * input.chargeRate * input.termMonths) / 12
  );
  const totalInstalmentMinor = financedMinor + financeChargeMinor;
  const monthlyPaymentMinor = Math.round(
    totalInstalmentMinor / input.termMonths
  );

  const startAt = addMonths(TODAY, -input.startedMonthsAgo);
  const schedule: HirePurchasePayment[] = [];
  let paidToDateMinor = depositMinor;

  for (let i = 1; i <= input.termMonths; i++) {
    const dueDate = addMonths(startAt, i);
    // Last instalment absorbs any rounding remainder.
    const amountMinor =
      i === input.termMonths
        ? totalInstalmentMinor - monthlyPaymentMinor * (input.termMonths - 1)
        : monthlyPaymentMinor;

    let status: PaymentStatus;
    let paidAt: string | undefined;
    if (i <= input.paidCount) {
      status = "paid";
      paidAt = iso(dueDate);
      paidToDateMinor += amountMinor;
    } else if (dueDate.getTime() < TODAY.getTime()) {
      status = "overdue";
    } else if (dueDate.getTime() - TODAY.getTime() <= 31 * MS_PER_DAY) {
      status = "due";
    } else {
      status = "upcoming";
    }

    schedule.push({
      number: i,
      dueAt: iso(dueDate),
      amountMinor,
      status,
      ...(paidAt ? { paidAt } : {}),
    });
  }

  const totalPayableMinor = depositMinor + totalInstalmentMinor;
  const balanceMinor = totalPayableMinor - paidToDateMinor;
  const hasOverdue = schedule.some((p) => p.status === "overdue");
  let status: AgreementStatus;
  if (balanceMinor <= 0) {
    status = "completed";
  } else if (input.paidCount === 0 && input.startedMonthsAgo >= 3) {
    status = "defaulted";
  } else if (hasOverdue) {
    status = "overdue";
  } else {
    status = "active";
  }

  return {
    id: input.id,
    reference: input.ref,
    customerId: input.customerId,
    customerName: input.customerName,
    productName: input.productName,
    productSku: input.productSku,
    currency: CURRENCY,
    scale: SCALE,
    cashPriceMinor: input.cashPriceMinor,
    depositMinor,
    financedMinor,
    financeChargeMinor,
    monthlyPaymentMinor,
    termMonths: input.termMonths,
    paidToDateMinor,
    balanceMinor,
    startAt: iso(startAt),
    status,
    schedule,
  };
}

export const MOCK_HIRE_PURCHASE: HirePurchaseAgreement[] = [
  buildAgreement({
    id: "hp_01",
    ref: "HP-2026-014",
    customerId: "cus_02",
    customerName: "Marlon Persaud",
    productName: "SAMSUNG BESPOKE AI FRIDGE",
    productSku: "1976",
    cashPriceMinor: 98_900_000,
    depositPct: 0.25,
    termMonths: 12,
    chargeRate: 0.18,
    startedMonthsAgo: 4,
    paidCount: 4,
  }),
  buildAgreement({
    id: "hp_02",
    ref: "HP-2026-021",
    customerId: "cus_01",
    customerName: "Ada Okoye",
    productName: "SAMSUNG 98'' SMART TV",
    productSku: "2039",
    cashPriceMinor: 84_500_000,
    depositPct: 0.3,
    termMonths: 18,
    chargeRate: 0.2,
    startedMonthsAgo: 2,
    paidCount: 2,
  }),
  buildAgreement({
    id: "hp_03",
    ref: "HP-2026-008",
    customerId: "cus_04",
    customerName: "Devon Cato",
    productName: "SAMSUNG WASHER DRYER COMBO",
    productSku: "1776",
    cashPriceMinor: 79_600_000,
    depositPct: 0.2,
    termMonths: 12,
    chargeRate: 0.18,
    startedMonthsAgo: 5,
    paidCount: 3,
  }),
  buildAgreement({
    id: "hp_04",
    ref: "HP-2026-030",
    customerId: "cus_03",
    customerName: "Priya Ramnarine",
    productName: "WESTPOINT FLOOR CEILING 60K BTU",
    productSku: "736",
    cashPriceMinor: 56_500_000,
    depositPct: 0.25,
    termMonths: 9,
    chargeRate: 0.16,
    startedMonthsAgo: 1,
    paidCount: 1,
  }),
  buildAgreement({
    id: "hp_05",
    ref: "HP-2025-119",
    customerId: "cus_02",
    customerName: "Marlon Persaud",
    productName: "TOTAL 22000W GENERATOR",
    productSku: "104",
    cashPriceMinor: 79_700_000,
    depositPct: 0.35,
    termMonths: 12,
    chargeRate: 0.18,
    startedMonthsAgo: 13,
    paidCount: 12,
  }),
  buildAgreement({
    id: "hp_06",
    ref: "HP-2026-002",
    customerId: "cus_04",
    customerName: "Devon Cato",
    productName: "LG LAUNDRY TOWER WASHER/DRYER",
    productSku: "1920",
    cashPriceMinor: 59_500_000,
    depositPct: 0.2,
    termMonths: 15,
    chargeRate: 0.2,
    startedMonthsAgo: 6,
    paidCount: 0,
  }),
  buildAgreement({
    id: "hp_07",
    ref: "HP-2026-025",
    customerId: "cus_01",
    customerName: "Ada Okoye",
    productName: "SAMSUNG 4 DOOR FRIDGE 23CFT",
    productSku: "1743",
    cashPriceMinor: 76_500_000,
    depositPct: 0.3,
    termMonths: 12,
    chargeRate: 0.18,
    startedMonthsAgo: 3,
    paidCount: 2,
  }),
];
