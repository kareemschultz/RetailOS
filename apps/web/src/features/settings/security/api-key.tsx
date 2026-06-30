// React Imports

// Component Imports
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  CheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

interface ApiKeyData {
  createdDate: string;
  id: string;
  name: string;
  secretKey: string;
  status: "active" | "inactive";
}

const sampleApiKeys: ApiKeyData[] = [
  {
    id: "1",
    name: "Production API Key",
    status: "active",
    secretKey: "sk_a8f3d9c2b1e4f7g6h5j8k9m0n3p2q5r8t",
    createdDate: "15 January 2026",
  },
  {
    id: "2",
    name: "Development Key",
    status: "active",
    secretKey: "sk_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j",
    createdDate: "3 February 2026",
  },
  {
    id: "3",
    name: "Testing Environment",
    status: "inactive",
    secretKey: "sk_b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s",
    createdDate: "28 December 2025",
  },
];

const ApiKey = () => {
  const [open, setOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>(sampleApiKeys);
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  const generateRandomKey = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const length = Math.floor(Math.random() * 9) + 25;
    let key = "";

    for (let i = 0; i < length; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `sk_${key}`;
  };

  const handleCreateKey = () => {
    if (!keyName.trim()) {
      return;
    }

    const newKey: ApiKeyData = {
      id: Date.now().toString(),
      name: keyName,
      status: "active",
      secretKey: generateRandomKey(),
      createdDate: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };

    setApiKeys((prev) => [newKey, ...prev]);
    setKeyName("");
    setOpen(false);
    setNewKey(newKey.secretKey);
    setNewKeyVisible(true);
  };

  const truncateKey = (key: string) => {
    if (key.length <= 10) {
      return key;
    }

    return `${key.slice(0, 9)}...${key.slice(-4)}`;
  };

  const copyFullKey = async (key: string | null) => {
    if (!key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(key);
      setCopiedNewKey(true);
      setTimeout(() => setCopiedNewKey(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleKeyStatus = (id: string) => {
    setApiKeys((prev) =>
      prev.map((key) =>
        key.id === id
          ? { ...key, status: key.status === "active" ? "inactive" : "active" }
          : key
      )
    );
  };

  const deleteKey = (id: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== id));
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Generate API Key</h3>
        <p className="text-muted-foreground text-sm">
          Manage your API keys and access tokens.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Your API Keys</h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Do not share your API key with others or expose it in the browser.
              To protect your account&apos;s security.
            </p>
          </div>

          <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger
              onClick={() => setOpen(true)}
              render={<Button className="max-sm:w-full" />}
            >
              <PlusIcon />
              Create new secret key
            </DialogTrigger>

            <DialogContent
              className={cn(
                "sm:max-w-lg [&>[data-slot=dialog-close]>svg]:size-5"
              )}
            >
              <DialogHeader>
                <div className="space-y-1">
                  <DialogTitle className="m-0 text-lg">
                    Create New Secret Key
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Generate a new API key to access our services. Keep this key
                    secure and never share it publicly.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-2">
                <Label className="gap-1" htmlFor="key-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="key-name"
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Enter key name"
                  required
                  type="text"
                  value={keyName}
                />
              </div>

              <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button disabled={!keyName.trim()} onClick={handleCreateKey}>
                  Create secret key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Show the full secret once immediately after creation */}
          <Dialog onOpenChange={setNewKeyVisible} open={newKeyVisible}>
            <DialogContent
              className={cn(
                "sm:max-w-lg [&>[data-slot=dialog-close]>svg]:size-5"
              )}
            >
              <DialogHeader>
                <div className="space-y-1">
                  <DialogTitle className="m-0 text-lg">
                    Your New Secret Key
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    This is the only time the full secret key will be shown.
                    Copy and store it securely now.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-2">
                <Label className="gap-1">Secret Key</Label>
                <div className="flex items-center gap-2">
                  <code className="break-all rounded bg-muted px-3 py-2 text-sm">
                    {newKey}
                  </code>
                  <Button className="h-9" onClick={() => copyFullKey(newKey)}>
                    {copiedNewKey ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                    <span className="ml-2">
                      {copiedNewKey ? "Copied" : "Copy"}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
                <DialogClose render={<Button variant="outline" />}>
                  Close
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Secret Key</TableHead>
                <TableHead className="px-4">Created Date</TableHead>
                <TableHead className="px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="px-4 font-medium">
                    {apiKey.name}
                  </TableCell>

                  <TableCell className="px-4">
                    <Badge
                      className={
                        apiKey.status === "active"
                          ? "bg-green-600/10 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }
                      variant={
                        apiKey.status === "active" ? "default" : "secondary"
                      }
                    >
                      {apiKey.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <code className="text-muted-foreground text-sm">
                        {truncateKey(apiKey.secretKey)}
                      </code>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 text-sm">
                    {apiKey.createdDate}
                  </TableCell>
                  <TableCell className="px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            className="rounded-full"
                            size="icon"
                            variant="ghost"
                          />
                        }
                      >
                        <EllipsisVerticalIcon />
                        <span className="sr-only">Edit menu</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-20">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => toggleKeyStatus(apiKey.id)}
                          >
                            {apiKey.status === "active"
                              ? "Disable Key"
                              : "Enable Key"}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-destructive!"
                            onClick={() => deleteKey(apiKey.id)}
                          >
                            Delete Key
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ApiKey;
