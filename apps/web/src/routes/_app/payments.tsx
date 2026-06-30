import { Card } from "@RetailOS/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCardIcon, LandmarkIcon, WalletIcon } from "lucide-react";
import TotalRevenueCard from "@/features/payments/chart-total-revenue";
import InvoiceDatatable, {
  type Item,
} from "@/features/payments/datatable-invoice";
import StatisticsCardWithSvg from "@/features/payments/statistics-card-04";
import StatisticsExpenseCard from "@/features/payments/statistics-expense-card";
import StatisticsIncomeCard from "@/features/payments/statistics-income-card";
import TotalOrdersCardSvg from "@/features/payments/total-orders-card-svg";
import PaymentHistoryCard from "@/features/payments/widget-payment-history";
import SalesByCountryCard from "@/features/payments/widget-sales-by-countries";
import TotalEarningCard from "@/features/payments/widget-total-earning";
import TransactionsCard from "@/features/payments/widget-transactions";

export const Route = createFileRoute("/_app/payments")({
  component: PaymentsDashboard,
});

// Terminal / drawer settlement history (GYD)
const paymentData = [
  {
    img: "/images/widgets/master-card.webp",
    imgWidth: "w-8",
    cardNumber: "POS-01",
    cardType: "Card Terminal",
    date: "05/Jan",
    spend: "2,820",
    remaining: "10,020",
  },
  {
    img: "/images/widgets/visa.webp",
    imgWidth: "w-8",
    cardNumber: "DRW-02",
    cardType: "Cash Drawer",
    date: "15/Feb",
    spend: "1,450",
    remaining: "8,570",
  },
  {
    img: "/images/widgets/american-express.webp",
    imgWidth: "w-8",
    cardNumber: "BNK-03",
    cardType: "Bank Transfer",
    date: "20/Mar",
    spend: "500",
    remaining: "7,070",
  },
  {
    img: "/images/widgets/visa.webp",
    imgWidth: "w-8",
    cardNumber: "MMO-04",
    cardType: "Mobile Money",
    date: "10/Mar",
    spend: "750",
    remaining: "5,120",
  },
  {
    img: "/images/widgets/master-card.webp",
    imgWidth: "w-8",
    cardNumber: "POS-05",
    cardType: "Card Terminal",
    date: "25/May",
    spend: "1,200",
    remaining: "5,870",
  },
];

// Settlement split by branch
const salesByBranch = [
  {
    img: "/images/flags/austria.webp",
    sales: "G$8.67M",
    country: "Georgetown",
    changePercentage: "20.3%",
    trend: "up",
  },
  {
    img: "/images/flags/china.webp",
    sales: "G$1.20M",
    country: "Linden",
    changePercentage: "15.7%",
    trend: "up",
  },
  {
    img: "/images/flags/switzerland.webp",
    sales: "G$750k",
    country: "New Amsterdam",
    changePercentage: "18.2%",
    trend: "down",
  },
  {
    img: "/images/flags/india.webp",
    sales: "G$1.50M",
    country: "Berbice",
    changePercentage: "22.1%",
    trend: "up",
  },
  {
    img: "/images/flags/brazil.webp",
    sales: "G$980k",
    country: "Bartica",
    changePercentage: "19.6%",
    trend: "down",
  },
];

// POS tender ledger
const transactions = [
  {
    icon: <CreditCardIcon />,
    paymentMethod: "Card Terminal",
    platform: "Visa / Mastercard",
    amount: "G$2,820",
    paymentType: "credit",
  },
  {
    icon: <LandmarkIcon />,
    paymentMethod: "Bank Transfer",
    platform: "Republic Bank",
    amount: "G$1,260",
    paymentType: "credit",
  },
  {
    icon: <WalletIcon />,
    paymentMethod: "Cash Drawer",
    platform: "Georgetown Till",
    amount: "G$149",
    paymentType: "debit",
  },
  {
    icon: <WalletIcon />,
    paymentMethod: "Mobile Money",
    platform: "MMG Wallet",
    amount: "G$49",
    paymentType: "debit",
  },
  {
    icon: <LandmarkIcon />,
    paymentMethod: "Cheque",
    platform: "Wholesale account",
    amount: "G$268",
    paymentType: "credit",
  },
];

// Top suppliers by settlement value (USD landed cost)
const supplierEarnings = [
  {
    img: "/images/widgets/zipcar.webp",
    platform: "Caribbean Foods Ltd",
    technologies: "Grocery & Provisions",
    earnings: "-$23,569.26",
    progressPercentage: 75,
  },
  {
    img: "/images/widgets/bitbank.webp",
    platform: "Demerara Hardware",
    technologies: "Tools & Building",
    earnings: "-$12,650.31",
    progressPercentage: 25,
  },
  {
    img: "/images/widgets/aviato.webp",
    platform: "Atlantic Imports",
    technologies: "Electronics",
    earnings: "-$55,699.50",
    progressPercentage: 50,
  },
];

