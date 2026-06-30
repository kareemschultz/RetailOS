import { createFileRoute } from "@tanstack/react-router";

import ChatApp from "@/features/chat";

export const Route = createFileRoute("/_app/chat")({
  component: ChatScreen,
});

function ChatScreen() {
  return (
    <div className="h-[calc(100vh-8rem)] p-4">
      <ChatApp />
    </div>
  );
}
