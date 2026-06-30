// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
// Third-party Imports
import { PlusIcon } from "lucide-react";
import { useState } from "react";

const SocialUrl = () => {
  const [urls, setUrls] = useState<string[]>(["", "", ""]);

  const addUrl = () => setUrls((prev) => [...prev, ""]);

  const updateUrl = (index: number, value: string) =>
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col">
        <h3 className="font-semibold text-base">Social URLs</h3>
        <p className="text-muted-foreground text-sm">
          Manage your social URLs.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <div className="space-y-4">
          {urls.map((url, idx) => (
            <Input
              key={idx}
              onChange={(e) => updateUrl(idx, e.target.value)}
              placeholder="Link to social profile"
              type="text"
              value={url}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <Button onClick={addUrl} type="button" variant="outline">
            <PlusIcon className="size-4" />
            Add URL
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

export default SocialUrl;
