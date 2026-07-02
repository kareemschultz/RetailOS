import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Separator } from "@RetailOS/ui/components/separator";
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { Textarea } from "@RetailOS/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  autoMapColumns,
  buildImportRows,
  type ColumnMapping,
  IMPORT_FIELD_LABELS,
  type ImportField,
  type ParsedCsv,
  parseCsv,
} from "@/lib/product-import";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/products/import")({
  component: ImportWizardScreen,
});

const MAX_ROWS = 1000;
const UNMAPPED = "__unmapped__";
const PREVIEW_SAMPLE = 8;

type WizardStep = "upload" | "map" | "preview" | "done";

const STEPS: Array<{ key: WizardStep; label: string }> = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "preview", label: "Preview" },
  { key: "done", label: "Done" },
];

const MAPPABLE_FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];

interface ImportDefaultsState {
  autoSku: boolean;
  costingMethod: "avco" | "fifo";
  currency: string;
  scale: string;
  trackingMode: "none" | "lot" | "serial";
}

type StepState = "active" | "done" | "todo";

const STEP_BADGE_CLASSES: Record<StepState, string> = {
  active:
    "flex size-6 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-xs",
  done: "flex size-6 items-center justify-center rounded-full bg-primary/15 font-medium text-primary text-xs",
  todo: "flex size-6 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs",
};

