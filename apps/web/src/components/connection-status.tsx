import { Badge } from "@RetailOS/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { Wifi, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

// Always-visible connection state. Frontend MSP is ONLINE-ONLY (number leasing
// is not yet bound to createSale), so this is a status indicator, not an offline
// queue — when offline the cashier is told the till can't complete a sale, never
// silently allowed to. Icon + text (never colour alone) per the design language.
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// Server has no network status; assume online so SSR markup matches first paint.
function getServerSnapshot() {
  return true;
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            aria-label={online ? "Online" : "Offline"}
            variant={online ? "secondary" : "destructive"}
          />
        }
      >
        {online ? (
          <Wifi className="size-3.5" />
        ) : (
          <WifiOff className="size-3.5" />
        )}
        {online ? "Online" : "Offline"}
      </TooltipTrigger>
      <TooltipContent>
        {online
          ? "Connected — sales sync to the cloud in real time."
          : "Offline — this till is online-only and cannot complete a sale until the connection returns."}
      </TooltipContent>
    </Tooltip>
  );
}
