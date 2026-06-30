// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import { Card } from "@RetailOS/ui/components/card";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@RetailOS/ui/components/pagination";
import { Progress } from "@RetailOS/ui/components/progress";
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
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

// Data Imports
import { db } from "@/features/profile/data";

// Hook Imports
import { usePagination } from "@/features/profile/hooks/use-pagination";
// Type Imports
import type {
  ProfileProjectDatatableProps,
  ProjectDatatable,
} from "@/features/profile/types";

const PAGE_SIZE = 5;

const PROJECT_PROGRESS_COLORS = [
  "**:data-[slot=progress-indicator]:bg-chart-1",
  "**:data-[slot=progress-indicator]:bg-chart-2",
  "**:data-[slot=progress-indicator]:bg-chart-3",
  "**:data-[slot=progress-indicator]:bg-chart-5",
];

const PROJECT_LOGO_COLORS = [
  "bg-primary/10 text-primary",
  "bg-chart-1/10 text-chart-1",
  "bg-chart-2/10 text-chart-2",
  "bg-chart-3/10 text-chart-3",
];

const getProjectInitials = (name: string): string =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getProjectLogoColor = (id: string): string => {
  const hash = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return PROJECT_LOGO_COLORS[hash % PROJECT_LOGO_COLORS.length];
};

const getProjectProgressColor = (id: string): string => {
  const hash = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return PROJECT_PROGRESS_COLORS[hash % PROJECT_PROGRESS_COLORS.length];
};

function ProjectTeamAvatars({ project }: { project: ProjectDatatable }) {
  const visibleTeam = project.team.slice(0, 3);

  return (
    <AvatarGroup>
      {visibleTeam.map((member, index) => (
        <Avatar
          className="ring-2 ring-background"
          key={`${project.id}-team-${index}`}
          size="sm"
        >
          {member.avatar ? (
            <AvatarImage alt={member.initials} src={member.avatar} />
          ) : null}
          <AvatarFallback className="text-[10px]">
            {member.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {project.teamExtraCount ? (
        <AvatarGroupCount>+{project.teamExtraCount}</AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

const { projectDatatable } = db;

function ProfileProjectDatatable({ className }: ProfileProjectDatatableProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return projectDatatable;
    }

    return projectDatatable.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
  }, [search]);

  const totalProjects = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, safeCurrentPage]);

  const showingFrom =
    totalProjects === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safeCurrentPage * PAGE_SIZE, totalProjects);

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: safeCurrentPage,
    totalPages,
    paginationItemsToDisplay: 2,
  });

  const allSelected =
    paginatedProjects.length > 0 &&
    paginatedProjects.every((project) => selectedIds.has(project.id));
  const someSelected =
    paginatedProjects.some((project) => selectedIds.has(project.id)) &&
    !allSelected;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(
        (prev) =>
          new Set([...prev, ...paginatedProjects.map((project) => project.id)])
      );

      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);

      paginatedProjects.forEach((project) => next.delete(project.id));

      return next;
    });
  };

  const handleSelectRow = (projectId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (checked) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }

      return next;
    });
  };

  return (
    <Card className={cn("w-full py-0", className)}>
      <div className="w-full">
        <div className="border-b">
          <div className="flex min-h-17 flex-wrap items-center justify-between gap-3 px-6 py-3">
            <span className="font-medium text-base">Projects List</span>
            <div>
              <Label className="sr-only" htmlFor="search-profile-projects">
                Search projects
              </Label>
              <Input
                id="search-profile-projects"
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search project"
                type="text"
                value={search}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="h-17 border-t">
                <TableHead className="w-12.5 pl-4 text-muted-foreground">
                  <Checkbox
                    aria-label="Select all projects"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(value) => handleSelectAll(!!value)}
                  />
                </TableHead>
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground">Leader</TableHead>
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">
                  Progress
                </TableHead>
                <TableHead className="w-12 px-4 text-right text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.length === 0 ? (
                <TableRow>
                  <TableCell className="text-center" colSpan={6}>
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="w-12.5 pl-4">
                      <Checkbox
                        aria-label={`Select ${project.name}`}
                        checked={selectedIds.has(project.id)}
                        onCheckedChange={(value) =>
                          handleSelectRow(project.id, !!value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Avatar className="size-8 rounded-md after:border-none">
                          {project.logo ? (
                            <>
                              <AvatarImage
                                alt={project.name}
                                className="rounded-md object-cover dark:hidden"
                                src={project.logo}
                              />
                              <AvatarImage
                                alt={project.name}
                                className="hidden rounded-md object-cover dark:block"
                                src={project.logoDark}
                              />
                            </>
                          ) : null}
                          <AvatarFallback
                            className={cn(
                              "rounded-md text-xs",
                              getProjectLogoColor(project.id)
                            )}
                          >
                            {getProjectInitials(project.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-1">
                          <span>{project.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {project.type}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {project.leader}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ProjectTeamAvatars project={project} />
                    </TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-3">
                        <Progress
                          className={cn(
                            "w-40 *:data-[slot=progress-track]:h-1.5",
                            getProjectProgressColor(project.id)
                          )}
                          value={project.progress}
                        />
                        <span className="text-muted-foreground">
                          {project.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              aria-label="Project actions"
                              size="icon"
                              variant="ghost"
                            />
                          }
                        >
                          <EllipsisVerticalIcon />
                          <span className="sr-only">Menu</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem>Details</DropdownMenuItem>
                            <DropdownMenuItem>Archive</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalProjects > 0 && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col">
            <p
              aria-live="polite"
              className="whitespace-nowrap text-muted-foreground text-sm"
            >
              Showing <span>{showingFrom}</span> to <span>{showingTo}</span> of{" "}
              <span>{totalProjects}</span> entries
            </p>

            <div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      aria-label="Go to previous page"
                      className="disabled:pointer-events-none disabled:opacity-50"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(safeCurrentPage - 1)}
                      variant="ghost"
                    >
                      <ChevronLeftIcon aria-hidden="true" />
                      Previous
                    </Button>
                  </PaginationItem>

                  {showLeftEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {pages.map((page) => {
                    const isActive = page === safeCurrentPage;

                    return (
                      <PaginationItem key={page}>
                        <Button
                          aria-current={isActive ? "page" : undefined}
                          className={`${!isActive && "bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40"}`}
                          onClick={() => setCurrentPage(page)}
                          size="icon"
                        >
                          {page}
                        </Button>
                      </PaginationItem>
                    );
                  })}

                  {showRightEllipsis && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <Button
                      aria-label="Go to next page"
                      className="disabled:pointer-events-none disabled:opacity-50"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(safeCurrentPage + 1)}
                      variant="ghost"
                    >
                      Next
                      <ChevronRightIcon aria-hidden="true" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default ProfileProjectDatatable;
