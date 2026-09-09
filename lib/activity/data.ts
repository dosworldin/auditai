/**
 * Live activity feed pools for the social-proof widget.
 * Names are fabricated ambience data, deliberately varied to feel real.
 */

/** A place used in activity popups (country + flag + city). */
export interface ActivityEntry {
  country: string;
  flag: string;
  city: string;
}

export const ACTIVITY_NAMES: string[] = [
  "Aarav", "Sofia", "Liam", "Priya", "Mateo", "Emma", "Yuki", "Omar",
  "Ananya", "Lucas", "Zara", "Ethan", "Mei", "Noah", "Isabella", "Ravi",
  "Amara", "Diego", "Ingrid", "Farah", "Rohan", "Elena", "Kai", "Nadia",
  "Arjun", "Freya", "Tomas", "Leila", "Jonas", "Aisha", "Victor", "Chloe",
  "Ryu", "Maya", "Felix", "Sana", "Hugo", "Tara", "Dmitri", "Nina",
];

export const ACTIVITY_COUNTRIES: ActivityEntry[] = [
  { country: "Brazil", flag: "🇧🇷", city: "São Paulo" },
  { country: "USA", flag: "🇺🇸", city: "Austin" },
  { country: "India", flag: "🇮🇳", city: "Mumbai" },
  { country: "USA", flag: "🇺🇸", city: "Seattle" },
  { country: "Germany", flag: "🇩🇪", city: "Berlin" },
  { country: "Japan", flag: "🇯🇵", city: "Osaka" },
  { country: "UK", flag: "🇬🇧", city: "Manchester" },
  { country: "Canada", flag: "🇨🇦", city: "Toronto" },
  { country: "Australia", flag: "🇦🇺", city: "Sydney" },
  { country: "France", flag: "🇫🇷", city: "Lyon" },
  { country: "Singapore", flag: "🇸🇬", city: "Singapore" },
  { country: "UAE", flag: "🇦🇪", city: "Dubai" },
  { country: "Netherlands", flag: "🇳🇱", city: "Amsterdam" },
  { country: "Spain", flag: "🇪🇸", city: "Valencia" },
  { country: "South Africa", flag: "🇿🇦", city: "Cape Town" },
  { country: "Mexico", flag: "🇲🇽", city: "Guadalajara" },
  { country: "South Korea", flag: "🇰🇷", city: "Busan" },
  { country: "Sweden", flag: "🇸🇪", city: "Malmö" },
  { country: "Italy", flag: "🇮🇹", city: "Turin" },
  { country: "Kenya", flag: "🇰🇪", city: "Nairobi" },
  { country: "Indonesia", flag: "🇮🇩", city: "Bandung" },
  { country: "Poland", flag: "🇵🇱", city: "Kraków" },
  { country: "Argentina", flag: "🇦🇷", city: "Córdoba" },
  { country: "Turkey", flag: "🇹🇷", city: "Izmir" },
  { country: "Vietnam", flag: "🇻🇳", city: "Da Nang" },
  { country: "Norway", flag: "🇳🇴", city: "Bergen" },
  { country: "Ireland", flag: "🇮🇪", city: "Galway" },
  { country: "New Zealand", flag: "🇳🇿", city: "Wellington" },
  { country: "Portugal", flag: "🇵🇹", city: "Porto" },
  { country: "Philippines", flag: "🇵🇭", city: "Cebu" },
  { country: "Egypt", flag: "🇪🇬", city: "Alexandria" },
  { country: "Chile", flag: "🇨🇱", city: "Valparaíso" },
  { country: "Malaysia", flag: "🇲🇾", city: "Penang" },
  { country: "Switzerland", flag: "🇨🇭", city: "Zurich" },
  { country: "Denmark", flag: "🇩🇰", city: "Aarhus" },
  { country: "Morocco", flag: "🇲🇦", city: "Casablanca" },
];

/** Tool names shown in popups — kept in sync with the audit tool registry's popular tools. */
export const ACTIVITY_TOOLS: string[] = [
  "Salary Slip Audit", "Contract Analyzer", "Invoice Verification", "GST Report Check",
  "Resume Review", "Legal Notice Scan", "Loan Document Audit", "Privacy Policy Audit",
  "Cookie Policy Audit", "SEO Report", "Scam Message Detector", "Fraud Alert Scanner",
  "NDA Review", "Compliance Check", "Tax Notice Analyzer", "Website Privacy Audit",
  "Bank Statement Review", "Medical Bill Audit", "AI Content Detector", "Cyber Security Scan",
];

export const ACTIVITY_LABS: string[] = [
  "Dream Decoder", "Kalesh Detector", "Passive Aggressive Translator", "Social Escape Coach",
];
