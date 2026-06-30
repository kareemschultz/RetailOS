// React Imports

// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import type { ReactNode } from "react";

const FORMAT_TOKEN_REGEX = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const BOLD_TOKEN_REGEX = /^\*\*(.+)\*\*$/;
const LINK_TOKEN_REGEX = /^\[([^\]]+)\]\(([^)]+)\)$/;

interface MessageContentProps {
  className?: string;
  content: string;
  isFromMe?: boolean;
}

const renderToken = (token: string, index: number, isFromMe: boolean) => {
  const boldMatch = token.match(BOLD_TOKEN_REGEX);

  if (boldMatch) {
    return (
      <strong className="font-semibold" key={index}>
        {boldMatch[1]}
      </strong>
    );
  }

  const linkMatch = token.match(LINK_TOKEN_REGEX);

  if (linkMatch) {
    return (
      <a
        className={cn(
          "font-medium underline underline-offset-2",
          isFromMe ? "text-primary-foreground" : "text-primary"
        )}
        href={linkMatch[2]}
        key={index}
        rel="noopener noreferrer"
        target="_blank"
      >
        {linkMatch[1]}
      </a>
    );
  }

  return <span key={index}>{token}</span>;
};

const parseMessageContent = (
  content: string,
  isFromMe: boolean
): ReactNode[] => {
  const parts = content
    .split(FORMAT_TOKEN_REGEX)
    .filter((part) => part.length > 0);

  return parts.map((part, index) => renderToken(part, index, isFromMe));
};

const MessageContent = (props: MessageContentProps) => {
  // Props
  const { content, isFromMe = false, className } = props;

  return (
    <span className={className}>{parseMessageContent(content, isFromMe)}</span>
  );
};

export default MessageContent;
