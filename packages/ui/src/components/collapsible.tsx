import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

// Dropped in from the AdminCN template (Assembly Law) — Base UI Collapsible,
// same primitive package we already use. Owned in-repo, RetailOS-formatted.
function Collapsible(props: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger(props: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent(props: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
