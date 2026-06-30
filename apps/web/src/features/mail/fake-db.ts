// Reframed AdminCN mail fake-db -> RetailOS operational inbox. "Emails" are
// system notifications and staff messages: low-stock alerts, PO approvals, bond
// clearance, shift-close summaries, overdue invoices, transfer approvals, stock
// discrepancies, backup-failure alerts (charter §22 event types). Senders are
// RetailOS subsystems and staff across Georgetown / New Amsterdam / Linden.
// The data SHAPE matches the AdminCN Email type exactly.

import { subDays, subHours, subWeeks } from "date-fns";

import { MAIL_CURRENT_USER } from "@/features/mail/mail-config";
import type { Email } from "@/features/mail/types";

export const db: Email[] = [
  {
    id: "msg-1",
    from: "Inventory System",
    fromEmail: "inventory@retailos.gy",
    avatar: undefined,
    subject: "Low stock: Rice Parboiled 5kg below reorder point",
    preview:
      "Georgetown — Bourda store is down to 12 units of Rice Parboiled 5kg (reorder point 40).",
    body: "Georgetown — Bourda store is down to 12 units of Rice Parboiled 5kg (SKU RC-PB-5K), below the reorder point of 40. Suggested purchase quantity: 120 units from Demerara Distributors. Lead time is 3 days.\n\nReview the reorder suggestion in Procurement to raise a purchase order.",
    date: subHours(new Date(), 1),
    isRead: false,
    isStarred: true,
    labels: ["alerts", "operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-1-1",
          from: "Inventory System",
          fromEmail: "inventory@retailos.gy",
          body: "Georgetown — Bourda store is down to 12 units of Rice Parboiled 5kg (SKU RC-PB-5K), below the reorder point of 40. Suggested purchase quantity: 120 units from Demerara Distributors. Lead time is 3 days.\n\nReview the reorder suggestion in Procurement to raise a purchase order.",
          date: subHours(new Date(), 1),
        },
      ],
    },
  },
  {
    id: "msg-2",
    from: "Procurement — Ramesh Singh",
    fromEmail: "ramesh.singh@retailos.gy",
    avatar: undefined,
    subject: "PO-2041 needs your approval (GYD 1,840,000)",
    preview:
      "Purchase order PO-2041 to Caribbean Wholesale Ltd exceeds the GYD 1,500,000 threshold.",
    body: "Purchase order PO-2041 to Caribbean Wholesale Ltd totals GYD 1,840,000, which exceeds the GYD 1,500,000 approval threshold for the New Amsterdam warehouse.\n\nLines: 80x cooking oil cartons, 50x flour 10kg, 200x canned goods assortment. Please approve or return for revision.",
    date: subHours(new Date(), 4),
    isRead: false,
    isStarred: false,
    labels: ["approvals", "finance"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-2-1",
          from: "Procurement — Ramesh Singh",
          fromEmail: "ramesh.singh@retailos.gy",
          body: "Purchase order PO-2041 to Caribbean Wholesale Ltd totals GYD 1,840,000, which exceeds the GYD 1,500,000 approval threshold for the New Amsterdam warehouse.\n\nLines: 80x cooking oil cartons, 50x flour 10kg, 200x canned goods assortment. Please approve or return for revision.",
          date: subHours(new Date(), 4),
        },
      ],
    },
  },
  {
    id: "msg-3",
    from: "Bond Desk",
    fromEmail: "bond@retailos.gy",
    avatar: undefined,
    subject: "Bond clearance ready: Import batch IB-0192",
    preview:
      "Customs duty and VAT have been assessed for import batch IB-0192. Ready for bond release.",
    body: "Customs duty (GYD 612,500) and VAT (GYD 245,000) have been assessed for import batch IB-0192 (electronics — 40 cartons). The shipment is cleared by GRA and ready for bond release to the Linden branch.\n\nApprove the bond release to post the released stock and the duty to landed cost.",
    date: subHours(new Date(), 9),
    isRead: true,
    isStarred: false,
    labels: ["approvals", "logistics"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-3-1",
          from: "Bond Desk",
          fromEmail: "bond@retailos.gy",
          body: "Customs duty (GYD 612,500) and VAT (GYD 245,000) have been assessed for import batch IB-0192 (electronics — 40 cartons). The shipment is cleared by GRA and ready for bond release to the Linden branch.\n\nApprove the bond release to post the released stock and the duty to landed cost.",
          date: subHours(new Date(), 9),
        },
      ],
    },
  },
  {
    id: "msg-4",
    from: "Store Manager — Bourda",
    fromEmail: "manager.bourda@retailos.gy",
    avatar: undefined,
    subject: "Shift Z-Report: Register 2 closed short by GYD 3,400",
    preview:
      "Evening shift closed. Drawer counted GYD 3,400 short against expected cash.",
    body: "Register 2 evening shift (cashier: Tricia Adams) closed with a blind count GYD 3,400 short against expected cash. Card and mobile-money settlements reconciled cleanly.\n\nI've flagged it for review — likely change error during the 6pm rush. Z-Report attached in the POS shift log.",
    date: subDays(new Date(), 1),
    isRead: false,
    isStarred: false,
    labels: ["finance", "operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-4-1",
          from: "Store Manager — Bourda",
          fromEmail: "manager.bourda@retailos.gy",
          body: "Register 2 evening shift (cashier: Tricia Adams) closed with a blind count GYD 3,400 short against expected cash. Card and mobile-money settlements reconciled cleanly.\n\nI've flagged it for review — likely change error during the 6pm rush. Z-Report attached in the POS shift log.",
          date: subDays(new Date(), 1),
        },
      ],
    },
  },
  {
    id: "msg-5",
    from: "Accounting",
    fromEmail: "accounting@retailos.gy",
    avatar: undefined,
    subject: "Invoice INV-3318 overdue — Parika Trading (GYD 920,000)",
    preview:
      "Wholesale customer Parika Trading is 21 days past due on INV-3318.",
    body: "Wholesale customer Parika Trading is 21 days past due on invoice INV-3318 for GYD 920,000. They are now within GYD 80,000 of their GYD 1,000,000 credit limit.\n\nRecommend a follow-up call before approving further credit sales. AR aging report updated.",
    date: subDays(new Date(), 2),
    isRead: true,
    isStarred: true,
    labels: ["finance", "alerts"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-5-1",
          from: "Accounting",
          fromEmail: "accounting@retailos.gy",
          body: "Wholesale customer Parika Trading is 21 days past due on invoice INV-3318 for GYD 920,000. They are now within GYD 80,000 of their GYD 1,000,000 credit limit.\n\nRecommend a follow-up call before approving further credit sales. AR aging report updated.",
          date: subDays(new Date(), 2),
        },
      ],
    },
  },
  {
    id: "msg-6",
    from: "Warehouse — New Amsterdam",
    fromEmail: "warehouse.na@retailos.gy",
    avatar: undefined,
    subject: "Transfer TRF-0771 awaiting receipt approval",
    preview:
      "60 cartons shipped from New Amsterdam to Linden are in transit and awaiting receipt.",
    body: "Stock transfer TRF-0771 (60 cartons mixed dry goods) was shipped from the New Amsterdam warehouse to the Linden branch and is now in transit.\n\nLinden, please confirm receipt against the transfer slip so the in-transit balance posts to your location.",
    date: subDays(new Date(), 2),
    isRead: false,
    isStarred: false,
    labels: ["logistics", "approvals"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-6-1",
          from: "Warehouse — New Amsterdam",
          fromEmail: "warehouse.na@retailos.gy",
          body: "Stock transfer TRF-0771 (60 cartons mixed dry goods) was shipped from the New Amsterdam warehouse to the Linden branch and is now in transit.\n\nLinden, please confirm receipt against the transfer slip so the in-transit balance posts to your location.",
          date: subDays(new Date(), 2),
        },
        {
          id: "msg-6-2",
          from: "Store Manager — Linden",
          fromEmail: "manager.linden@retailos.gy",
          body: "Received the truck this morning, counting now. Two cartons of cooking oil look damaged — will raise an adjustment if confirmed.",
          date: subDays(new Date(), 1),
        },
      ],
    },
  },
  {
    id: "msg-7",
    from: "Inventory System",
    fromEmail: "inventory@retailos.gy",
    avatar: undefined,
    subject: "Stock discrepancy flagged on cycle count CC-0444",
    preview:
      "Cycle count at Bourda found Powdered Milk 400g short by 8 units versus ledger.",
    body: "Cycle count CC-0444 at Georgetown — Bourda found Powdered Milk 400g (SKU MK-PD-400) short by 8 units versus the stock ledger. The variance is flagged for a manager-approved inventory adjustment.\n\nNo movement will post until the adjustment is approved (charter §22 approval workflow).",
    date: subDays(new Date(), 3),
    isRead: true,
    isStarred: false,
    labels: ["alerts", "operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-7-1",
          from: "Inventory System",
          fromEmail: "inventory@retailos.gy",
          body: "Cycle count CC-0444 at Georgetown — Bourda found Powdered Milk 400g (SKU MK-PD-400) short by 8 units versus the stock ledger. The variance is flagged for a manager-approved inventory adjustment.\n\nNo movement will post until the adjustment is approved (charter §22 approval workflow).",
          date: subDays(new Date(), 3),
        },
      ],
    },
  },
  {
    id: "msg-8",
    from: "Platform Ops",
    fromEmail: "ops@retailos.gy",
    avatar: undefined,
    subject: "Backup verification FAILED for Linden Edge Hub",
    preview:
      "Last night's local backup on the Linden Edge Hub could not be verified.",
    body: "The 03:00 local backup on the Linden Edge Hub completed but failed checksum verification. Unsynced offline transactions may be at risk if the hardware is lost before the next cloud sync.\n\nAction: check the USB backup medium and re-run the backup verification tool. Cloud sync is currently healthy.",
    date: subDays(new Date(), 3),
    isRead: false,
    isStarred: true,
    labels: ["alerts"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-8-1",
          from: "Platform Ops",
          fromEmail: "ops@retailos.gy",
          body: "The 03:00 local backup on the Linden Edge Hub completed but failed checksum verification. Unsynced offline transactions may be at risk if the hardware is lost before the next cloud sync.\n\nAction: check the USB backup medium and re-run the backup verification tool. Cloud sync is currently healthy.",
          date: subDays(new Date(), 3),
        },
      ],
    },
  },
  {
    id: "msg-9",
    from: "Procurement — Ramesh Singh",
    fromEmail: "ramesh.singh@retailos.gy",
    avatar: undefined,
    subject: "Supplier delay: Demerara Distributors pushed delivery 4 days",
    preview:
      "Demerara Distributors has rescheduled the flour and sugar delivery to next week.",
    body: "Demerara Distributors has rescheduled the flour and sugar delivery (PO-2033) by 4 days due to a vessel delay at the wharf. This may cause a stockout at Bourda over the weekend.\n\nShould I source a partial top-up locally to bridge the gap?",
    date: subDays(new Date(), 4),
    isRead: true,
    isStarred: false,
    labels: ["logistics", "operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-9-1",
          from: "Procurement — Ramesh Singh",
          fromEmail: "ramesh.singh@retailos.gy",
          body: "Demerara Distributors has rescheduled the flour and sugar delivery (PO-2033) by 4 days due to a vessel delay at the wharf. This may cause a stockout at Bourda over the weekend.\n\nShould I source a partial top-up locally to bridge the gap?",
          date: subDays(new Date(), 4),
        },
      ],
    },
  },
  {
    id: "msg-10",
    from: "POS Terminal — Register 1",
    fromEmail: "pos@retailos.gy",
    avatar: undefined,
    subject: "Terminal resynced after 2h offline window",
    preview:
      "Register 1 at Bourda reconnected and synced 38 queued offline sales successfully.",
    body: "Register 1 at Georgetown — Bourda reconnected after a 2-hour ISP outage and synced 38 queued offline sales, 12 payments, and 3 refunds. All idempotency keys validated; no duplicates detected.\n\nEnd-of-day local totals match the synced totals.",
    date: subDays(new Date(), 5),
    isRead: true,
    isStarred: false,
    labels: ["operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-10-1",
          from: "POS Terminal — Register 1",
          fromEmail: "pos@retailos.gy",
          body: "Register 1 at Georgetown — Bourda reconnected after a 2-hour ISP outage and synced 38 queued offline sales, 12 payments, and 3 refunds. All idempotency keys validated; no duplicates detected.\n\nEnd-of-day local totals match the synced totals.",
          date: subDays(new Date(), 5),
        },
      ],
    },
  },
  {
    id: "msg-11",
    from: "Pharmacy Desk",
    fromEmail: "pharmacy@retailos.gy",
    avatar: undefined,
    subject: "Expiry alert: 3 batches expiring within 30 days",
    preview:
      "FEFO check found 3 batches of medication nearing expiry at the Georgetown pharmacy.",
    body: "The FEFO expiry check found 3 batches nearing expiry within 30 days at the Georgetown pharmacy counter: Batch PARA-0231 (paracetamol), Batch AMOX-0118 (amoxicillin), Batch VITC-0455 (vitamin C).\n\nConsider a promotion or transfer to a higher-turnover branch before write-off.",
    date: subWeeks(new Date(), 1),
    isRead: true,
    isStarred: false,
    labels: ["alerts", "operations"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-11-1",
          from: "Pharmacy Desk",
          fromEmail: "pharmacy@retailos.gy",
          body: "The FEFO expiry check found 3 batches nearing expiry within 30 days at the Georgetown pharmacy counter: Batch PARA-0231 (paracetamol), Batch AMOX-0118 (amoxicillin), Batch VITC-0455 (vitamin C).\n\nConsider a promotion or transfer to a higher-turnover branch before write-off.",
          date: subWeeks(new Date(), 1),
        },
      ],
    },
  },
  {
    id: "msg-12",
    from: "HR & Payroll",
    fromEmail: "hr@retailos.gy",
    avatar: undefined,
    subject: "Commission statements ready for sales reps",
    preview:
      "October commission statements are generated for 6 sales reps across all branches.",
    body: "October commission statements are generated for 6 sales reps. Total accrued commission is GYD 412,300 across flat, percentage, and tiered rules. Two statements include refund and void adjustments.\n\nReview and approve before the payout run on the 5th.",
    date: subWeeks(new Date(), 1),
    isRead: true,
    isStarred: false,
    labels: ["finance"],
    status: "inbox",
    thread: {
      messages: [
        {
          id: "msg-12-1",
          from: "HR & Payroll",
          fromEmail: "hr@retailos.gy",
          body: "October commission statements are generated for 6 sales reps. Total accrued commission is GYD 412,300 across flat, percentage, and tiered rules. Two statements include refund and void adjustments.\n\nReview and approve before the payout run on the 5th.",
          date: subWeeks(new Date(), 1),
        },
      ],
    },
  },
  {
    id: "msg-13",
    from: MAIL_CURRENT_USER.name,
    fromEmail: MAIL_CURRENT_USER.email,
    to: "Procurement — Ramesh Singh",
    toEmail: "ramesh.singh@retailos.gy",
    avatar: undefined,
    subject: "Re: PO-2041 — approved with one change",
    preview:
      "Approved PO-2041, but reduce canned goods from 200 to 150 cartons.",
    body: "Approved PO-2041, but please reduce the canned goods assortment from 200 to 150 cartons — we're still carrying last month's stock at New Amsterdam. Resubmit and I'll release it for the GRN.",
    date: subDays(new Date(), 2),
    isRead: true,
    isStarred: false,
    labels: [],
    status: "sent",
    thread: {
      messages: [
        {
          id: "msg-13-1",
          from: MAIL_CURRENT_USER.name,
          fromEmail: MAIL_CURRENT_USER.email,
          body: "Approved PO-2041, but please reduce the canned goods assortment from 200 to 150 cartons — we're still carrying last month's stock at New Amsterdam. Resubmit and I'll release it for the GRN.",
          date: subDays(new Date(), 2),
          isFromMe: true,
        },
      ],
    },
  },
  {
    id: "msg-14",
    from: MAIL_CURRENT_USER.name,
    fromEmail: MAIL_CURRENT_USER.email,
    to: "Store Manager — Linden",
    toEmail: "manager.linden@retailos.gy",
    avatar: undefined,
    subject: "Bond release for IB-0192 — go ahead",
    preview:
      "Cleared the bond release for import batch IB-0192. Post the released stock today.",
    body: "I've cleared the bond release for import batch IB-0192. Post the released stock to Linden today and confirm the landed cost looks right after duty allocation. Flag me if the electronics serials don't all scan.",
    date: subDays(new Date(), 1),
    isRead: true,
    isStarred: false,
    labels: [],
    status: "sent",
    thread: {
      messages: [
        {
          id: "msg-14-1",
          from: MAIL_CURRENT_USER.name,
          fromEmail: MAIL_CURRENT_USER.email,
          body: "I've cleared the bond release for import batch IB-0192. Post the released stock to Linden today and confirm the landed cost looks right after duty allocation. Flag me if the electronics serials don't all scan.",
          date: subDays(new Date(), 1),
          isFromMe: true,
        },
      ],
    },
  },
  {
    id: "msg-15",
    from: MAIL_CURRENT_USER.name,
    fromEmail: MAIL_CURRENT_USER.email,
    to: "Accounting",
    toEmail: "accounting@retailos.gy",
    avatar: undefined,
    subject: "Draft: Parika Trading credit hold memo",
    preview:
      "Place a temporary credit hold on Parika Trading until INV-3318 is settled...",
    body: "Place a temporary credit hold on Parika Trading until INV-3318 is settled. Notify the wholesale desk so no further credit sales go through. Lift the hold automatically on payment.",
    date: subDays(new Date(), 1),
    isRead: true,
    isStarred: false,
    labels: [],
    status: "drafts",
    thread: {
      messages: [
        {
          id: "msg-15-1",
          from: MAIL_CURRENT_USER.name,
          fromEmail: MAIL_CURRENT_USER.email,
          body: "Place a temporary credit hold on Parika Trading until INV-3318 is settled. Notify the wholesale desk so no further credit sales go through. Lift the hold automatically on payment.",
          date: subDays(new Date(), 1),
          isFromMe: true,
        },
      ],
    },
  },
  {
    id: "msg-16",
    from: "Promotions Bot",
    fromEmail: "promo@deals.example",
    avatar: undefined,
    subject: "Boost your storefront with featured collections!!!",
    preview:
      "Unrelated marketing blast — flagged out of the operational inbox.",
    body: "Limited time offer — upgrade your storefront theme bundle today and get 3 months free! Click here to claim your exclusive merchant discount before it expires.",
    date: subDays(new Date(), 6),
    isRead: true,
    isStarred: false,
    labels: [],
    status: "spam",
    thread: {
      messages: [
        {
          id: "msg-16-1",
          from: "Promotions Bot",
          fromEmail: "promo@deals.example",
          body: "Limited time offer — upgrade your storefront theme bundle today and get 3 months free! Click here to claim your exclusive merchant discount before it expires.",
          date: subDays(new Date(), 6),
        },
      ],
    },
  },
  {
    id: "msg-17",
    from: "Ecommerce Storefront",
    fromEmail: "store@retailos.gy",
    avatar: undefined,
    subject: "Online order ORD-5582 ready for pickup at Bourda",
    preview:
      "A customer placed an online order for in-store pickup at the Georgetown branch.",
    body: "Online order ORD-5582 (GYD 14,600 — 3 items) was placed for in-store pickup at Georgetown — Bourda. Stock was reserved from the shared inventory ledger. The customer will collect after 2pm.\n\nPick, pack, and mark as fulfilled when collected.",
    date: subDays(new Date(), 4),
    isRead: true,
    isStarred: false,
    labels: ["operations", "logistics"],
    status: "archive",
    thread: {
      messages: [
        {
          id: "msg-17-1",
          from: "Ecommerce Storefront",
          fromEmail: "store@retailos.gy",
          body: "Online order ORD-5582 (GYD 14,600 — 3 items) was placed for in-store pickup at Georgetown — Bourda. Stock was reserved from the shared inventory ledger. The customer will collect after 2pm.\n\nPick, pack, and mark as fulfilled when collected.",
          date: subDays(new Date(), 4),
        },
      ],
    },
  },
  {
    id: "msg-18",
    from: "Accounting",
    fromEmail: "accounting@retailos.gy",
    avatar: undefined,
    subject: "Old reconciliation note — New Amsterdam drawer",
    preview:
      "Resolved cash discrepancy from last month's New Amsterdam reconciliation.",
    body: "The GYD 1,200 discrepancy from last month's New Amsterdam end-of-day reconciliation was traced to a mis-keyed mobile-money settlement and corrected with a balancing journal. Closing this thread.",
    date: subWeeks(new Date(), 3),
    isRead: true,
    isStarred: false,
    labels: ["finance"],
    status: "trash",
    thread: {
      messages: [
        {
          id: "msg-18-1",
          from: "Accounting",
          fromEmail: "accounting@retailos.gy",
          body: "The GYD 1,200 discrepancy from last month's New Amsterdam end-of-day reconciliation was traced to a mis-keyed mobile-money settlement and corrected with a balancing journal. Closing this thread.",
          date: subWeeks(new Date(), 3),
        },
      ],
    },
  },
];