// Wholesale invoices (Caribbean retail context)
const invoiceData: Item[] = [
  {
    id: "INV-5099",
    status: "draft",
    avatar: "/images/avatars/avatar-1.webp",
    fallback: "GS",
    client: "Giftland Supermarket",
    field: "Wholesale",
    total: 312_000,
    issuedDate: new Date("2025-04-03"),
    balance: 0,
  },
  {
    id: "INV-5008",
    status: "paid",
    avatar: "/images/avatars/avatar-2.webp",
    fallback: "MR",
    client: "Mohamed's Retail",
    field: "Wholesale",
    total: 145_000,
    issuedDate: new Date("2025-05-12"),
    balance: 0,
  },
  {
    id: "INV-5101",
    status: "paid",
    avatar: "/images/avatars/avatar-3.webp",
    fallback: "BH",
    client: "Bounty Hardware",
    field: "Hardware",
    total: 120_000,
    issuedDate: new Date("2025-06-26"),
    balance: 0,
  },
  {
    id: "INV-4586",
    status: "downloaded",
    avatar: "/images/avatars/avatar-4.webp",
    fallback: "LP",
    client: "Linden Pharmacy",
    field: "Pharmacy",
    total: 268_000,
    issuedDate: new Date("2025-07-05"),
    balance: -7800,
  },
  {
    id: "INV-4360",
    status: "draft",
    avatar: "/images/avatars/avatar-5.webp",
    fallback: "AE",
    client: "Amazonia Electronics",
    field: "Electronics",
    total: 312_000,
    issuedDate: new Date("2025-08-07"),
    balance: 0,
  },
  {
    id: "INV-5104",
    status: "past due",
    avatar: "/images/avatars/avatar-6.webp",
    fallback: "BD",
    client: "Berbice Distributors",
    field: "Wholesale",
    total: 160_000,
    issuedDate: new Date("2025-08-26"),
    balance: 8600,
  },
  {
    id: "INV-5201",
    status: "paid",
    avatar: "/images/avatars/avatar-7.webp",
    fallback: "NA",
    client: "New Amsterdam Grocers",
    field: "Supermarket",
    total: 285_000,
    issuedDate: new Date("2025-01-15"),
    balance: 0,
  },
  {
    id: "INV-4987",
    status: "draft",
    avatar: "/images/avatars/avatar-8.webp",
    fallback: "BT",
    client: "Bartica Trading Co.",
    field: "Wholesale",
    total: 175_000,
    issuedDate: new Date("2025-02-20"),
    balance: 0,
  },
  {
    id: "INV-5342",
    status: "downloaded",
    avatar: "/images/avatars/avatar-9.webp",
    fallback: "SP",
    client: "Stabroek Provisions",
    field: "Supermarket",
    total: 350_000,
    issuedDate: new Date("2025-03-10"),
    balance: -12_000,
  },
  {
    id: "INV-4723",
    status: "past due",
    avatar: "/images/avatars/avatar-10.webp",
    fallback: "EA",
    client: "Essequibo Auto Parts",
    field: "Auto Parts",
    total: 220_000,
    issuedDate: new Date("2025-04-18"),
    balance: 25_000,
  },
];

function PaymentsDashboard() {
  return (
    <div className="grid grid-cols-6 gap-6">
      <StatisticsIncomeCard className="col-span-2 max-lg:col-span-full *:data-[slot=card-content]:lg:max-xl:flex-col *:data-[slot=card-content]:lg:max-xl:pr-6" />

      <StatisticsExpenseCard className="col-span-2 max-lg:col-span-full *:data-[slot=card-content]:lg:max-xl:flex-col *:data-[slot=card-content]:lg:max-xl:pr-6" />

      <StatisticsCardWithSvg
        badgeContent="Last Week"
        changePercentage={10.8}
        className="col-span-2 max-lg:col-span-full"
        svg={<TotalOrdersCardSvg />}
        title="POS Transactions"
        value="42.4k"
      />

      <PaymentHistoryCard
        className="col-span-full lg:col-span-3 lg:max-2xl:order-1 2xl:col-span-2"
        paymentData={paymentData}
        title="Settlement History"
      />

      <TotalRevenueCard className="col-span-full 2xl:col-span-4" />

      <SalesByCountryCard
        className="col-span-full lg:col-span-3 lg:max-2xl:order-1 2xl:col-span-2"
        salesData={salesByBranch}
        subTitle="Monthly settlement by branch"
        title="Settlement by Branch"
      />

      <TransactionsCard
        className="col-span-full lg:col-span-3 lg:max-2xl:order-1 2xl:col-span-2"
        title="Tender Ledger"
        transactions={transactions}
      />

      <TotalEarningCard
        className="col-span-full lg:col-span-3 lg:max-2xl:order-1 2xl:col-span-2"
        comparisonText="Compared to last year ($84,325)"
        earning={24_650}
        earningData={supplierEarnings}
        percentage={10}
        title="Supplier Payouts"
        trend="up"
      />

      <Card className="col-span-full py-0 lg:max-2xl:order-2">
        <InvoiceDatatable data={invoiceData} />
      </Card>
    </div>
  );
}
