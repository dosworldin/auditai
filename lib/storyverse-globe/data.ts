/**
 * StoryVerse globe — data pools.
 *
 * Each entry carries real coordinates so pins land on the actual world map
 * rendered behind them (equirectangular projection in world-map.ts).
 * These places mirror lib/activity/data.ts so the globe and any ambient
 * social proof never contradict each other.
 */

/** A place shown on the globe (country + flag + city + real coordinates). */
export interface GlobeEntry {
  country: string;
  flag: string;
  city: string;
  /** Real longitude (-180..180). */
  lng: number;
  /** Real latitude (-90..90). */
  lat: number;
}

export const GLOBE_COUNTRIES: GlobeEntry[] = [
  { country: "Brazil", flag: "🇧🇷", city: "São Paulo", lng: -46.63, lat: -23.55 },
  { country: "USA", flag: "🇺🇸", city: "Austin", lng: -97.74, lat: 30.27 },
  { country: "India", flag: "🇮🇳", city: "Mumbai", lng: 72.88, lat: 19.08 },
  { country: "USA", flag: "🇺🇸", city: "Seattle", lng: -122.33, lat: 47.61 },
  { country: "Germany", flag: "🇩🇪", city: "Berlin", lng: 13.4, lat: 52.52 },
  { country: "Japan", flag: "🇯🇵", city: "Osaka", lng: 135.5, lat: 34.69 },
  { country: "UK", flag: "🇬🇧", city: "Manchester", lng: -2.24, lat: 53.48 },
  { country: "Canada", flag: "🇨🇦", city: "Toronto", lng: -79.38, lat: 43.65 },
  { country: "Australia", flag: "🇦🇺", city: "Sydney", lng: 151.21, lat: -33.87 },
  { country: "France", flag: "🇫🇷", city: "Lyon", lng: 4.84, lat: 45.76 },
  { country: "Singapore", flag: "🇸🇬", city: "Singapore", lng: 103.82, lat: 1.35 },
  { country: "UAE", flag: "🇦🇪", city: "Dubai", lng: 55.27, lat: 25.2 },
  { country: "Netherlands", flag: "🇳🇱", city: "Amsterdam", lng: 4.9, lat: 52.37 },
  { country: "Spain", flag: "🇪🇸", city: "Valencia", lng: -0.38, lat: 39.47 },
  { country: "South Africa", flag: "🇿🇦", city: "Cape Town", lng: 18.42, lat: -33.92 },
  { country: "Mexico", flag: "🇲🇽", city: "Guadalajara", lng: -103.35, lat: 20.66 },
  { country: "South Korea", flag: "🇰🇷", city: "Busan", lng: 129.08, lat: 35.18 },
  { country: "Sweden", flag: "🇸🇪", city: "Malmö", lng: 13.0, lat: 55.6 },
  { country: "Italy", flag: "🇮🇹", city: "Turin", lng: 7.69, lat: 45.07 },
  { country: "Kenya", flag: "🇰🇪", city: "Nairobi", lng: 36.82, lat: -1.29 },
  { country: "Indonesia", flag: "🇮🇩", city: "Bandung", lng: 107.61, lat: -6.92 },
  { country: "Poland", flag: "🇵🇱", city: "Kraków", lng: 19.94, lat: 50.06 },
  { country: "Argentina", flag: "🇦🇷", city: "Córdoba", lng: -64.18, lat: -31.42 },
  { country: "Turkey", flag: "🇹🇷", city: "Izmir", lng: 27.14, lat: 38.42 },
  { country: "Vietnam", flag: "🇻🇳", city: "Da Nang", lng: 108.22, lat: 16.05 },
  { country: "Norway", flag: "🇳🇴", city: "Bergen", lng: 5.32, lat: 60.39 },
  { country: "Ireland", flag: "🇮🇪", city: "Galway", lng: -9.05, lat: 53.27 },
  { country: "New Zealand", flag: "🇳🇿", city: "Wellington", lng: 174.78, lat: -41.29 },
  { country: "Portugal", flag: "🇵🇹", city: "Porto", lng: -8.61, lat: 41.15 },
  { country: "Philippines", flag: "🇵🇭", city: "Cebu", lng: 123.89, lat: 10.32 },
  { country: "Egypt", flag: "🇪🇬", city: "Alexandria", lng: 29.92, lat: 31.2 },
  { country: "Chile", flag: "🇨🇱", city: "Valparaíso", lng: -71.63, lat: -33.05 },
  { country: "Malaysia", flag: "🇲🇾", city: "Penang", lng: 100.33, lat: 5.41 },
  { country: "Switzerland", flag: "🇨🇭", city: "Zurich", lng: 8.54, lat: 47.38 },
  { country: "Denmark", flag: "🇩🇰", city: "Aarhus", lng: 10.2, lat: 56.16 },
  { country: "Morocco", flag: "🇲🇦", city: "Casablanca", lng: -7.59, lat: 33.57 },
  { country: "Colombia", flag: "🇨🇴", city: "Medellín", lng: -75.56, lat: 6.25 },
  { country: "Nigeria", flag: "🇳🇬", city: "Lagos", lng: 3.38, lat: 6.52 },
  { country: "Thailand", flag: "🇹🇭", city: "Chiang Mai", lng: 98.98, lat: 18.79 },
  { country: "Greece", flag: "🇬🇷", city: "Thessaloniki", lng: 22.94, lat: 40.64 },
];

/** StoryVerse-specific actions shown on the globe (community-verified: only
 * StoryVerse events appear here — the general audit-tool popups never mix in). */
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
  { label: "Who can vote", text: "Anyone who has ever contributed to a story can vote on its rounds — contributors shape canon (free votes are limited per round)." },
  { label: "Paid votes", text: "A paid vote splits 70% platform / 30% to the story's author pool (admin-configurable)." },
  { label: "Book sales", text: "Marketplace sales split 30% platform / 70% author pool (admin-configurable)." },
  { label: "AI Editor", text: "The round winner's contribution is reviewed for continuity + copyright (admin-set credit cost)." },
  { label: "Attribution", text: "Every contribution is credited to its author — always." },
  { label: "Original work", text: "Copied or closely-quoted content is flagged and never becomes canon." },
  { label: "Payouts", text: "Author earnings are withdrawable after the inactivity hold (admin-configurable)." },
];