function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) {
    return "done";
  }
  if (index === currentIndex) {
    return "active";
  }
  return "todo";
}

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => {
        const state = stepState(index, currentIndex);
        return (
          <li className="flex items-center gap-2" key={step.key}>
            <span className={STEP_BADGE_CLASSES[state]}>{index + 1}</span>
            <span
              className={
                state === "active"
                  ? "font-medium text-sm"
                  : "text-muted-foreground text-sm"
              }
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="text-muted-foreground/50">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function UploadStep({
  csvText,
  onNext,
  setCsvText,
}: {
  csvText: string;
  onNext: (parsed: ParsedCsv) => void;
  setCsvText: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFile = (file: File) => {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error(
        "Excel files aren't read directly — open the file and use File → Save As → CSV, then upload that."
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(file);
  };
  const proceed = () => {
    const parsed = parseCsv(csvText);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error(
        "No rows detected — paste or upload a CSV with a header row."
      );
      return;
    }
    if (parsed.rows.length > MAX_ROWS) {
      toast.error(
        `This file has ${parsed.rows.length} rows — imports are limited to ${MAX_ROWS} rows per batch. Split the file and import in parts.`
      );
      return;
    }
    onNext(parsed);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-4" />
          Upload your item list
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          Export your items from QuickBooks (Reports → Item Listing → Export as
          CSV) or Excel (Save As → CSV), then upload or paste the contents
          below. The first row must be column headings.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="outline"
          >
            <Upload className="size-4" />
            Choose CSV file
          </Button>
          <input
            accept=".csv,text/csv"
            aria-label="Upload CSV file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleFile(file);
              }
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="import-csv-text">Or paste CSV data</Label>
          <Textarea
            className="min-h-40 font-mono text-xs"
            id="import-csv-text"
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={
              "Item,Description,Cost,Price,Quantity On Hand\nAPPLE-RED,Red Apple,0.50,1.00,25"
            }
            value={csvText}
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={!csvText.trim()} onClick={proceed}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingRow({
  field,
  headers,
  mapping,
  setMapping,
}: {
  field: ImportField;
  headers: string[];
  mapping: ColumnMapping;
  setMapping: (mapping: ColumnMapping) => void;
}) {
  const value = mapping[field];
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[14rem_1fr]">
      <Label className="text-sm">{IMPORT_FIELD_LABELS[field]}</Label>
      <Select
        onValueChange={(next) => {
          const nextMapping = { ...mapping };
          if (next === UNMAPPED) {
            delete nextMapping[field];
          } else {
            nextMapping[field] = Number(next);
          }
          setMapping(nextMapping);
        }}
        value={value === undefined ? UNMAPPED : String(value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNMAPPED}>— Not in this file —</SelectItem>
          {headers.map((header, index) => (
            <SelectItem
              key={`${header}-${String(index)}`}
              value={String(index)}
            >
              {header || `Column ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DefaultsPanel({
  defaults,
  hasOpeningQty,
  locationId,
  locations,
  setDefaults,
  setLocationId,
}: {
  defaults: ImportDefaultsState;
  hasOpeningQty: boolean;
  locationId: string;
  locations: Array<{ id: string; name: string }>;
  setDefaults: (defaults: ImportDefaultsState) => void;
  setLocationId: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Separator />
      <p className="font-medium text-sm">Defaults applied to every row</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="import-currency">Currency</Label>
          <Input
            id="import-currency"
            maxLength={3}
            minLength={3}
            onChange={(event) =>
              setDefaults({
                ...defaults,
                currency: event.target.value.toUpperCase(),
              })
            }
            value={defaults.currency}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="import-scale">Decimal places</Label>
          <Input
            id="import-scale"
            min={0}
            onChange={(event) =>
              setDefaults({ ...defaults, scale: event.target.value })
            }
            type="number"
            value={defaults.scale}
          />
        </div>
        <div className="grid gap-2">
          <Label>Costing method</Label>
          <Select
            onValueChange={(value) =>
              setDefaults({
                ...defaults,
                costingMethod: (value ?? "avco") as "avco" | "fifo",
              })
            }
            value={defaults.costingMethod}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avco">Average cost (AVCO)</SelectItem>
              <SelectItem value="fifo">FIFO</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Tracking</Label>
          <Select
            onValueChange={(value) =>
              setDefaults({
                ...defaults,
                trackingMode: (value ?? "none") as "none" | "lot" | "serial",
              })
            }
            value={defaults.trackingMode}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standard</SelectItem>
              <SelectItem value="lot">Lot / batch</SelectItem>
              <SelectItem value="serial">Serial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch
            checked={defaults.autoSku}
            id="import-auto-sku"
            onCheckedChange={(checked) =>
              setDefaults({ ...defaults, autoSku: checked === true })
            }
          />
          <Label className="text-sm" htmlFor="import-auto-sku">
            Create a sellable SKU per product (recommended — required for cost
            and opening stock)
          </Label>
        </div>
      </div>
      {hasOpeningQty ? (
        <div className="grid gap-2 sm:max-w-sm">
          <Label>Opening stock location</Label>
          <Select
            onValueChange={(value) => setLocationId(value ?? "")}
            value={locationId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose where the stock is" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Quantities on hand will be received into this location as valued
            opening stock.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface PreviewRowResult {
  errors: string[];
  productSku: string;
  rowNumber: number;
  skuCode: string | null;
  status: string;
}

function PreviewTable({ rows }: { rows: PreviewRowResult[] }) {
  const errorRows = rows.filter((row) => row.status === "error");
  const sample =
    errorRows.length > 0 ? errorRows : rows.slice(0, PREVIEW_SAMPLE);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Row</TableHead>
          <TableHead>Product SKU</TableHead>
          <TableHead>SKU code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Problems</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sample.map((row) => (
          <TableRow key={row.rowNumber}>
            <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
            <TableCell className="font-mono text-xs">
              {row.productSku}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {row.skuCode ?? "—"}
            </TableCell>
            <TableCell>
              {row.status === "valid" ? (
                <Badge variant="secondary">Valid</Badge>
              ) : (
                <Badge variant="destructive">Error</Badge>
              )}
            </TableCell>
            <TableCell className="text-destructive text-xs">
              {row.errors.join("; ")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ImportWizardScreen() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaults, setDefaults] = useState<ImportDefaultsState>({
    autoSku: true,
    costingMethod: "avco",
    currency: "GYD",
    scale: "2",
    trackingMode: "none",
  });
  const [locationId, setLocationId] = useState("");
  const [buildIssues, setBuildIssues] = useState<string[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const preview = useMutation(orpc.catalog.importPreview.mutationOptions());
  const commit = useMutation(orpc.catalog.importCommit.mutationOptions());

  const builtRows = useMemo(() => {
    if (!parsed) {
      return null;
    }
    const scale = Number.parseInt(defaults.scale || "2", 10);
    return buildImportRows(parsed, mapping, {
      autoSku: defaults.autoSku,
      costingMethod: defaults.costingMethod,
      currency: defaults.currency,
      scale: Number.isInteger(scale) && scale >= 0 ? scale : 2,
      trackingMode: defaults.trackingMode,
    });
  }, [parsed, mapping, defaults]);

  const hasOpeningQty = Boolean(
    builtRows?.rows.some((row) => row.openingQtyBase != null)
  );
  const sellableLocations = (locations.data ?? []).filter(
    (location) => location.type === "store" || location.type === "warehouse"
  );

  const runPreview = async () => {
    if (!builtRows) {
      return;
    }
    setBuildIssues(builtRows.issues);
    if (builtRows.issues.length > 0 || builtRows.rows.length === 0) {
      if (builtRows.rows.length === 0) {
        toast.error("No importable rows — check the column mapping.");
      }
      return;
    }
    if (hasOpeningQty && !locationId) {
      toast.error("Choose the opening stock location first.");
      return;
    }
    try {
      await preview.mutateAsync({ rows: builtRows.rows });
      setIdempotencyKey(crypto.randomUUID());
      setStep("preview");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Preview failed — try again."
      );
    }
  };

  const runCommit = async () => {
    if (!builtRows) {
      return;
    }
    try {
      await commit.mutateAsync({
        idempotencyKey,
        locationId: hasOpeningQty ? locationId : undefined,
        rows: builtRows.rows,
      });
      setStep("done");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Import failed — nothing was saved."
      );
    }
  };

  const resetWizard = () => {
    setStep("upload");
    setCsvText("");
    setParsed(null);
    setMapping({});
    setBuildIssues([]);
    preview.reset();
    commit.reset();
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Link
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          to="/products"
        >
          <ArrowLeft className="size-3.5" />
          Back to products
        </Link>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Import products
          </h1>
          <p className="text-muted-foreground">
            Bring your QuickBooks item list or Excel catalog into RetailOS —
            products, SKUs, lots, and valued opening stock in one pass.
          </p>
        </div>
        <StepIndicator current={step} />
      </div>

      {step === "upload" ? (
        <UploadStep
          csvText={csvText}
          onNext={(nextParsed) => {
            setParsed(nextParsed);
            setMapping(autoMapColumns(nextParsed.headers));
            setBuildIssues([]);
            setStep("map");
          }}
          setCsvText={setCsvText}
        />
      ) : null}

      {step === "map" && parsed ? (
        <MapStep
          buildIssues={buildIssues}
          defaults={defaults}
          hasOpeningQty={hasOpeningQty}
          locationId={locationId}
          locations={sellableLocations}
          mapping={mapping}
          onBack={() => setStep("upload")}
          onPreview={runPreview}
          parsed={parsed}
          previewPending={preview.isPending}
          setDefaults={setDefaults}
          setLocationId={setLocationId}
          setMapping={setMapping}
        />
      ) : null}

      {step === "preview" && preview.data ? (
        <PreviewStep
          commitPending={commit.isPending}
          locationName={
            sellableLocations.find((l) => l.id === locationId)?.name ??
            "location"
          }
          onBack={() => setStep("map")}
          onCommit={runCommit}
          result={preview.data}
          showLocation={hasOpeningQty}
        />
      ) : null}

      {step === "done" && commit.data ? (
        <DoneStep onReset={resetWizard} result={commit.data} />
      ) : null}
    </div>
  );
}

function MapStep({
  buildIssues,
  defaults,
  hasOpeningQty,
  locationId,
  locations,
  mapping,
  onBack,
  onPreview,
  parsed,
  previewPending,
  setDefaults,
  setLocationId,
  setMapping,
}: {
  buildIssues: string[];
  defaults: ImportDefaultsState;
  hasOpeningQty: boolean;
  locationId: string;
  locations: Array<{ id: string; name: string }>;
  mapping: ColumnMapping;
  onBack: () => void;
  onPreview: () => void;
  parsed: ParsedCsv;
  previewPending: boolean;
  setDefaults: (defaults: ImportDefaultsState) => void;
  setLocationId: (id: string) => void;
  setMapping: (mapping: ColumnMapping) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Match your columns</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground text-sm">
          {parsed.rows.length} data rows detected. We auto-matched what we could
          — adjust anything that looks wrong. Only the product SKU is required.
        </p>
        <div className="grid gap-3">
          {MAPPABLE_FIELDS.map((field) => (
            <MappingRow
              field={field}
              headers={parsed.headers}
              key={field}
              mapping={mapping}
              setMapping={setMapping}
            />
          ))}
        </div>
        <DefaultsPanel
          defaults={defaults}
          hasOpeningQty={hasOpeningQty}
          locationId={locationId}
          locations={locations}
          setDefaults={setDefaults}
          setLocationId={setLocationId}
        />
        {buildIssues.length > 0 ? (
          <BuildIssueList issues={buildIssues} />
        ) : null}
        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            disabled={mapping.productSku === undefined || previewPending}
            onClick={onPreview}
          >
            {previewPending ? "Checking…" : "Preview import"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BuildIssueList({ issues }: { issues: string[] }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-destructive text-sm">
        <TriangleAlert className="size-4" />
        Fix these rows before continuing
      </p>
      <ul className="list-inside list-disc text-destructive text-xs">
        {issues.slice(0, 10).map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      {issues.length > 10 ? (
        <p className="mt-1 text-destructive text-xs">
          …and {issues.length - 10} more
        </p>
      ) : null}
    </div>
  );
}

function PreviewStep({
  commitPending,
  locationName,
  onBack,
  onCommit,
  result,
  showLocation,
}: {
  commitPending: boolean;
  locationName: string;
  onBack: () => void;
  onCommit: () => void;
  result: {
    errorCount: number;
    rows: PreviewRowResult[];
    validCount: number;
  };
  showLocation: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review before importing</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">
            {result.validCount} valid row{result.validCount === 1 ? "" : "s"}
          </Badge>
          {result.errorCount > 0 ? (
            <Badge variant="destructive">
              {result.errorCount} row{result.errorCount === 1 ? "" : "s"} with
              problems
            </Badge>
          ) : null}
          {showLocation ? (
            <Badge variant="outline">Opening stock → {locationName}</Badge>
          ) : null}
        </div>
        <PreviewTable rows={result.rows} />
        {result.errorCount > 0 ? (
          <p className="text-destructive text-sm">
            Fix the highlighted rows in your file (or unmap the offending
            column) and run the preview again — nothing imports while errors
            remain.
          </p>
        ) : null}
        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="size-4" />
            Back to mapping
          </Button>
          <Button
            disabled={result.errorCount > 0 || commitPending}
            onClick={onCommit}
          >
            {commitPending
              ? "Importing…"
              : `Import ${result.validCount} products`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep({
  onReset,
  result,
}: {
  onReset: () => void;
  result: {
    createdLotCount: number;
    createdProductCount: number;
    createdSkuCount: number;
    openingStockCount: number;
  };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="font-semibold text-lg">Import complete</p>
        <p className="text-muted-foreground text-sm">
          {result.createdProductCount} products · {result.createdSkuCount} SKUs
          · {result.createdLotCount} lots · {result.openingStockCount} opening
          stock receipts
        </p>
        <div className="mt-2 flex gap-2">
          <Button onClick={onReset} variant="outline">
            Import another file
          </Button>
          <Button render={<Link to="/products" />}>View products</Button>
        </div>
      </CardContent>
    </Card>
  );
}
