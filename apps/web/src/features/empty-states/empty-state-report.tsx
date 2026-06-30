import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";

const timeRangeItems = [
  { label: "Last 12 months", value: "last-12-months" },
  { label: "Last 6 months", value: "last-6-months" },
  { label: "Last 30 days", value: "last-30-days" },
];

const regionItems = [
  { label: "US-West", value: "us-west" },
  { label: "US-East", value: "us-east" },
  { label: "EU-Central", value: "eu-central" },
];

export const skeletonClass =
  "border-card-foreground/10 rounded-md border bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--card-foreground)8%,transparent),color-mix(in_oklab,var(--card-foreground)8%,transparent)_1px,var(--card)_2px,var(--card)_10px)]";

function EmptyStateReport() {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Report</CardTitle>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Select defaultValue="last-12-months" items={timeRangeItems}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {timeRangeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="us-west" items={regionItems}>
            <SelectTrigger className="w-full sm:w-34">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {regionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-xl border p-2 md:p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
            <div className="space-y-2 md:space-y-3">
              <div className={`${skeletonClass} h-24`} />
              <div className={`${skeletonClass} h-24`} />
              <div className={`${skeletonClass} h-24`} />
            </div>

            <div className={`${skeletonClass} h-64 md:col-span-2 md:h-full`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmptyStateReport;
