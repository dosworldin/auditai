import type { NavItem, NavSection } from "@/lib/types";

export const navSections: { id: NavSection; label: string; items: NavItem[] }[] =
  [
    {
      id: "platform",
      label: "Platform",
      items: [
        { label: "Dashboard", href: "/dashboard", section: "platform" },
        { label: "Audit Tools", href: "/tools", section: "tools" },
        { label: "Audit History", href: "/history", section: "platform" },
        { label: "Reports", href: "/reports", section: "platform" },
        { label: "AI Storybooks", href: "/storybook", section: "platform" },
        { label: "Labs", href: "/labs", section: "labs" },
        { label: "Marketplace", href: "/marketplace", section: "platform" },
        { label: "Library", href: "/library", section: "platform" },
        { label: "Wallet", href: "/wallet", section: "platform" },
      ],
    },
    {
      id: "storyverse",
      label: "StoryVerse",
      items: [
        { label: "StoryVerse Home", href: "/storyverse", section: "storyverse" },
        { label: "Create a Story", href: "/storyverse/create", section: "storyverse" },
        { label: "Marketplace", href: "/storyverse/marketplace", section: "storyverse" },
        { label: "Library", href: "/storyverse/library", section: "storyverse" },
        { label: "Wallet", href: "/storyverse/wallet", section: "storyverse" },
        { label: "Discussions", href: "/storyverse/support/discussion", section: "storyverse" },
      ],
    },
    {
      id: "account",
      label: "Account",
      items: [
        { label: "Pricing", href: "/pricing", section: "platform" },
        { label: "Support", href: "/support", section: "platform" },
        { label: "Account", href: "/account", section: "account" },
        { label: "Security", href: "/account/security", section: "account" },
        { label: "Admin", href: "/admin", section: "account" },
      ],
    },
  ];

export const mainNavLinks: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", section: "platform" },
  { label: "Tools", href: "/tools", section: "tools" },
  { label: "Labs", href: "/labs", section: "labs" },
  { label: "StoryVerse", href: "/storyverse", section: "storyverse" },
  { label: "Pricing", href: "/pricing", section: "platform" },
];

export function flattenNav(): NavItem[] {
  return navSections.flatMap((section) => section.items);
}
