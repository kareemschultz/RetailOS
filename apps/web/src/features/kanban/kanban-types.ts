export type Assignee = {
  name: string;
  avatar?: string;
};

// A board card. Ported from the AdminCN kanban Task and reframed for RetailOS
// procurement: a card is a Purchase Order moving across the buying workflow.
export type Task = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  description?: string;
  assignees?: Assignee[];
  dueDate?: string;
  // RetailOS procurement fields
  code?: string; // PO number, e.g. PO-2041
  supplier?: string;
  store?: string;
  amountGyd?: number; // order value in Guyanese dollars
};

export type ColumnSummary = {
  id: string;
  title: string;
};
