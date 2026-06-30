import { Card } from "@RetailOS/ui/components/card";
import {
  BookMarkedIcon,
  CreditCardIcon,
  DollarSignIcon,
  ShoppingCartIcon,
  TicketCheckIcon,
  WalletIcon,
} from "lucide-react";
import EarningInsightsCard from "./chart-earning-insights";
import ProductDatatable, { type Item } from "./datatable-product";
import StatisticsCard, { type StatisticsCardProps } from "./statistics-card-03";
import OrdersCard from "./widget-orders";
import PopularProductCard from "./widget-popular-product";
import UserOrderCard from "./widget-user-order";

// Statistics card data
const StatisticsCardData: StatisticsCardProps[] = [
  {
    icon: <TicketCheckIcon />,
    title: "Total Sales",
    value: "$13.4k",
    trend: "up",
    changePercentage: "+38%",
    badgeContent: "Last 6 months",
  },
  {
    icon: <ShoppingCartIcon />,
    title: "Total Orders",
    value: "155K",
    trend: "up",
    changePercentage: "+22%",
    badgeContent: "Last 4 months",
  },
  {
    icon: <DollarSignIcon />,
    title: "Total Profit",
    value: "$89.34k",
    trend: "down",
    changePercentage: "-16%",
    badgeContent: "Last One year",
  },
  {
    icon: <BookMarkedIcon />,
    title: "Bookmarks",
    value: "$1,200",
    trend: "up",
    changePercentage: "+38%",
    badgeContent: "Last 6 months",
  },
];

