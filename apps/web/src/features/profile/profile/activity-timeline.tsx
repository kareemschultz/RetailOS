// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "@RetailOS/ui/components/timeline";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  ChartNoAxesColumnIncreasingIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
} from "lucide-react";
// Type Imports
import type {
  ActivityFileType,
  UserActivityItem,
} from "@/features/profile/types";

const ATTACHMENT_FILE_ICONS: Record<ActivityFileType, typeof FileTextIcon> = {
  pdf: FileTextIcon,
  image: ImageIcon,
  doc: FileIcon,
  excel: FileSpreadsheetIcon,
};

const ATTACHMENT_BADGE_STYLES: Record<ActivityFileType, string> = {
  pdf: "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400",
  image: "border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400",
  doc: "border-primary text-primary",
  excel:
    "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400",
};

function ActivityAttachment({
  attachment,
}: {
  attachment: NonNullable<UserActivityItem["attachment"]>;
}) {
  const FileIconComponent = ATTACHMENT_FILE_ICONS[attachment.fileType];

  return (
    <Badge
      className={cn(
        "h-auto gap-1.5 rounded-sm px-2 py-1 font-normal",
        ATTACHMENT_BADGE_STYLES[attachment.fileType]
      )}
      variant="outline"
    >
      <FileIconComponent className="size-3.5" />
      {attachment.name}
    </Badge>
  );
}

function ActivityPersonCard({
  person,
}: {
  person: NonNullable<UserActivityItem["person"]>;
}) {
  return (
    <div className="flex w-fit max-w-sm items-center gap-3 rounded-md border bg-muted/50 px-3 py-2.5">
      <Avatar className="size-8">
        {person.avatar ? (
          <AvatarImage alt={person.name} src={person.avatar} />
        ) : null}
        <AvatarFallback className="text-xs">{person.initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-semibold text-sm">{person.name}</p>
        {person.role ? (
          <p className="truncate text-muted-foreground text-xs">
            {person.role}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ActivityTeamAvatars({
  teamMembers,
  teamExtraCount,
}: {
  teamMembers: NonNullable<UserActivityItem["teamMembers"]>;
  teamExtraCount?: number;
}) {
  const visibleMembers = teamMembers.slice(0, 3);

  return (
    <AvatarGroup>
      {visibleMembers.map((member, index) => (
        <Avatar
          className="ring-2 ring-background"
          key={`${member.name}-${index}`}
          size="sm"
        >
          {member.avatar ? (
            <AvatarImage alt={member.name} src={member.avatar} />
          ) : null}
          <AvatarFallback className="text-[10px]">
            {member.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {teamExtraCount ? (
        <AvatarGroupCount>+{teamExtraCount}</AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

export interface ActivityTimelineProps {
  activityLog: UserActivityItem[];
  className?: string;
}

export const ActivityTimeline = ({
  activityLog,
  className,
}: ActivityTimelineProps) => (
  <div className={cn("flex flex-col gap-2.5", className)}>
    <Card>
      <CardHeader className="flex items-center gap-2">
        <ChartNoAxesColumnIncreasingIcon />
        <h2 className="font-medium text-lg">Activity Timeline</h2>
      </CardHeader>
      <CardContent>
        <Timeline>
          {activityLog.map((item, index) => {
            const isLast = index === activityLog.length - 1;

            return (
              <TimelineItem className="gap-x-0" key={item.id} status="done">
                <TimelineDot
                  className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20"
                  status="custom"
                >
                  <span className="size-3 rounded-full bg-primary" />
                </TimelineDot>
                {!isLast && <TimelineLine className="min-h-10 bg-muted" done />}
                <TimelineHeading className="flex w-full items-center justify-between text-wrap pt-2.5 pb-2 pl-4 font-medium text-base text-foreground">
                  {item.description}
                  <span className="text-nowrap font-normal text-muted-foreground text-xs md:text-sm">
                    {item.timestamp}
                  </span>
                </TimelineHeading>
                {item.detail ||
                item.attachment ||
                item.person ||
                item.teamMembers?.length ? (
                  <TimelineContent className="flex flex-col gap-2 pb-3 pl-4">
                    {item.detail ? (
                      <span className="text-muted-foreground text-sm">
                        {item.detail}
                      </span>
                    ) : null}
                    {item.attachment ? (
                      <ActivityAttachment attachment={item.attachment} />
                    ) : null}
                    {item.person ? (
                      <ActivityPersonCard person={item.person} />
                    ) : null}
                    {item.teamMembers?.length ? (
                      <ActivityTeamAvatars
                        teamExtraCount={item.teamExtraCount}
                        teamMembers={item.teamMembers}
                      />
                    ) : null}
                  </TimelineContent>
                ) : null}
              </TimelineItem>
            );
          })}
        </Timeline>
      </CardContent>
    </Card>
  </div>
);

export default ActivityTimeline;
