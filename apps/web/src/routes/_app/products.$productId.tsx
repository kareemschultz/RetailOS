import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ImageIcon,
  LinkIcon,
  Package,
  Plus,
  Star,
  TriangleAlert,
} from "lucide-react";
import { useId, useState } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/products/$productId")({
  component: ProductDetailScreen,
});

const TRACKING_LABELS: Record<string, string> = {
  none: "Standard",
  lot: "Lot / batch",
  serial: "Serial",
};

function ProductImageFallback() {
  return (
    <div className="flex aspect-square items-center justify-center rounded-xl border bg-muted text-muted-foreground">
      <ImageIcon className="size-7" />
    </div>
  );
}

function ProductDetailScreen() {
  const { productId } = Route.useParams();
  const router = useRouter();
  const urlFieldId = useId();
  const altFieldId = useId();
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");

  const detail = useQuery(
    orpc.product.detail.queryOptions({ input: { id: productId } })
  );
  const imageCreate = useMutation(orpc.product.imageCreate.mutationOptions());

  const product = detail.data;
  const primaryImage = product?.images.find((image) => image.isPrimary);
  const secondaryImages =
    product?.images.filter((image) => !image.isPrimary) ?? [];

  function addPrimaryImage() {
    if (!url.trim() || imageCreate.isPending) {
      return;
    }
    imageCreate.mutate(
      {
        altText: altText.trim() || undefined,
        isPrimary: true,
        productId,
        url: url.trim(),
      },
      {
        onSuccess: () => {
          setUrl("");
          setAltText("");
          router.invalidate();
        },
      }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button render={<Link to="/products" />} size="sm" variant="ghost">
            <ArrowLeft data-icon="inline-start" />
            Products
          </Button>
          <h1 className="mt-3 truncate font-semibold text-2xl tracking-tight">
            {product?.name ?? "Product detail"}
          </h1>
          <p className="text-muted-foreground">
            Manage catalog presentation and commerce media.
          </p>
        </div>
      </div>

      {detail.isError ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5 text-sm">
            <TriangleAlert className="size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Could not load product</p>
              <p className="text-muted-foreground">
                {detail.error.message}. Check your permissions or select another
                product.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {detail.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : null}

      {product ? (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Commerce image</CardTitle>
              <CardDescription>
                This primary image appears in catalog and storefront-ready
                views.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {primaryImage ? (
                <img
                  alt={primaryImage.altText ?? product.name}
                  className="aspect-square w-full rounded-xl border object-cover"
                  height={344}
                  src={primaryImage.url}
                  width={344}
                />
              ) : (
                <ProductImageFallback />
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Package data-icon="inline-start" />
                  {TRACKING_LABELS[product.trackingMode] ??
                    product.trackingMode}
                </Badge>
                <Badge variant="secondary">
                  <Star data-icon="inline-start" />
                  {primaryImage ? "Primary image set" : "No primary image"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle>Product summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-xs">SKU</p>
                  <p className="font-medium font-mono">{product.sku}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Sale price</p>
                  <p className="font-medium font-mono">
                    {formatMoney(
                      product.priceMinor,
                      product.currency,
                      product.scale
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Media count</p>
                  <p className="font-medium font-mono">
                    {product.images.length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Add primary image</CardTitle>
                <CardDescription>
                  Paste the image URL that should lead catalog views.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={urlFieldId}>Image URL</Label>
                    <div className="relative">
                      <LinkIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        id={urlFieldId}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://cdn.example.com/product.png"
                        value={url}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={altFieldId}>Alt text</Label>
                    <Input
                      id={altFieldId}
                      onChange={(event) => setAltText(event.target.value)}
                      placeholder={product.name}
                      value={altText}
                    />
                  </div>
                </div>
                {imageCreate.isError ? (
                  <p className="text-destructive text-sm">
                    {imageCreate.error.message}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    disabled={!url.trim() || imageCreate.isPending}
                    onClick={addPrimaryImage}
                  >
                    <Plus data-icon="inline-start" />
                    {imageCreate.isPending ? "Adding..." : "Add image"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle>Additional media</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {secondaryImages.length === 0 ? (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center">
                    <ImageIcon className="size-5 text-muted-foreground" />
                    <p className="font-medium text-sm">No secondary images</p>
                    <p className="text-muted-foreground text-xs">
                      Additional gallery images will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {secondaryImages.map((image) => (
                      <img
                        alt={image.altText ?? product.name}
                        className="aspect-square rounded-xl border object-cover"
                        height={180}
                        key={image.id}
                        src={image.url}
                        width={180}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
