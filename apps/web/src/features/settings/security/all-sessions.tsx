// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@RetailOS/ui/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
// Third-party Imports
import { LogOutIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Session } from "@/features/settings/types";

const Sessions = ({ initialSessions }: { initialSessions: Session[] }) => {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [toDelete, setToDelete] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const confirmDelete = (session: Session) => {
    setToDelete(session);
    setOpen(true);
  };

  const performDelete = () => {
    if (!toDelete) {
      return;
    }

    // compute new pagination state after deletion
    const newTotal = sessions.length - 1;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));

    setSessions((s) => s.filter((x) => x.id !== toDelete.id));
    setToDelete(null);
    setOpen(false);
    setPage((p) => Math.min(p, newTotalPages));
  };

  const total = sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;

    return sessions.slice(start, start + pageSize);
  }, [sessions, page]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Your Active Sessions</h3>
        <p className="text-muted-foreground text-sm">
          Manage your active sessions and sign out from other devices.
        </p>
      </div>

      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="px-4">Login Time</TableHead>
                <TableHead className="px-4">IP Address</TableHead>
                <TableHead className="px-4">Browser</TableHead>
                <TableHead className="px-4">Operating System</TableHead>
                <TableHead className="px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((rowItem) => (
                <TableRow className="group" key={rowItem.id}>
                  <TableCell className="px-4">
                    <div className="flex flex-col text-sm">
                      <div className="font-medium">{rowItem.date}</div>
                      <div className="text-muted-foreground text-xs">
                        {rowItem.time}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="flex flex-col px-4 text-sm">
                    <div className="font-medium">
                      {rowItem.ip}
                      <div className="text-muted-foreground text-xs">
                        {rowItem.location}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 text-sm">
                    <div className="flex items-center gap-2.5">
                      {rowItem.isMobile ? (
                        <SmartphoneIcon className="size-6" />
                      ) : (
                        <MonitorIcon className="size-6" />
                      )}
                      <div>
                        <div className="font-medium text-sm">
                          {rowItem.browser}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {rowItem.isMobile ? "Mobile" : "Desktop"}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 font-medium text-sm">
                    {rowItem.os}
                  </TableCell>

                  <TableCell className="px-4 text-right">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => confirmDelete(rowItem)}
                        size="icon"
                        variant="ghost"
                      >
                        <LogOutIcon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 max-sm:flex-col">
            <p className="text-nowrap text-center text-muted-foreground text-sm">
              {`Showing ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, total)} of ${total} sessions`}
            </p>
            <Pagination aria-label="Pagination" className="md:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    aria-disabled={page === 1}
                    className={
                      page === 1 ? "pointer-events-none opacity-50" : undefined
                    }
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) {
                        setPage((p) => p - 1);
                      }
                    }}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        isActive={pageNum === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNum);
                        }}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    aria-disabled={page === totalPages}
                    className={
                      page === totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) {
                        setPage((p) => p + 1);
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign out and remove session</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this session? This will sign the
                session out on that device.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={performDelete} variant="destructive">
                Remove session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Sessions;
