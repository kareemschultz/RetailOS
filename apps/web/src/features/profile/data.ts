import type { UserProfilePageData } from "@/features/profile/types";

export const db: UserProfilePageData = {
  // About Section - Profile Section Data
  profileSections: [
    {
      title: "About",
      items: [
        { iconKey: "UserIcon", label: "Full Name", value: "John Doe" },
        { iconKey: "CheckCheckIcon", label: "Status", value: "Active" },
        { iconKey: "StarIcon", label: "Role", value: "Developer" },
        { iconKey: "FlagIcon", label: "Country", value: "USA" },
        { iconKey: "LanguagesIcon", label: "Languages", value: "English" },
      ],
    },
    {
      title: "Contacts",
      items: [
        { iconKey: "PhoneIcon", label: "Contact", value: "(123) 456-7890" },
        { iconKey: "MessagesSquareIcon", label: "Skype", value: "John.doe" },
        { iconKey: "MailIcon", label: "Email", value: "john.doe@example.com" },
      ],
    },
    {
      title: "Teams",
      items: [
        { label: "Backend Developer", value: "(126 Members)" },
        { label: "React Developer", value: "(34 Members)" },
      ],
    },
  ],
  overviewSections: [
    {
      title: "Overview",
      items: [
        { iconKey: "CheckIcon", label: "Task Compiled", value: "13.5k" },
        { iconKey: "UserIcon", label: "Connections", value: "897" },
        { iconKey: "LayoutGridIcon", label: "Projects Compiled", value: "146" },
      ],
    },
  ],

  // Activity Timeline - Profile Section Data
  activityLog: [
    {
      id: 1,
      description: "12 Invoices have been paid",
      timestamp: "12 min ago",
      detail: "Invoices have been paid to the company.",
      attachment: {
        name: "invoice.pdf",
        fileType: "pdf",
      },
    },
    {
      id: 2,
      description: "Client Meeting",
      timestamp: "45 min ago",
      detail: "Project meeting with john @10:15am",
      person: {
        name: "Lester McCarthy (Client)",
        initials: "LM",
        role: "CEO of ThemeSelection",
        avatar: "/images/avatars/avatar-3.webp",
      },
    },
    {
      id: 3,
      description: "Create a new project for client",
      timestamp: "2 Day Ago",
      detail: "6 team members in a project",
      teamMembers: [
        {
          name: "Alex Carter",
          initials: "AC",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Mia Stewart",
          initials: "MS",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Noah Wilson",
          initials: "NW",
          avatar: "/images/avatars/avatar-4.webp",
        },
      ],
      teamExtraCount: 3,
    },
  ],

  // Project - Profile Section Data
  projectDatatable: [
    {
      id: "upp-001",
      name: "Atlas CRM Revamp",
      type: "Figma Project",
      logo: "/images/brands/figma-icon.webp",
      logoDark: "/images/brands/figma-icon.webp",
      leader: "Olivia Reed",
      team: [
        { avatar: "/images/avatars/avatar-1.webp", initials: "OR" },
        { avatar: "/images/avatars/avatar-3.webp", initials: "JD" },
      ],
      teamExtraCount: 2,
      progress: 82,
      updatedAt: "Updated 2 days ago",
    },
    {
      id: "upp-002",
      name: "Nimbus Analytics Portal",
      type: "Next Project",
      logo: "/images/brands/next-logo.webp",
      logoDark: "/images/brands/next-logo-dark.webp",
      leader: "Liam Cooper",
      team: [
        { avatar: "/images/avatars/avatar-2.webp", initials: "LC" },
        { avatar: "/images/avatars/avatar-4.webp", initials: "MP" },
      ],
      teamExtraCount: 1,
      progress: 64,
      updatedAt: "Updated 5 days ago",
    },
    {
      id: "upp-003",
      name: "Shadcn UI Admin Dashboard",
      type: "Shadcn Project",
      logo: "/images/brands/shadcn-logo.webp",
      logoDark: "/images/brands/shadcn-logo.webp",
      leader: "Sophia Patel",
      team: [
        { avatar: "/images/avatars/avatar-5.webp", initials: "SP" },
        { initials: "AL" },
      ],
      teamExtraCount: 3,
      progress: 47,
      updatedAt: "Updated 1 day ago",
    },
    {
      id: "upp-004",
      name: "Vertex System",
      type: "Laravel Project",
      logo: "/images/brands/laravel-logo.webp",
      logoDark: "/images/brands/laravel-logo.webp",
      leader: "Noah Bennett",
      team: [
        { avatar: "/images/avatars/avatar-7.webp", initials: "NB" },
        { avatar: "/images/avatars/avatar-8.webp", initials: "EA" },
        { initials: "RB" },
      ],
      teamExtraCount: 2,
      progress: 91,
      updatedAt: "Updated 3 days ago",
    },
    {
      id: "upp-005",
      name: "Pulse API Gateway",
      type: "MCP Project",
      logo: "/images/brands/mcp-icon.webp",
      logoDark: "/images/brands/mcp-icon-dark.webp",
      leader: "Ava Collins",
      team: [
        { avatar: "/images/avatars/avatar-9.webp", initials: "AC" },
        { avatar: "/images/avatars/avatar-10.webp", initials: "DN" },
      ],
      teamExtraCount: 1,
      progress: 58,
      updatedAt: "Updated 6 days ago",
    },
    {
      id: "upp-006",
      name: "eCommerce Website",
      type: "React Project",
      logo: "/images/brands/react-logo.webp",
      logoDark: "/images/brands/react-logo.webp",
      leader: "Ethan Miles",
      team: [
        { avatar: "/images/avatars/avatar-11.webp", initials: "EM" },
        { avatar: "/images/avatars/avatar-12.webp", initials: "HS" },
      ],
      teamExtraCount: 4,
      progress: 36,
      updatedAt: "Updated 4 days ago",
    },
    {
      id: "upp-007",
      name: "Mercury Billing Engine",
      type: "MCP Project",
      logo: "/images/brands/mcp-icon.webp",
      logoDark: "/images/brands/mcp-icon-dark.webp",
      leader: "Mia Turner",
      team: [
        { avatar: "/images/avatars/avatar-1.webp", initials: "MT" },
        { avatar: "/images/avatars/avatar-6.webp", initials: "CK" },
        { initials: "FG" },
      ],
      teamExtraCount: 0,
      progress: 73,
      updatedAt: "Updated 7 days ago",
    },
    {
      id: "upp-008",
      name: "Quasar Support Desk",
      type: "Next Project",
      logo: "/images/brands/next-logo.webp",
      logoDark: "/images/brands/next-logo-dark.webp",
      leader: "Jacob Lee",
      team: [
        { avatar: "/images/avatars/avatar-3.webp", initials: "JL" },
        { avatar: "/images/avatars/avatar-8.webp", initials: "RW" },
        { initials: "NH" },
      ],
      teamExtraCount: 0,
      progress: 69,
      updatedAt: "Updated 8 days ago",
    },
    {
      id: "upp-009",
      name: "Beacon Knowledge Base",
      type: "Nuxt Project",
      logo: "/images/brands/github-icon.webp",
      logoDark: "/images/brands/github-white.webp",
      leader: "Isabella Gray",
      team: [
        { avatar: "/images/avatars/avatar-4.webp", initials: "IG" },
        { avatar: "/images/avatars/avatar-9.webp", initials: "PS" },
      ],
      teamExtraCount: 3,
      progress: 54,
      updatedAt: "Updated 10 days ago",
    },
    {
      id: "upp-010",
      name: "Figma Design System",
      type: "UI Project",
      logo: "/images/brands/figma-icon.webp",
      logoDark: "/images/brands/figma-icon.webp",
      leader: "Henry Foster",
      team: [
        { avatar: "/images/avatars/avatar-2.webp", initials: "HF" },
        { avatar: "/images/avatars/avatar-5.webp", initials: "KT" },
        { initials: "UE" },
      ],
      teamExtraCount: 2,
      progress: 88,
      updatedAt: "Updated 12 days ago",
    },
  ],

  // Connections - Profile Section Data
  connectionActions: ["Share", "Suggest Edits", "Report Bug"],
  connections: [
    {
      id: 1,
      name: "Cecilia Payne",
      initials: "CP",
      avatar: "/images/avatars/avatar-1.webp",
      totalConnections: "45 Connections",
      isConnected: false,
    },
    {
      id: 2,
      name: "Curtis Fletcher",
      initials: "CF",
      avatar: "/images/avatars/avatar-2.webp",
      totalConnections: "1.32k Connections",
      isConnected: true,
    },
    {
      id: 3,
      name: "Alice Stone",
      initials: "AS",
      avatar: "/images/avatars/avatar-3.webp",
      totalConnections: "125 Connections",
      isConnected: true,
    },
    {
      id: 4,
      name: "Darrell Barnes",
      initials: "DB",
      avatar: "/images/avatars/avatar-4.webp",
      totalConnections: "456 Connections",
      isConnected: false,
    },
    {
      id: 5,
      name: "Eugenia Moore",
      initials: "EM",
      avatar: "/images/avatars/avatar-5.webp",
      totalConnections: "1.2k Connections",
      isConnected: false,
    },
  ],

  // Connections Card - Connection Section Data
  connectionCardActions: ["Share Connection", "Block Connection", "Delete"],
  connectionCards: [
    {
      id: 1,
      name: "Mark Gilbert",
      role: "UI Designer",
      initials: "MG",
      avatar: "/images/avatars/avatar-1.webp",
      tags: [{ label: "Figma" }, { label: "Sketch" }],
      stats: {
        projects: "18",
        tasks: "834",
        connections: "129",
      },
      totalConnections: "129 Connections",
      isConnected: true,
    },
    {
      id: 2,
      name: "Eugenia Parsons",
      role: "Developer",
      initials: "EP",
      avatar: "/images/avatars/avatar-2.webp",
      tags: [{ label: "Angular" }, { label: "React" }],
      stats: {
        projects: "112",
        tasks: "2.31k",
        connections: "1.28k",
      },
      totalConnections: "1.28k Connections",
      isConnected: false,
    },
    {
      id: 3,
      name: "Francis Byrd",
      role: "Developer",
      initials: "FB",
      avatar: "/images/avatars/avatar-3.webp",
      tags: [{ label: "HTML" }, { label: "React" }],
      stats: {
        projects: "32",
        tasks: "1.25k",
        connections: "890",
      },
      totalConnections: "890 Connections",
      isConnected: false,
    },
    {
      id: 4,
      name: "Leon Lucas",
      role: "UI/UX Designer",
      initials: "LL",
      avatar: "/images/avatars/avatar-4.webp",
      tags: [{ label: "Figma" }, { label: "Sketch" }, { label: "Photoshop" }],
      stats: {
        projects: "86",
        tasks: "12.4k",
        connections: "890",
      },
      totalConnections: "890 Connections",
      isConnected: false,
    },
    {
      id: 5,
      name: "Jayden Rogers",
      role: "Full Stack Developer",
      initials: "JR",
      avatar: "/images/avatars/avatar-5.webp",
      tags: [{ label: "React" }, { label: "HTML" }, { label: "Node.js" }],
      stats: {
        projects: "244",
        tasks: "23.8k",
        connections: "2.14k",
      },
      totalConnections: "2.14k Connections",
      isConnected: true,
    },
    {
      id: 6,
      name: "Jeanette Powell",
      role: "SEO",
      initials: "JP",
      avatar: "/images/avatars/avatar-6.webp",
      tags: [{ label: "Analysis" }, { label: "Writing" }],
      stats: {
        projects: "32",
        tasks: "1.28k",
        connections: "1.27k",
      },
      totalConnections: "1.27k Connections",
      isConnected: false,
    },
  ],

  // Team Card - Team Section Data
  teamCardActions: ["Rename Team", "View Details", "Add to Favorite", "Delete"],
  teamCards: [
    {
      id: 1,
      title: "React Developers",
      description:
        "We don't make assumptions about your technology stack, so you can develop features in React.",
      initials: "RD",
      avatar: "/images/brands/react-logo.webp",
      avatarDark: "/images/brands/react-logo.webp",
      members: [
        {
          name: "Ava Moore",
          initials: "AM",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Liam Clark",
          initials: "LC",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Noah Wilson",
          initials: "NW",
          avatar: "/images/avatars/avatar-4.webp",
        },
      ],
      extraMembersCount: 9,
      tags: [
        {
          label: "React",
        },
        { label: "MUI" },
      ],
    },
    {
      id: 2,
      title: "Shadcn Team",
      description:
        "The development of Shadcn and its ecosystem is guided by an international team, some of whom have chosen.",
      initials: "SD",
      avatar: "/images/brands/shadcn-logo.webp",
      avatarDark: "/images/brands/shadcn-logo.webp",
      members: [
        {
          name: "Ethan Ross",
          initials: "ER",
          avatar: "/images/avatars/avatar-8.webp",
        },
        {
          name: "Mia Stewart",
          initials: "MS",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "David Park",
          initials: "DP",
          avatar: "/images/avatars/avatar-7.webp",
        },
      ],
      extraMembersCount: 4,
      tags: [
        {
          label: "Shadcn",
        },
        { label: "Developer" },
      ],
    },
    {
      id: 3,
      title: "Creative Designers",
      description:
        "A design or product team is more than just the people on it. A team includes the people, the roles they play.",
      initials: "CD",
      avatar: "/images/brands/figma-icon.webp",
      avatarDark: "/images/brands/figma-icon.webp",
      members: [
        {
          name: "Ella King",
          initials: "EK",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Iris Hill",
          initials: "IH",
          avatar: "/images/avatars/avatar-3.webp",
        },
        {
          name: "Owen Gray",
          initials: "OG",
          avatar: "/images/avatars/avatar-4.webp",
        },
      ],
      tags: [
        {
          label: "Sketch",
        },
        { label: "XD" },
      ],
    },
    {
      id: 4,
      title: "Support Team",
      description:
        "Support your team. Your customer support team is fielding the good, the bad, and the ugly day in and day out.",
      initials: "ST",
      avatar: "/images/brands/discord.webp",
      avatarDark: "/images/brands/discord.webp",
      members: [
        {
          name: "Luke James",
          initials: "LJ",
          avatar: "/images/avatars/avatar-8.webp",
        },
        {
          name: "Aiden Cole",
          initials: "AC",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Jade Scott",
          initials: "JS",
          avatar: "/images/avatars/avatar-7.webp",
        },
      ],
      tags: [
        {
          label: "Support",
        },
      ],
    },
    {
      id: 5,
      title: "Digital Marketing",
      description:
        "Digital marketing refers to advertising delivered through digital channels such as search engines, websites...",
      initials: "DM",
      avatar: "/images/brands/twitter-icon.webp",
      avatarDark: "/images/brands/twitter-icon.webp",
      members: [
        {
          name: "Nina Wood",
          initials: "NW",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Hugo Price",
          initials: "HP",
          avatar: "/images/avatars/avatar-3.webp",
        },
        {
          name: "Tom Shaw",
          initials: "TS",
          avatar: "/images/avatars/avatar-4.webp",
        },
      ],
      extraMembersCount: 7,
      tags: [
        {
          label: "Twitter",
        },
        { label: "Social Media" },
      ],
    },
    {
      id: 6,
      title: "Event",
      description:
        "Event marketing is a strategy that involves face-to-face contact between companies and their customers at special events like concerts, festivals, and conferences.",
      initials: "PD",
      avatar: "/images/brands/google-icon.webp",
      avatarDark: "/images/brands/google-icon.webp",
      members: [
        {
          name: "Leo Dunn",
          initials: "LD",
          avatar: "/images/avatars/avatar-8.webp",
        },
        {
          name: "Ruby Bell",
          initials: "RB",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Max Ford",
          initials: "MF",
          avatar: "/images/avatars/avatar-7.webp",
        },
      ],
      tags: [
        {
          label: "Event",
        },
      ],
    },
    {
      id: 7,
      title: "Next.js Team",
      description:
        "Next.js is a React framework that enables functionality such as server-side rendering and generating static websites for React-based web applications.",
      initials: "NT",
      avatar: "/images/brands/next-logo.webp",
      avatarDark: "/images/brands/next-logo-dark.webp",
      members: [
        {
          name: "John Burns",
          initials: "JB",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Jacob Doe",
          initials: "JD",
          avatar: "/images/avatars/avatar-5.webp",
        },
        {
          name: "Maxton HHall",
          initials: "MH",
          avatar: "/images/avatars/avatar-1.webp",
        },
      ],
      tags: [
        {
          label: "Next.js",
        },
      ],
    },
    {
      id: 8,
      title: "Animation Team",
      description:
        "Animation is a creative process that involves creating moving images and visual effects for various media, including films, television, and digital platforms.",
      initials: "AT",
      avatar: "/images/brands/motion-logo.webp",
      avatarDark: "/images/brands/motion-logo.webp",
      members: [
        {
          name: "Dutt M",
          initials: "DM",
          avatar: "/images/avatars/avatar-6.webp",
        },
        {
          name: "Michaela Brown",
          initials: "MB",
          avatar: "/images/avatars/avatar-9.webp",
        },
        {
          name: "Hardy Stone",
          initials: "HS",
          avatar: "/images/avatars/avatar-3.webp",
        },
      ],
      tags: [
        {
          label: "Animation",
        },
      ],
    },
    {
      id: 9,
      title: "MCP Team",
      description:
        "A cross-functional team that develops and manages Model Context Protocol solutions and scalable communication between AI applications",
      initials: "MT",
      avatar: "/images/brands/mcp-icon.webp",
      avatarDark: "/images/brands/mcp-icon-dark.webp",
      extraMembersCount: 4,
      members: [
        {
          name: "Jordon Cox",
          initials: "JC",
          avatar: "/images/avatars/avatar-7.webp",
        },
        {
          name: "Jane Doe",
          initials: "JD",
          avatar: "/images/avatars/avatar-10.webp",
        },
        {
          name: "Harry Smith",
          initials: "HS",
          avatar: "/images/avatars/avatar-11.webp",
        },
      ],
      tags: [
        {
          label: "MCP",
        },
      ],
    },
  ],

  // Projects Card - Projects Section Data
  projectCardActions: [
    "Rename Project",
    "View Details",
    "Add to Favorite",
    "Delete",
  ],
  projectCards: [
    {
      id: 1,
      title: "Social Banners",
      client: "Christian Jimenez",
      initials: "SB",
      logo: "/images/brands/twitter-icon.webp",
      logoDark: "/images/brands/twitter-icon.webp",
      budgetSpent: "$24.8k",
      budgetTotal: "$18.2k",
      startDate: "14/2/21",
      deadline: "28/2/22",
      description:
        "We are Consulting, Software Development and Web Development Services.",
      allHours: "380/244",
      tasks: "328/344",
      completion: 95,
      daysLeftLabel: "28 days left",
      daysLeftTone: "success",
      members: [
        {
          name: "Ava Moore",
          initials: "AM",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Mia Stewart",
          initials: "MS",
          avatar: "/images/avatars/avatar-3.webp",
        },
        {
          name: "Noah Wilson",
          initials: "NW",
          avatar: "/images/avatars/avatar-4.webp",
        },
      ],
      membersLabel: "280 members",
      commentsCount: "15",
    },
    {
      id: 2,
      title: "Create Website",
      client: "Hulda Wright",
      initials: "CW",
      logo: "/images/brands/react-logo.webp",
      logoDark: "/images/brands/react-logo.webp",
      budgetSpent: "$8.5k",
      budgetTotal: "2.43k",
      startDate: "10/2/19",
      deadline: "12/9/22",
      description:
        "Your domain name should reflect your products or services so that your...",
      allHours: "380/820",
      tasks: "302/420",
      completion: 72,
      daysLeftLabel: "126 days left",
      daysLeftTone: "warning",
      members: [
        {
          name: "Aiden Cole",
          initials: "AC",
          avatar: "/images/avatars/avatar-3.webp",
        },
        {
          name: "Tom Shaw",
          initials: "TS",
          avatar: "/images/avatars/avatar-4.webp",
        },
        {
          name: "Ruby Bell",
          initials: "RB",
          avatar: "/images/avatars/avatar-2.webp",
        },
      ],
      membersLabel: "137 members",
      commentsCount: "120",
    },
    {
      id: 3,
      title: "Admin Template",
      client: "Jeffrey Phillips",
      initials: "AT",
      logo: "/images/brands/next-logo.webp",
      logoDark: "/images/brands/next-logo-dark.webp",
      budgetSpent: "$2.4k",
      budgetTotal: "$1.8k",
      startDate: "18/8/21",
      deadline: "21/6/22",
      description:
        "Time is our most valuable asset, that's why we want to help you save it.",
      allHours: "98/135",
      tasks: "38/90",
      completion: 42,
      daysLeftLabel: "15 days left",
      daysLeftTone: "warning",
      members: [
        {
          name: "Ethan Ross",
          initials: "ER",
          avatar: "/images/avatars/avatar-8.webp",
        },
        {
          name: "Liam Clark",
          initials: "LC",
          avatar: "/images/avatars/avatar-1.webp",
        },
        {
          name: "Ruby Bell",
          initials: "RB",
          avatar: "/images/avatars/avatar-2.webp",
        },
      ],
      membersLabel: "1.1k members",
      commentsCount: "236",
    },
    {
      id: 4,
      title: "Figma Dashboard",
      client: "Jerry Greene",
      initials: "FD",
      logo: "/images/brands/figma-icon.webp",
      logoDark: "/images/brands/figma-icon.webp",
      budgetSpent: "$52.7k",
      budgetTotal: "28.4k",
      startDate: "12/12/20",
      deadline: "25/12/21",
      description:
        "Time is our most valuable asset, that's why we want to help you save it.",
      allHours: "142/420",
      tasks: "100/285",
      completion: 35,
      daysLeftLabel: "5 day left",
      daysLeftTone: "danger",
      members: [
        {
          name: "Luke James",
          initials: "LJ",
          avatar: "/images/avatars/avatar-8.webp",
        },
        {
          name: "Mia Stewart",
          initials: "MS",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Jade Scott",
          initials: "JS",
          avatar: "/images/avatars/avatar-7.webp",
        },
      ],
      membersLabel: "82 members",
      commentsCount: "20",
    },
    {
      id: 5,
      title: "CI/CD Pipeline",
      client: "Ricky McDonald",
      initials: "AD",
      logo: "/images/brands/github-icon.webp",
      logoDark: "/images/brands/github-white.webp",
      budgetSpent: "$980",
      budgetTotal: "$420",
      startDate: "24/7/21",
      deadline: "8/10/21",
      description:
        "CI/CD pipeline to automate the software delivery process and ensure faster reliable releases.",
      allHours: "880/421",
      tasks: "95/140",
      completion: 68,
      daysLeftLabel: "45 days left",
      daysLeftTone: "danger",
      members: [
        {
          name: "David Park",
          initials: "DP",
          avatar: "/images/avatars/avatar-7.webp",
        },
        {
          name: "Iris Hill",
          initials: "IH",
          avatar: "/images/avatars/avatar-6.webp",
        },
        {
          name: "Ruby Bell",
          initials: "RB",
          avatar: "/images/avatars/avatar-2.webp",
        },
      ],
      membersLabel: "458 members",
      commentsCount: "98",
    },
    {
      id: 6,
      title: "Logo Design",
      client: "Olive Strickland",
      initials: "LD",
      logo: "/images/brands/sketch-logo.webp",
      logoDark: "/images/brands/sketch-logo.webp",
      budgetSpent: "$1.3k",
      budgetTotal: "$655",
      startDate: "17/8/21",
      deadline: "02/11/21",
      description:
        "Premium logo designs created by top logo designers. Create the branding.",
      allHours: "580/445",
      tasks: "290/290",
      completion: 100,
      daysLeftLabel: "4 days left",
      daysLeftTone: "success",
      members: [
        {
          name: "Jade Scott",
          initials: "JS",
          avatar: "/images/avatars/avatar-6.webp",
        },
        {
          name: "Mia Stewart",
          initials: "MS",
          avatar: "/images/avatars/avatar-2.webp",
        },
        {
          name: "Aiden Cole",
          initials: "AC",
          avatar: "/images/avatars/avatar-3.webp",
        },
      ],
      membersLabel: "16 members",
      commentsCount: "98",
    },
  ],

  // Team - Profile Section Data
  teamActions: ["Share Teams", "Suggest Edits", "Report Bug"],
  teams: [
    {
      id: 1,
      teams: "React Developers",
      initials: "RD",
      avatar: "/images/avatars/avatar-1.webp",
      totalMembers: "72 Members",
      teamBadge: {
        label: "Developer",
      },
    },
    {
      id: 2,
      teams: "Vue Developers",
      initials: "VD",
      avatar: "/images/avatars/avatar-2.webp",
      totalMembers: "58 Members",
      teamBadge: {
        label: "Developer",
      },
    },
    {
      id: 3,
      teams: "Angular Developers",
      initials: "AD",
      avatar: "/images/avatars/avatar-3.webp",
      totalMembers: "65 Members",
      teamBadge: {
        label: "Developer",
      },
    },
    {
      id: 4,
      teams: "UI Designers",
      initials: "UD",
      avatar: "/images/avatars/avatar-4.webp",
      totalMembers: "72 Members",
      teamBadge: {
        label: "Designer",
      },
    },
    {
      id: 5,
      teams: "Digital Marketing",
      initials: "DM",
      avatar: "/images/avatars/avatar-2.webp",
      totalMembers: "58 Members",
      teamBadge: {
        label: "Marketing",
      },
    },
  ],
};
