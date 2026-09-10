/**
 * StoryVerse globe — data pools.
 *
 * City/country pools mirror lib/activity/data.ts so the globe and the bottom-left
 * activity toasts never contradict each other.
 */

/** A place shown on the globe (country + flag + city + rough map position %). */
export interface GlobeEntry {
  country: string;
  flag: string;
  city: string;
  /** Rough horizontal position on the globe (0–100%). */
  x: number;
  /** Rough vertical position on the globe (0–100%). */
  y: number;
}

export const GLOBE_COUNTRIES: GlobeEntry[] = [
  { country: "Brazil", flag: "🇧🇷", city: "São Paulo", x: 32, y: 58 },
  { country: "USA", flag: "🇺🇸", city: "Austin", x: 20, y: 38 },
  { country: "India", flag: "🇮🇳", city: "Mumbai", x: 68, y: 45 },
  { country: "USA", flag: "🇺🇸", city: "Seattle", x: 15, y: 30 },
  { country: "Germany", flag: "🇩🇪", city: "Berlin", x: 50, y: 32 },
  { country: "Japan", flag: "🇯🇵", city: "Osaka", x: 84, y: 42 },
  { country: "UK", flag: "🇬🇧", city: "Manchester", x: 47, y: 28 },
  { country: "Canada", flag: "🇨🇦", city: "Toronto", x: 22, y: 30 },
  { country: "Australia", flag: "🇦🇺", city: "Sydney", x: 86, y: 72 },
  { country: "France", flag: "🇫🇷", city: "Lyon", x: 49, y: 34 },
  { country: "Singapore", flag: "🇸🇬", city: "Singapore", x: 76, y: 58 },
  { country: "UAE", flag: "🇦🇪", city: "Dubai", x: 62, y: 46 },
  { country: "Netherlands", flag: "🇳🇱", city: "Amsterdam", x: 49, y: 30 },
  { country: "Spain", flag: "🇪🇸", city: "Valencia", x: 46, y: 38 },
  { country: "South Africa", flag: "🇿🇦", city: "Cape Town", x: 54, y: 72 },
  { country: "Mexico", flag: "🇲🇽", city: "Guadalajara", x: 17, y: 44 },
  { country: "South Korea", flag: "🇰🇷", city: "Busan", x: 82, y: 40 },
  { country: "Sweden", flag: "🇸🇪", city: "Malmö", x: 52, y: 25 },
  { country: "Italy", flag: "🇮🇹", city: "Turin", x: 50, y: 36 },
  { country: "Kenya", flag: "🇰🇪", city: "Nairobi", x: 57, y: 58 },
  { country: "Indonesia", flag: "🇮🇩", city: "Bandung", x: 78, y: 65 },
  { country: "Poland", flag: "🇵🇱", city: "Kraków", x: 52, y: 30 },
  { country: "Argentina", flag: "🇦🇷", city: "Córdoba", x: 29, y: 74 },
  { country: "Turkey", flag: "🇹🇷", city: "Izmir", x: 55, y: 38 },
  { country: "Vietnam", flag: "🇻🇳", city: "Da Nang", x: 76, y: 55 },
  { country: "Norway", flag: "🇳🇴", city: "Bergen", x: 51, y: 22 },
  { country: "Ireland", flag: "🇮🇪", city: "Galway", x: 45, y: 28 },
  { country: "New Zealand", flag: "🇳🇿", city: "Wellington", x: 92, y: 78 },
  { country: "Portugal", flag: "🇵🇹", city: "Porto", x: 44, y: 38 },
  { country: "Philippines", flag: "🇵🇭", city: "Cebu", x: 80, y: 58 },
  { country: "Egypt", flag: "🇪🇬", city: "Alexandria", x: 56, y: 44 },
  { country: "Chile", flag: "🇨🇱", city: "Valparaíso", x: 28, y: 72 },
  { country: "Malaysia", flag: "🇲🇾", city: "Penang", x: 75, y: 57 },
  { country: "Switzerland", flag: "🇨🇭", city: "Zurich", x: 49, y: 33 },
  { country: "Denmark", flag: "🇩🇰", city: "Aarhus", x: 51, y: 28 },
  { country: "Morocco", flag: "🇲🇦", city: "Casablanca", x: 44, y: 42 },
];

/** StoryVerse-specific actions shown on the globe. */
export const GLOBE_ACTIONS = [
  "cast a canon vote",
  "started a canon vote",
  "won a canon round",
  "contributed to a story",
  "started a story",
  "published to the marketplace",
  "purchased a story",
  "requested an AI Editor review",
  "topped up their author wallet",
] as const;

/**
 * Platform rules/terms displayed on the globe panel.
 * Wording mirrors supabase/schema.sql storyverse settings + the Terms page.
 */
export const GLOBE_RULES: { label: string; text: string }[] = [
  { label: "Canon wins", text: "Winners of community votes become official canon." },
  { label: "Paid votes", text: "A paid vote splits 70% platform / 30% to the story's author pool (admin-configurable)." },
  { label: "Book sales", text: "Marketplace sales split 30% platform / 70% author pool (admin-configurable)." },
  { label: "AI Editor", text: "The round winner's contribution is reviewed for continuity + copyright (admin-set credit cost)." },
  { label: "Attribution", text: "Every contribution is credited to its author — always." },
  { label: "Original work", text: "Copied or closely-quoted content is flagged and never becomes canon." },
  { label: "Payouts", text: "Author earnings are withdrawable after the inactivity hold (admin-configurable)." },
];
