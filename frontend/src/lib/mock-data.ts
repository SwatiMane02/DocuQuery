export const userNav = [
  { to: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { to: "/documents", label: "Documents", icon: "FileText" },
  { to: "/ai-query", label: "AI Query", icon: "Zap" },
  { to: "/search", label: "Search", icon: "Search" },
  { to: "/analytics", label: "Analytics", icon: "BarChart3" },
  { to: "/profile", label: "Profile", icon: "User" },
] as const;

export const adminNav = [
  { to: "/admin", label: "Overview", icon: "LayoutDashboard" },
  { to: "/admin/users", label: "Users", icon: "Users" },
  { to: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
  { to: "/admin/reports", label: "Reports", icon: "Flag" },
] as const;

export const topNav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/documents", label: "Documents" },
  { to: "/ai-query", label: "AI Query" },
  { to: "/search", label: "Search" },
  { to: "/analytics", label: "Analytics" },
];

export const recentDocs = [
  {
    name: "Machine_Learning_Notes_Final.pdf",
    meta: "Modified 2 hours ago • 4.2 MB",
    tag: "Academic",
    type: "pdf",
  },
  {
    name: "Product_Manager_Internship_JD.docx",
    meta: "Modified yesterday • 1.1 MB",
    tag: "Career",
    type: "doc",
  },
  {
    name: "System_Design_Fundamentals.md",
    meta: "Modified 3 days ago • 12 KB",
    tag: "Tech",
    type: "md",
  },
];

export const recentActivity = [
  { title: "Summarized ML Notes", time: "20 mins ago" },
  { title: "Mock Interview practice", time: "2 hours ago" },
  { title: "Generated flashcards", time: "Yesterday" },
];

export const internships = [
  {
    role: "PM Intern",
    company: "Google",
    location: "Mountain View, CA",
    pay: "$8,500 / mo",
    mode: "Hybrid",
    posted: "2 days ago",
    desc: "Lead product initiatives for the next generation of AI-powered search tools.",
  },
  {
    role: "Software Engineer",
    company: "Microsoft",
    location: "Redmond, WA",
    pay: "$7,800 / mo",
    mode: "On-site",
    posted: "5 hours ago",
    desc: "Join the Azure Cloud Compute team. Build scalable distributed systems.",
  },
  {
    role: "UI/UX Design",
    company: "Stripe",
    location: "Remote",
    pay: "$9,200 / mo",
    mode: "Remote",
    posted: "1 day ago",
    desc: "Design the future of global payments. Focus on complex dashboard systems.",
  },
  {
    role: "AI Research",
    company: "Tesla Autopilot",
    location: "Palo Alto, CA",
    pay: "$10,000 / mo",
    mode: "On-site",
    posted: "3 days ago",
    desc: "Work on computer vision models that power FSD. Experience with PyTorch and CUDA.",
  },
  {
    role: "NLP Intern",
    company: "OpenAI",
    location: "San Francisco, CA",
    pay: "$11,500 / mo",
    mode: "In-person",
    posted: "6 days ago",
    desc: "Push the boundaries of large language models. Collaborate with researchers.",
  },
  {
    role: "Software Engineering",
    company: "Figma",
    location: "New York, NY",
    pay: "$9,500 / mo",
    mode: "On-site",
    posted: "1 week ago",
    desc: "Build the web technologies that power the world's best designers.",
  },
];

export const interviews = [
  {
    tag: "CEO Interview",
    time: "12 min read",
    title: "Satya Nadella: The Future of Generative AI in Enterprise",
    desc: "Exploring the cultural shift required for AI-first productivity and the evolution of Azure.",
  },
  {
    tag: "Leadership",
    time: "15 min read",
    title: "Sundar Pichai: Responsible AI and the Search Revolution",
    desc: "A deep dive into Google's approach to ethical AI implementation and search enhancements.",
  },
  {
    tag: "Hardware",
    time: "10 min read",
    title: "Jensen Huang: How GPU Computing Scaled LLMs",
    desc: "The story of NVIDIA's transformation and the hardware powering the world's most advanced AI models.",
  },
  {
    tag: "Innovation",
    time: "20 min read",
    title: "Sam Altman: Scaling Intelligence and AGI Safety",
    desc: "Discussing the roadmap for OpenAI and the critical importance of safety alignment in large models.",
  },
  {
    tag: "Academia",
    time: "18 min read",
    title: "Fei-Fei Li: Human-Centered AI for the Next Generation",
    desc: "Insights into how we can build AI that augments rather than replaces human capabilities.",
  },
];

export const adminUsers = [
  {
    name: "Jane Smith",
    joined: "Joined Oct 2023",
    email: "jane.smith@example.com",
    role: "Admin",
    status: "Active",
  },
  {
    name: "Marcus Reed",
    joined: "Joined Nov 2023",
    email: "m.reed@techcorp.io",
    role: "Pro",
    status: "Active",
  },
  {
    name: "Elena Lopez",
    joined: "Joined Dec 2023",
    email: "elena@creative.studio",
    role: "Free",
    status: "Active",
  },
  {
    name: "David Black",
    joined: "Banned Feb 2024",
    email: "black.list@example.com",
    role: "Free",
    status: "Banned",
  },
];

export const adminOpportunities = [
  {
    title: "Senior Product Designer",
    company: "Stellar Systems Inc.",
    date: "Oct 24, 2023",
    location: "Remote",
    status: "Active",
  },
  {
    title: "Marketing Internship",
    company: "BrightLake Labs",
    date: "Oct 21, 2023",
    location: "New York, NY",
    status: "Pending",
  },
  {
    title: "Full Stack Developer",
    company: "BuildCore Corp",
    date: "Sep 15, 2023",
    location: "Remote",
    status: "Expired",
  },
];

export const newsPosts = [
  {
    date: "OCT 24, 2023",
    tag: "Engineering",
    title: "Optimizing RAG Pipelines for Enterprise PDF Querying",
    desc: "Explore our latest breakthrough in retrieval-augmented generation that reduces latency.",
    published: true,
  },
  {
    date: "OCT 22, 2023",
    tag: "Career Tips",
    title: "How to Build Your First AI-Integrated Dashboard",
    desc: "A comprehensive guide for interns and junior developers starting their journey with LLM.",
    published: false,
  },
  {
    date: "OCT 19, 2023",
    tag: "Analytics",
    title: "Q3 Platform Metrics: Doubling User Engagement",
    desc: "Our quarterly report is out. See how new personalization features drove significant gains.",
    published: true,
  },
  {
    date: "OCT 15, 2023",
    tag: "Engineering",
    title: "Security Patch 2.4.1 Release Notes",
    desc: "Critical updates for data isolation and encrypted cache management have been deployed.",
    published: true,
  },
];

export const reports = [
  {
    reporter: "James Smith",
    id: "94021",
    type: "Internship",
    content: "Software Eng...",
    reason: "Spam",
    date: "Oct 12, 2023 14:22",
  },
  {
    reporter: "Sarah Chen",
    id: "88219",
    type: "News",
    content: "Market Trends...",
    reason: "Misleading",
    date: "Oct 12, 2023 12:05",
  },
  {
    reporter: "Marcus Lee",
    id: "76533",
    type: "User",
    content: "@bot_account_1",
    reason: "Harassment",
    date: "Oct 11, 2023 23:45",
  },
  {
    reporter: "David Miller",
    id: "22105",
    type: "Internship",
    content: "UX Design Role",
    reason: "Other",
    date: "Oct 11, 2023 18:10",
  },
];

export const categories = [
  { name: "Engineering", icon: "Cpu" },
  { name: "Design & Creative", icon: "Palette" },
  { name: "Data Science", icon: "Database" },
  { name: "Marketing", icon: "Megaphone" },
  { name: "Finance", icon: "DollarSign" },
];

export const growthData = Array.from({ length: 12 }, (_, i) => ({
  day: `D${i + 1}`,
  users: 18000 + Math.round(Math.sin(i / 2) * 4000 + i * 1400),
  posts: 600 + Math.round(Math.cos(i / 2) * 100 + i * 30),
}));

export const dauData = Array.from({ length: 14 }, (_, i) => ({
  day: `May ${i + 1}`,
  current: 4000 + Math.round(Math.sin(i / 2) * 800 + i * 180),
  prev: 3600 + Math.round(Math.cos(i / 3) * 600 + i * 120),
}));
