import { createFileRoute } from "@tanstack/react-router";

import UserListApp from "@/features/users/users-list";

export const Route = createFileRoute("/_app/users")({
  component: UsersScreen,
});

function UsersScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <UserListApp />
    </div>
  );
}
