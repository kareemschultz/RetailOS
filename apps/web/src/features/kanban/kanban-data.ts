import type { Assignee, Task } from "./kanban-types";

// Procurement buyers / approvers (the people who own a purchase order as it
// moves across the board). No avatar assets are bundled, so cards fall back to
// initials.
export const teamMembers: Assignee[] = [
  { name: "Anand Persaud" },
  { name: "Maria Gonzales" },
  { name: "Devon Adams" },
  { name: "Priya Ramnarine" },
  { name: "Kwame Bourne" },
  { name: "Shanice Forde" },
  { name: "Reuben Khan" },
  { name: "Latoya Singh" },
];

// RetailOS procurement board: Purchase Orders flowing Draft -> Approved ->
// Ordered -> Received. Card values are in Guyanese dollars (GYD).
export const initialColumns: Record<string, Task[]> = {
  draft: [
    {
      id: "1",
      title: "Rice & dry goods restock",
      code: "PO-2041",
      supplier: "Demerara Distributors",
      store: "Georgetown Main",
      amountGyd: 1_485_000,
      priority: "high",
      description: "Bulk parboiled rice and flour ahead of month-end demand.",
      assignees: [teamMembers[0], teamMembers[3]],
      dueDate: "Jul 05, 2026",
    },
    {
      id: "2",
      title: "Cleaning supplies top-up",
      code: "PO-2042",
      supplier: "Caribbean Household Ltd",
      store: "Linden Branch",
      amountGyd: 312_000,
      priority: "low",
      assignees: [teamMembers[1]],
      dueDate: "Jul 09, 2026",
    },
  ],

  approved: [
    {
      id: "3",
      title: "Beverage cooler refill",
      code: "PO-2038",
      supplier: "Banks DIH",
      store: "Georgetown Main",
      amountGyd: 2_140_000,
      priority: "medium",
      description: "Soft drinks and malt for the holiday weekend.",
      assignees: [teamMembers[2], teamMembers[4]],
      dueDate: "Jul 03, 2026",
    },
    {
      id: "4",
      title: "Hardware fasteners batch",
      code: "PO-2039",
      supplier: "Toolsie Persaud",
      store: "New Amsterdam",
      amountGyd: 875_500,
      priority: "high",
      assignees: [teamMembers[5]],
      dueDate: "Jul 06, 2026",
    },
  ],

  ordered: [
    {
      id: "5",
      title: "Imported electronics container",
      code: "PO-2031",
      supplier: "Shenzhen Trade Co",
      store: "Bonded Warehouse 1",
      amountGyd: 9_650_000,
      priority: "high",
      description: "Awaiting GRA clearance before bond release.",
      assignees: [teamMembers[6], teamMembers[0]],
      dueDate: "Jul 18, 2026",
    },
    {
      id: "6",
      title: "Pharmacy stock — chronic meds",
      code: "PO-2034",
      supplier: "Ansa McAl Pharma",
      store: "Georgetown Main",
      amountGyd: 1_920_000,
      priority: "medium",
      assignees: [teamMembers[7]],
      dueDate: "Jul 12, 2026",
    },
  ],

  received: [
    {
      id: "7",
      title: "Frozen goods delivery",
      code: "PO-2025",
      supplier: "Pritipaul Singh",
      store: "Georgetown Main",
      amountGyd: 1_240_000,
      priority: "medium",
      description: "Received and reconciled against GRN.",
      assignees: [teamMembers[3], teamMembers[4]],
      dueDate: "Jun 27, 2026",
    },
    {
      id: "8",
      title: "Stationery & receipt rolls",
      code: "PO-2027",
      supplier: "Guyana Stores",
      store: "Linden Branch",
      amountGyd: 184_000,
      priority: "low",
      assignees: [teamMembers[1]],
      dueDate: "Jun 30, 2026",
    },
  ],
};