// Chart data
const earningReportChartData = [
  {
    day: "Monday",
    earning: 80,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
  {
    day: "Tuesday",
    earning: 126,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
  {
    day: "Wednesday",
    earning: 105,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
  { day: "Thursday", earning: 180, fill: "var(--primary)" },
  {
    day: "Friday",
    earning: 123,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
  {
    day: "Saturday",
    earning: 131,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
  {
    day: "Sunday",
    earning: 143,
    fill: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
];

// Stat data
const statData = [
  {
    icon: <WalletIcon />,
    title: "Earning",
    amount: "$1,236",
    progress: 50,
  },
  {
    icon: <DollarSignIcon />,
    title: "Profit",
    amount: "$2,300",
    progress: 75,
  },
  {
    icon: <CreditCardIcon />,
    title: "Expense",
    amount: "$1,500",
    progress: 75,
  },
];

// Popular products data
const Products = [
  {
    img: "/images/widgets/image-1.webp",
    productName: "Nike Vision Low Shoes",
    price: "$5,600",
    visits: "10.6K",
  },
  {
    img: "/images/widgets/image-2.webp",
    productName: "Adidas Ultraboost 21",
    price: "$4,500",
    visits: "4.5K",
  },
  {
    img: "/images/widgets/image-3.webp",
    productName: "Puma RS-X Toys",
    price: "$3,200",
    visits: "2K",
  },
  {
    img: "/images/widgets/image-4.webp",
    productName: "New Balance 550",
    price: "$2,800",
    visits: "1.8K",
  },
  {
    img: "/images/widgets/image-5.webp",
    productName: "Reebok Classic Leather",
    price: "$2,200",
    visits: "1.2K",
  },
];

const productData: Item[] = [
  {
    id: "1",
    productImage: "/images/datatable/image-3.webp",
    product: "Samsung galaxy s35",
    brand: "Samsung",
    category: "smartphone",
    stock: "available",
    amount: 312,
    quantity: 45,
    status: "publish",
  },
  {
    id: "2",
    productImage: "/images/datatable/image-4.webp",
    product: "Apple MacBook Pro",
    brand: "Apple",
    category: "laptop",
    stock: "unavailable",
    amount: 890,
    quantity: 634,
    status: "publish",
  },
  {
    id: "3",
    productImage: "/images/datatable/image-5.webp",
    product: "Sony WH-1000XM4",
    brand: "Sony",
    category: "headphone",
    stock: "available",
    amount: 120,
    quantity: 456,
    status: "inactive",
  },
  {
    id: "4",
    productImage: "/images/datatable/image-6.webp",
    product: "Dell XPS 13",
    brand: "Dell",
    category: "laptop",
    stock: "unavailable",
    amount: 112,
    quantity: 4,
    status: "publish",
  },
  {
    id: "5",
    productImage: "/images/datatable/image-7.webp",
    product: "Smart band 4",
    brand: "Xiaomi",
    category: "smartwatch",
    stock: "unavailable",
    amount: 150,
    quantity: 45,
    status: "inactive",
  },
  {
    id: "6",
    productImage: "/images/datatable/image-8.webp",
    product: "Sony PlayStation 5",
    brand: "Sony",
    category: "controller",
    stock: "available",
    amount: 520,
    quantity: 56,
    status: "publish",
  },
  {
    id: "7",
    productImage: "/images/datatable/image-9.webp",
    product: "OnePlus 15 Pro",
    brand: "OnePlus",
    category: "smartphone",
    stock: "available",
    amount: 1200,
    quantity: 89,
    status: "publish",
  },
  {
    id: "8",
    productImage: "/images/datatable/image-10.webp",
    product: "Apple magic mouse",
    brand: "Apple",
    category: "laptop",
    stock: "available",
    amount: 980,
    quantity: 23,
    status: "scheduled",
  },
  {
    id: "9",
    productImage: "/images/datatable/image-11.webp",
    product: "Wooden Chair",
    brand: "Ikea",
    category: "furniture",
    stock: "unavailable",
    amount: 280,
    quantity: 67,
    status: "publish",
  },
  {
    id: "10",
    productImage: "/images/datatable/image-12.webp",
    product: "Nike Jordan 1",
    brand: "Nike",
    category: "fashion",
    stock: "available",
    amount: 450,
    quantity: 134,
    status: "publish",
  },
  {
    id: "11",
    productImage: "/images/datatable/image-13.webp",
    product: "Nintendo Switch Pro",
    brand: "Nintendo",
    category: "controller",
    stock: "available",
    amount: 499,
    quantity: 78,
    status: "publish",
  },
  {
    id: "12",
    productImage: "/images/datatable/image-14.webp",
    product: "Apple Watch 2",
    brand: "Apple",
    category: "smartwatch",
    stock: "unavailable",
    amount: 699,
    quantity: 45,
    status: "inactive",
  },
  {
    id: "13",
    productImage: "/images/datatable/image-15.webp",
    product: "Samsung Note 10 Pro",
    brand: "Samsung",
    category: "smartphone",
    stock: "available",
    amount: 1150,
    quantity: 12,
    status: "scheduled",
  },
  {
    id: "14",
    productImage: "/images/datatable/image-16.webp",
    product: "Ray Ban Aviator",
    brand: "Ray Ban",
    category: "fashion",
    stock: "available",
    amount: 249,
    quantity: 203,
    status: "publish",
  },
  {
    id: "15",
    productImage: "/images/datatable/image-4.webp",
    product: "Macbook Air M2",
    brand: "Apple",
    category: "laptop",
    stock: "unavailable",
    amount: 349,
    quantity: 156,
    status: "inactive",
  },
  {
    id: "16",
    productImage: "/images/datatable/image-6.webp",
    product: "Samsung Book 6",
    brand: "Samsung",
    category: "laptop",
    stock: "available",
    amount: 329,
    quantity: 87,
    status: "publish",
  },
  {
    id: "17",
    productImage: "/images/datatable/image-10.webp",
    product: "Apple Magic Mouse 2",
    brand: "Apple",
    category: "laptop",
    stock: "available",
    amount: 799,
    quantity: 67,
    status: "publish",
  },
  {
    id: "18",
    productImage: "/images/datatable/image-16.webp",
    product: "Ray Ban EyeCat",
    brand: "Ray Ban",
    category: "fashion",
    stock: "available",
    amount: 1399,
    quantity: 34,
    status: "scheduled",
  },
  {
    id: "19",
    productImage: "/images/datatable/image-8.webp",
    product: "Xbox Series X",
    brand: "Microsoft",
    category: "controller",
    stock: "unavailable",
    amount: 499,
    quantity: 28,
    status: "inactive",
  },
  {
    id: "20",
    productImage: "/images/datatable/image-4.webp",
    product: "Macbook Pro M4",
    brand: "Apple",
    category: "laptop",
    stock: "available",
    amount: 699,
    quantity: 19,
    status: "publish",
  },
  {
    id: "21",
    productImage: "/images/datatable/image-8.webp",
    product: "Play Station 4",
    brand: "Sony",
    category: "controller",
    stock: "available",
    amount: 649,
    quantity: 89,
    status: "scheduled",
  },
  {
    id: "22",
    productImage: "/images/datatable/image-15.webp",
    product: "Xiaomi 14 Ultra",
    brand: "Xiaomi",
    category: "smartphone",
    stock: "unavailable",
    amount: 899,
    quantity: 43,
    status: "inactive",
  },
  {
    id: "23",
    productImage: "/images/datatable/image-11.webp",
    product: "Rocking Chair",
    brand: "Ikea",
    category: "furniture",
    stock: "available",
    amount: 1299,
    quantity: 76,
    status: "publish",
  },
  {
    id: "24",
    productImage: "/images/datatable/image-12.webp",
    product: "Nike Air Max",
    brand: "Nike",
    category: "fashion",
    stock: "available",
    amount: 149,
    quantity: 234,
    status: "publish",
  },
  {
    id: "25",
    productImage: "/images/datatable/image-7.webp",
    product: "Fitbit Versa 4",
    brand: "Fitbit",
    category: "smartwatch",
    stock: "available",
    amount: 199,
    quantity: 167,
    status: "scheduled",
  },
];

const ECommerceDashboard = () => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-6">
      {/* Statistics cards */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:col-span-2">
        {StatisticsCardData.map((card) => (
          <StatisticsCard
            badgeContent={card.badgeContent}
            changePercentage={card.changePercentage}
            icon={card.icon}
            key={card.title}
            title={card.title}
            trend={card.trend}
            value={card.value}
          />
        ))}
      </div>

      {/* Earning insights chart */}
      <EarningInsightsCard
        changePercentage={10}
        chartData={earningReportChartData}
        className="col-span-full lg:max-xl:-order-1 xl:col-span-4"
        description="Earning of this week compared to last week. it's increasing keep it up."
        statData={statData}
        subTitle="Weekly Earning overview"
        title="Earning insights"
        totalEarning="$4.6K"
        trend="up"
      />

      {/* Seller orders */}
      <UserOrderCard className="xl:col-span-2" />

      {/* Orders */}
      <OrdersCard className="xl:col-span-2" />

      {/* Popular products */}
      <PopularProductCard
        className="xl:col-span-2"
        productsData={Products}
        subTitle="Total 10.4K visitors"
        title="Popular product"
      />

      {/* Product datatable */}
      <Card className="col-span-full py-0">
        <ProductDatatable data={productData} />
      </Card>
    </div>
  );
};

export default ECommerceDashboard;
