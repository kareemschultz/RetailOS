export type FeatureValue = boolean | string;

export type PricingPlanIconKey = "sprout" | "flower" | "flower2";

export type PricingFeatureIconKey = "chart-line" | "rocket" | "users-round";

export interface PricingFeatureItem {
  name: string;
  values: FeatureValue[];
}

export interface PricingFeature {
  category: string;
  features: PricingFeatureItem[];
  icon: PricingFeatureIconKey;
}

export interface PricingPlan {
  buttonText: string;
  icon: PricingPlanIconKey;
  isPopular?: boolean;
  period: string;
  price: {
    yearly: number;
    monthly: number;
  };
  title: string;
}

export interface PricingData {
  features: PricingFeature[];
  plans: PricingPlan[];
}

export const pricingData: PricingData = {
  plans: [
    {
      icon: "sprout",
      title: "Essential Plan",
      price: {
        yearly: 24,
        monthly: 29,
      },
      period: "/month",
      buttonText: "Basic Access",
      isPopular: false,
    },
    {
      icon: "flower",
      title: "Advanced Plan",
      price: {
        yearly: 39,
        monthly: 49,
      },
      period: "/month",
      buttonText: "Premium Access",
      isPopular: true,
    },
    {
      icon: "flower2",
      title: "Pro Plan",
      price: {
        yearly: 80,
        monthly: 99,
      },
      period: "/month",
      buttonText: "Elite Access",
      isPopular: false,
    },
  ],
  features: [
    {
      category: "Core Analytics",
      icon: "chart-line",
      features: [
        {
          name: "Real-time dashboard",
          values: [true, true, true],
        },
        {
          name: "Key metrics",
          values: [true, true, true],
        },
        {
          name: "Custom date range & filters",
          values: [true, true, true],
        },
        {
          name: "Product performance insights",
          values: [true, true, true],
        },
        {
          name: "Growth trends",
          values: [false, true, true],
        },
        {
          name: "Goal & target tracking",
          values: ["Basic", "Advanced", "Advanced"],
        },
        {
          name: "Data export (CSV / PDF)",
          values: ["CSV", "CSV + PDF", "CSV + PDF"],
        },
      ],
    },
    {
      category: "Growth Insights",
      icon: "rocket",
      features: [
        {
          name: "User engagement insights",
          values: ["Basic", "Advanced", "Advanced"],
        },
        {
          name: "Conversion funnels",
          values: [false, true, true],
        },
        {
          name: "Audience segmentation",
          values: [false, "Limited", "Unlimited"],
        },
        {
          name: "Performance comparisons",
          values: [false, false, true],
        },
        {
          name: "Retention & cohort analysis",
          values: [false, true, true],
        },
      ],
    },
    {
      category: "Team & Support",
      icon: "users-round",
      features: [
        {
          name: "Team members",
          values: ["1", "Up to 3", "10+"],
        },
        {
          name: "Integrations & API",
          values: ["Limited", "Standard", "Unlimited"],
        },
        {
          name: "Support level",
          values: ["Email", "Priority", "Dedicated"],
        },
      ],
    },
  ],
};
