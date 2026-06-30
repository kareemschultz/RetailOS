import { Card } from "@RetailOS/ui/components/card";

import {
  productData,
  saleData,
  staffData,
  supplierInvoiceData,
} from "@/features/data-tables/data";
import ProductDatatable from "@/features/data-tables/datatable-product";
import SalesDatatable from "@/features/data-tables/datatable-sales";
import StaffDatatable from "@/features/data-tables/datatable-staff";
import SupplierInvoiceDatatable from "@/features/data-tables/datatable-supplier-invoice";

interface ShowcaseSection {
  content: React.ReactNode;
  description: string;
  key: string;
  title: string;
}

const sections: ShowcaseSection[] = [
  {
    key: "products",
    title: "Products — filters, sorting & export",
    description:
      "Faceted filters by category and status, text search, column sorting, page-size control, and CSV / Excel / JSON export of selected or filtered rows.",
    content: <ProductDatatable data={productData} />,
  },
  {
    key: "sales",
    title: "POS sales — basic data table",
    description:
      "A simple sortable, paginated table of recent point-of-sale transactions across stores, with payment method and settlement status.",
    content: <SalesDatatable data={saleData} />,
  },
  {
    key: "supplier-invoices",
    title: "Supplier invoices — dates & balances",
    description:
      "Procurement invoices with issued dates, outstanding GYD balances, and payment status (paid / partial / overdue / draft).",
    content: <SupplierInvoiceDatatable data={supplierInvoiceData} />,
  },
  {
    key: "staff",
    title: "Staff — faceted role filters",
    description:
      "Team members filtered by role, store, and status, with row-level quick actions (view, disable, edit permissions).",
    content: <StaffDatatable data={staffData} />,
  },
];

function DataTables() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1.5">
        <h1 className="font-semibold text-2xl">Data tables</h1>
        <p className="text-muted-foreground">
          RetailOS data-table patterns built on TanStack Table — filtering,
          sorting, faceted selects, pagination, and export.
        </p>
      </div>

      {sections.map((section) => (
        <section className="space-y-4" key={section.key}>
          <div className="space-y-1">
            <h2 className="font-semibold text-xl">{section.title}</h2>
            <p className="text-muted-foreground text-sm">
              {section.description}
            </p>
          </div>
          <Card className="py-0">{section.content}</Card>
        </section>
      ))}
    </div>
  );
}

export default DataTables;
