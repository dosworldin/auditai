import type { SafetyDomain } from "@/lib/engine/types";
import type { Rule } from "@/lib/engine/rules";

export interface ToolLogic {
  slug: string;
  safetyDomain: SafetyDomain;
  analyzer?: string;
  checks: Rule[];
  classifierHints: string[];
}

type KwInput = {
  id: string;
  category: string;
  severity: Rule["severity"];
  risk: Rule["risk"];
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  keywords: string[];
  perKeyword?: boolean;
};

type AbsInput = {
  id: string;
  category: string;
  severity: Rule["severity"];
  risk: Rule["risk"];
  title: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  terms: string[];
};

function kw(i: KwInput): Rule {
  return { kind: "keyword", wordBoundary: false, ...i };
}

function abs(i: AbsInput): Rule {
  return { kind: "absence", ...i };
}

const info = {
  evidence: "Term or section was found in the document.",
  rec:
    "Review the full section in context before signing or relying on it.",
};

function t(
  slug: string,
  safetyDomain: SafetyDomain,
  checks: Rule[],
  classifierHints: string[] = [],
  analyzer?: string,
): ToolLogic {
  return { slug, safetyDomain, checks, classifierHints, analyzer };
}

export const TOOL_LOGIC: Record<string, ToolLogic> = {
  /* ---------------- LEGAL / CONTRACT ---------------- */

  "contract-watchdog": t("contract-watchdog", "legal", [
    kw({
      id: "cw-termination-convenience",
      category: "Termination",
      severity: "High",
      risk: "High",
      title: "Unilateral termination without cause",
      explanation:
        "The contract contains language that may allow one party to terminate without cause or at its sole discretion.",
      recommendation:
        "Negotiate mutual termination rights with adequate notice and a cure period.",
      confidence: 0.62,
      keywords: ["terminate this agreement at any time", "terminate without cause", "at its sole discretion", "without assigning any reason", "forthwith"],
    }),
    kw({
      id: "cw-auto-renewal",
      category: "Renewal",
      severity: "Medium",
      risk: "Medium",
      title: "Automatic renewal clause present",
      explanation:
        "The agreement may renew automatically unless the other party is notified. This can create unintentional obligations.",
      recommendation:
        "Confirm the renewal notice window and set a reminder before the notice deadline.",
      confidence: 0.6,
      keywords: ["automatically renew", "auto-renew", "shall renew", "unless you provide written notice", "tacit renewal"],
    }),
    kw({
      id: "cw-indemnity",
      category: "Indemnity",
      severity: "Medium",
      risk: "Medium",
      title: "Broad indemnity obligation",
      explanation:
        "A broad indemnification clause may expose you to claims beyond your reasonable control.",
      recommendation:
        "Cap the indemnity and narrow it to claims caused by the indemnifying party's negligence or breach.",
      confidence: 0.58,
      keywords: ["indemnify and hold harmless", "defend and indemnify", "indemnify", "hold harmless"],
    }),
    kw({
      id: "cw-liability-cap",
      category: "Liability",
      severity: "Info",
      risk: "None",
      title: "Limitation of liability present",
      explanation:
        "The agreement includes a limitation-of-liability provision.",
      recommendation: info.rec,
      confidence: 0.66,
      keywords: ["limitation of liability", "aggregate liability", "cap on liability", "liability shall be limited"],
    }),
    abs({
      id: "cw-no-liability-cap",
      category: "Liability",
      severity: "High",
      risk: "High",
      title: "No limitation of liability found",
      explanation:
        "No liability cap or exclusion of consequential damages was detected, leaving potentially unlimited liability.",
      recommendation:
        "Request a mutual limitation of liability and exclusion of indirect/consequential damages.",
      confidence: 0.5,
      terms: ["limitation of liability", "aggregate liability", "liability shall", "indirect damages", "consequential damages"],
    }),
    kw({
      id: "cw-penalties",
      category: "Penalties",
      severity: "Medium",
      risk: "Medium",
      title: "Penalty or late-payment charges",
      explanation:
        "Penalty or late-payment interest terms were found and may be significant.",
      recommendation:
        "Quantify the penalties and negotiate a cap or grace period.",
      confidence: 0.6,
      keywords: ["late payment", "penalty", "interest at", "per month", "liquidated damages"],
    }),
    kw({
      id: "cw-jurisdiction",
      category: "Jurisdiction",
      severity: "Info",
      risk: "None",
      title: "Governing law / jurisdiction clause",
      explanation:
        "The agreement specifies a governing law or jurisdiction.",
      recommendation: info.rec,
      confidence: 0.66,
      keywords: ["governing law", "jurisdiction", "courts of", "exclusive jurisdiction"],
    }),
    abs({
      id: "cw-no-governing-law",
      category: "Jurisdiction",
      severity: "Medium",
      risk: "Medium",
      title: "No governing law or jurisdiction clause",
      explanation:
        "The agreement does not state which law governs or where disputes are resolved.",
      recommendation:
        "Add a governing-law and jurisdiction clause before signing.",
      confidence: 0.45,
      terms: ["governing law", "jurisdiction", "venue", "arbitration"],
    }),
    kw({
      id: "cw-arbitration",
      category: "Dispute Resolution",
      severity: "Info",
      risk: "None",
      title: "Arbitration clause present",
      explanation:
        "Disputes are referred to arbitration, which affects where and how they are resolved.",
      recommendation:
        "Check the arbitration seat, rules, and whether it is binding and exclusive.",
      confidence: 0.66,
      keywords: ["arbitration", "arbitral tribunal", "arbitrator"],
    }),
    kw({
      id: "cw-payment-terms",
      category: "Payment",
      severity: "Info",
      risk: "None",
      title: "Payment terms identified",
      explanation:
        "Payment obligations and terms were found.",
      recommendation:
        "Verify payment milestones, amounts, and due dates match the commercial deal.",
      confidence: 0.6,
      keywords: ["payment terms", "net 30", "net 60", "due within", "milestone"],
    }),
    abs({
      id: "cw-no-payment-terms",
      category: "Payment",
      severity: "Medium",
      risk: "Medium",
      title: "No explicit payment terms found",
      explanation:
        "The agreement does not clearly state amounts, due dates, or payment method.",
      recommendation:
        "Clarify payment terms in writing before execution.",
      confidence: 0.4,
      terms: ["payment", "payable", "invoice", "fees", "price"],
    }),
    kw({
      id: "cw-confidentiality",
      category: "Confidentiality",
      severity: "Info",
      risk: "None",
      title: "Confidentiality clause present",
      explanation:
        "The agreement includes confidentiality obligations.",
      recommendation: info.rec,
      confidence: 0.66,
      keywords: ["confidentiality", "confidential information", "non-disclosure"],
    }),
    abs({
      id: "cw-no-confidentiality",
      category: "Confidentiality",
      severity: "Medium",
      risk: "Medium",
      title: "No confidentiality clause found",
      explanation:
        "No confidentiality provisions were detected, which may leave shared information unprotected.",
      recommendation:
        "Add a confidentiality clause covering both parties' information.",
      confidence: 0.4,
      terms: ["confidential", "non-disclosure", "secrecy", "proprietary information"],
    }),
    kw({
      id: "cw-ip",
      category: "Intellectual Property",
      severity: "Info",
      risk: "None",
      title: "Intellectual property clause present",
      explanation:
        "IP ownership or licensing terms were found.",
      recommendation:
        "Confirm who owns deliverables, pre-existing IP, and any licenses.",
      confidence: 0.6,
      keywords: ["intellectual property", "work product", "ownership of", "assignment of"],
    }),
    abs({
      id: "cw-no-ip",
      category: "Intellectual Property",
      severity: "High",
      risk: "High",
      title: "No intellectual property clause found",
      explanation:
        "Ownership of work product and pre-existing IP is not addressed, which is a common source of later disputes.",
      recommendation:
        "Add an IP clause defining ownership and licenses for deliverables.",
      confidence: 0.42,
      terms: ["intellectual property", "work product", "copyright", "ownership", "assignment"],
    }),
    kw({
      id: "cw-noncompete",
      category: "Restrictive Covenants",
      severity: "Medium",
      risk: "Medium",
      title: "Non-compete / restrictive covenant present",
      explanation:
        "The agreement restricts your ability to compete or solicit, which may be unenforceable or overbroad.",
      recommendation:
        "Review scope, duration, and geography; negotiate narrowing where unreasonable.",
      confidence: 0.6,
      keywords: ["non-compete", "non compete", "non-compete", "restrictive covenant", "non-solicit"],
    }),
  ], ["termination", "liability", "indemnity", "governing law", "confidentiality", "payment"]),

  "insurance-trap-detector": t("insurance-trap-detector", "legal", [
    kw({
      id: "ins-exclusions",
      category: "Exclusions",
      severity: "Info",
      risk: "None",
      title: "Policy exclusions listed",
      explanation: "Exclusions and non-covered events were found in the policy.",
      recommendation: "Read the exclusions list carefully; it defines what is not covered.",
      confidence: 0.68,
      keywords: ["exclusions", "not covered", "does not cover", "shall not be liable to pay", "excluded"],
    }),
    abs({
      id: "ins-no-exclusions",
      category: "Exclusions",
      severity: "High",
      risk: "High",
      title: "No exclusions section detected",
      explanation: "No explicit exclusions section was found. Coverage boundaries are unclear.",
      recommendation: "Request a written list of exclusions from the insurer.",
      confidence: 0.45,
      terms: ["exclusion", "not covered", "does not cover", "limitation of cover"],
    }),
    kw({
      id: "ins-deductible",
      category: "Deductible",
      severity: "Info",
      risk: "None",
      title: "Deductible / excess present",
      explanation: "A deductible or excess amount was found that you may have to pay before cover applies.",
      recommendation: "Confirm the deductible amount and how it applies per claim.",
      confidence: 0.62,
      keywords: ["deductible", "excess", "co-pay", "co-payment", "first you must pay"],
    }),
    kw({
      id: "ins-limits",
      category: "Limits",
      severity: "Info",
      risk: "None",
      title: "Coverage limits identified",
      explanation: "Policy limits or sum-assured figures were found.",
      recommendation: "Verify the limits cover realistic worst-case scenarios.",
      confidence: 0.6,
      keywords: ["sum assured", "sum insured", "cover limit", "policy limit", "maximum liability"],
    }),
    abs({
      id: "ins-no-limits",
      category: "Limits",
      severity: "High",
      risk: "High",
      title: "No coverage limit identified",
      explanation: "The policy does not clearly state its coverage limits.",
      recommendation: "Confirm the sum assured and any per-incident sub-limits.",
      confidence: 0.45,
      terms: ["sum assured", "sum insured", "limit", "cover", "liability"],
    }),
    kw({
      id: "ins-waiting-period",
      category: "Waiting Period",
      severity: "Medium",
      risk: "Medium",
      title: "Waiting period applies",
      explanation: "Claims may be denied during an initial waiting period.",
      recommendation: "Note the waiting period and avoid assuming immediate cover.",
      confidence: 0.62,
      keywords: ["waiting period", "cooling period", "after a period of", "no claim shall be payable within"],
    }),
    kw({
      id: "ins-claim-conditions",
      category: "Claims",
      severity: "Info",
      risk: "None",
      title: "Claim conditions identified",
      explanation: "Conditions for filing a claim (such as time limits) were found.",
      recommendation: "Document incidents early and follow the stated claim procedure.",
      confidence: 0.6,
      keywords: ["intimate within", "claim must be", "claim shall be", "file your claim", "within 30 days"],
    }),
    kw({
      id: "ins-cancellation",
      category: "Cancellation",
      severity: "Info",
      risk: "None",
      title: "Cancellation terms present",
      explanation: "Cancellation and lapse conditions were found.",
      recommendation: "Understand what causes a lapse or cancellation.",
      confidence: 0.6,
      keywords: ["cancellation", "lapse", "cancel the policy", "policy shall lapse"],
    }),
    kw({
      id: "ins-renewal",
      category: "Renewal",
      severity: "Info",
      risk: "None",
      title: "Renewal terms present",
      explanation: "Renewal provisions were found.",
      recommendation: "Track the renewal date and any premium changes.",
      confidence: 0.6,
      keywords: ["renewal", "renew", "continuation of cover"],
    }),
    kw({
      id: "ins-preexisting",
      category: "Restrictions",
      severity: "High",
      risk: "High",
      title: "Pre-existing condition restriction",
      explanation: "Pre-existing condition exclusions were detected; these can block common claims.",
      recommendation: "Check how pre-existing conditions are defined and if any riders cover them.",
      confidence: 0.6,
      keywords: ["pre-existing", "pre existing", "preexisting", "existing condition"],
    }),
  ], ["insurance", "policy", "exclusions", "sum assured", "claim"]),

  "privacy-policy-auditor": t("privacy-policy-auditor", "general", [
    kw({ id: "pp-collection", category: "Data Collection", severity: "Info", risk: "None", title: "Data collection described", explanation: "The policy explains what information is collected.", recommendation: "Compare collected data types with what you actually share.", confidence: 0.68, keywords: ["we collect", "information we collect", "collect your", "data we collect"] }),
    abs({ id: "pp-no-collection", category: "Data Collection", severity: "High", risk: "High", title: "No data-collection description found", explanation: "The policy does not clearly describe what data is collected.", recommendation: "Flag this gap; a privacy policy must explain collection practices.", confidence: 0.45, terms: ["collect", "information you provide", "data we process"] }),
    kw({ id: "pp-purpose", category: "Purpose", severity: "Info", risk: "None", title: "Purpose of processing stated", explanation: "The policy explains why data is processed.", recommendation: "Ensure the purposes match how the service actually behaves.", confidence: 0.6, keywords: ["purpose", "we use your information", "to provide", "process your data"] }),
    kw({ id: "pp-legal-basis", category: "Legal Basis", severity: "Info", risk: "None", title: "Legal basis mentioned", explanation: "Consent or another legal basis for processing is referenced.", recommendation: "Check whether consent is freely given and easy to withdraw.", confidence: 0.58, keywords: ["legal basis", "consent", "legitimate interest", "performance of a contract"] }),
    kw({ id: "pp-sharing", category: "Sharing", severity: "Info", risk: "None", title: "Third-party sharing described", explanation: "The policy mentions sharing with third parties.", recommendation: "Review which categories of recipients receive your data.", confidence: 0.62, keywords: ["share with third parties", "third parties", "disclose to", "we share", "service providers"] }),
    kw({ id: "pp-retention", category: "Retention", severity: "Info", risk: "None", title: "Retention period described", explanation: "The policy states how long data is kept.", recommendation: "Confirm retention aligns with stated purposes.", confidence: 0.58, keywords: ["retain", "retention", "keep your data", "delete after"] }),
    abs({ id: "pp-no-retention", category: "Retention", severity: "Medium", risk: "Medium", title: "No retention period described", explanation: "How long data is kept is not explained.", recommendation: "Request a data-retention section.", confidence: 0.4, terms: ["retain", "retention", "store your data", "keep"] }),
    kw({ id: "pp-cookies", category: "Cookies", severity: "Info", risk: "None", title: "Cookies referenced", explanation: "The policy references cookies or similar tracking technologies.", recommendation: "Verify cookie categories and whether consent is obtained.", confidence: 0.66, keywords: ["cookies", "cookie", "tracking technologies", "web beacons"] }),
    kw({ id: "pp-rights", category: "User Rights", severity: "Info", risk: "None", title: "User rights described", explanation: "The policy describes rights such as access, correction, or deletion.", recommendation: "Test whether rights are actually honored in practice.", confidence: 0.6, keywords: ["your rights", "right to access", "right to delete", "erasure", "object to"] }),
    abs({ id: "pp-no-rights", category: "User Rights", severity: "Medium", risk: "Medium", title: "No user-rights section found", explanation: "The policy does not describe user rights (access, deletion, objection).", recommendation: "Flag the missing rights disclosure.", confidence: 0.4, terms: ["your rights", "right to access", "delete your data", "erasure", "objection"] }),
    kw({ id: "pp-children", category: "Children", severity: "Info", risk: "None", title: "Children's data addressed", explanation: "The policy mentions handling of children's data.", recommendation: "Verify age thresholds align with applicable law.", confidence: 0.55, keywords: ["children", "under 13", "under 16", "minor", "parental consent"] }),
    kw({ id: "pp-transfers", category: "Transfers", severity: "Info", risk: "None", title: "Cross-border transfers mentioned", explanation: "International or cross-border data transfers are disclosed.", recommendation: "Check whether appropriate safeguards are stated.", confidence: 0.55, keywords: ["cross-border", "transfer outside", "international transfer", "transferred to"] }),
    kw({ id: "pp-security", category: "Security", severity: "Info", risk: "None", title: "Security measures described", explanation: "The policy mentions safeguards applied to data.", recommendation: "Note the measures but treat them as claims, not guarantees.", confidence: 0.55, keywords: ["encryption", "security measures", "safeguard", "secure"] }),
    kw({ id: "pp-contact", category: "Contact", severity: "Info", risk: "None", title: "Contact information present", explanation: "A contact route for privacy questions was found.", recommendation: "Keep a copy of the contact details.", confidence: 0.66, keywords: ["contact us", "privacy officer", "dpo", "dpo@", "write to us"] }),
  ], ["privacy policy", "personal data", "consent", "cookies", "gdpr"]),

  "terms-conditions-analyzer": t("terms-conditions-analyzer", "legal", [
    kw({ id: "tc-unilateral-change", category: "Unilateral Changes", severity: "High", risk: "High", title: "Unilateral terms modification", explanation: "The terms may allow one party to change terms or pricing without meaningful notice.", recommendation: "Check notice requirements and whether changes require acceptance.", confidence: 0.6, keywords: ["may modify these terms", "change these terms at any time", "updated terms", "in our sole discretion", "modify the services"] }),
    kw({ id: "tc-auto-renewal", category: "Auto-renewal", severity: "High", risk: "High", title: "Automatic renewal / recurring charges", explanation: "Recurring or auto-renewing charges may apply without explicit renewal.", recommendation: "Note the billing cycle and how to cancel before renewal.", confidence: 0.62, keywords: ["auto-renew", "automatically renew", "recurring", "renew unless", "until cancelled"] }),
    kw({ id: "tc-suspension", category: "Account", severity: "High", risk: "High", title: "Account suspension without notice", explanation: "The terms may allow suspension or termination of accounts without prior notice.", recommendation: "Understand what actions trigger suspension and appeal options.", confidence: 0.55, keywords: ["suspend your account", "terminate your account without notice", "without liability, we may", "immediately terminate"] }),
    kw({ id: "tc-liability", category: "Liability", severity: "Medium", risk: "Medium", title: "Broad liability disclaimer", explanation: "Liability is broadly disclaimed, including for consequential losses.", recommendation: "Check whether the disclaimer is balanced and enforceable.", confidence: 0.6, keywords: ["to the fullest extent", "not liable", "no liability for", "consequential damages", "as is"] }),
    kw({ id: "tc-refunds", category: "Refunds", severity: "Medium", risk: "Medium", title: "Refund terms present", explanation: "Refund or no-refund policy was found.", recommendation: "Confirm refund eligibility windows and conditions.", confidence: 0.62, keywords: ["refund", "no refunds", "non-refundable"] }),
    kw({ id: "tc-cancellation", category: "Cancellation", severity: "Info", risk: "None", title: "Cancellation terms present", explanation: "Cancellation rights and procedures are described.", recommendation: "Note the cancellation process and any fees.", confidence: 0.6, keywords: ["cancel", "cancellation", "may cancel"] }),
    kw({ id: "tc-termination", category: "Termination", severity: "Info", risk: "None", title: "Termination terms present", explanation: "Termination rights are described.", recommendation: "Review both parties' termination rights and obligations.", confidence: 0.6, keywords: ["terminate", "termination", "terminated by either party"] }),
    kw({ id: "tc-ip-license", category: "Intellectual Property", severity: "Medium", risk: "Medium", title: "IP / license grant present", explanation: "You may be granting rights to your content or receiving a limited license.", recommendation: "Check the scope and duration of any license granted.", confidence: 0.58, keywords: ["you grant", "license to", "intellectual property", "assign to us"] }),
    kw({ id: "tc-governing-law", category: "Governing Law", severity: "Info", risk: "None", title: "Governing law clause present", explanation: "The terms specify a governing law.", recommendation: "Confirm the chosen jurisdiction and its implications.", confidence: 0.66, keywords: ["governing law", "shall be governed", "laws of"] }),
    abs({ id: "tc-no-governing-law", category: "Governing Law", severity: "Medium", risk: "Medium", title: "No governing law clause", explanation: "No governing law is stated.", recommendation: "Flag the absence of a governing-law clause.", confidence: 0.4, terms: ["governing law", "governed by", "jurisdiction", "laws of"] }),
    kw({ id: "tc-arbitration", category: "Disputes", severity: "Info", risk: "None", title: "Arbitration / dispute clause present", explanation: "Disputes are subject to arbitration or defined procedures.", recommendation: "Check whether it is mandatory and class-action waivers.", confidence: 0.62, keywords: ["arbitration", "binding arbitration", "disputes shall be"] }),
  ], ["terms", "conditions", "agreement", "governing law", "subscription"]),

  "rental-agreement-analyzer": t("rental-agreement-analyzer", "legal", [
    kw({ id: "ra-rent", category: "Rent", severity: "Info", risk: "None", title: "Rent amount identified", explanation: "The monthly rent or total consideration was found.", recommendation: "Verify the amount matches what was agreed.", confidence: 0.66, keywords: ["monthly rent", "rent of", "rental amount", "lease amount"] }),
    abs({ id: "ra-no-rent", category: "Rent", severity: "High", risk: "High", title: "Rent amount not stated", explanation: "No rent or consideration amount was found.", recommendation: "Request the rent amount in writing before signing.", confidence: 0.45, terms: ["rent", "lease amount", "consideration"] }),
    kw({ id: "ra-deposit", category: "Deposit", severity: "Info", risk: "None", title: "Security deposit mentioned", explanation: "A security or advance deposit is described.", recommendation: "Confirm the deposit amount, refund timeline, and deduction rules.", confidence: 0.62, keywords: ["security deposit", "deposit of", "advance deposit", "refundable deposit"] }),
    kw({ id: "ra-duration", category: "Tenure", severity: "Info", risk: "None", title: "Lease duration identified", explanation: "The lease term or duration was found.", recommendation: "Confirm the start and end dates.", confidence: 0.6, keywords: ["for a period of", "lease term", "tenancy", "12 months", "11 months"] }),
    kw({ id: "ra-renewal", category: "Renewal", severity: "Info", risk: "None", title: "Renewal terms present", explanation: "Renewal conditions were found.", recommendation: "Check whether rent escalation applies on renewal.", confidence: 0.58, keywords: ["renew", "renewal", "extension of the lease"] }),
    kw({ id: "ra-termination", category: "Termination", severity: "Info", risk: "None", title: "Termination terms present", explanation: "Termination and notice conditions were found.", recommendation: "Understand early-exit penalties and notice requirements.", confidence: 0.58, keywords: ["terminate", "termination", "notice of", "vacate"] }),
    kw({ id: "ra-maintenance", category: "Maintenance", severity: "Info", risk: "None", title: "Maintenance responsibilities described", explanation: "Repair and maintenance obligations are assigned.", recommendation: "Confirm who is responsible for major repairs.", confidence: 0.6, keywords: ["maintenance", "repairs", "maintain", "landlord shall"] }),
    abs({ id: "ra-no-maintenance", category: "Maintenance", severity: "Medium", risk: "Medium", title: "No maintenance clause", explanation: "Repair and maintenance responsibilities are not described.", recommendation: "Add a clause covering major repairs and landlord obligations.", confidence: 0.42, terms: ["maintenance", "repair", "maintain"] }),
    kw({ id: "ra-utilities", category: "Utilities", severity: "Info", risk: "None", title: "Utilities allocation described", explanation: "Utility responsibility (electricity, water) is assigned.", recommendation: "Confirm which bills are the tenant's responsibility.", confidence: 0.58, keywords: ["utilities", "electricity", "water bill", "power"] }),
    kw({ id: "ra-restrictions", category: "Restrictions", severity: "Medium", risk: "Medium", title: "Use restrictions present", explanation: "Restrictions on use, sub-letting, or modifications were found.", recommendation: "Check for rules that limit normal use of the property.", confidence: 0.58, keywords: ["shall not", "sublet", "sub-letting", "no pets", "without prior written consent"] }),
    kw({ id: "ra-penalties", category: "Penalties", severity: "Medium", risk: "Medium", title: "Penalty / late-fee terms", explanation: "Penalties for late payment or early exit were found.", recommendation: "Quantify penalties before committing.", confidence: 0.58, keywords: ["penalty", "late fee", "interest at", "forfeited"] }),
    kw({ id: "ra-notice", category: "Notice", severity: "Info", risk: "None", title: "Notice period identified", explanation: "A notice period for termination or renewal is specified.", recommendation: "Calendar the notice deadline carefully.", confidence: 0.6, keywords: ["days' notice", "days notice", "notice period", "month notice"] }),
  ], ["rent", "lease", "tenancy", "landlord", "tenant"]),

  "employment-contract-analyzer": t("employment-contract-analyzer", "legal", [
    kw({ id: "ec-salary", category: "Compensation", severity: "Info", risk: "None", title: "Compensation identified", explanation: "Salary or compensation terms were found.", recommendation: "Verify the figure matches your offer.", confidence: 0.66, keywords: ["salary", "annual", "per annum", "ctc", "compensation"] }),
    abs({ id: "ec-no-salary", category: "Compensation", severity: "High", risk: "High", title: "No compensation stated", explanation: "No salary or compensation amount was found.", recommendation: "Request compensation in writing before signing.", confidence: 0.45, terms: ["salary", "compensation", "remuneration", "ctc"] }),
    kw({ id: "ec-hours", category: "Work Hours", severity: "Info", risk: "None", title: "Working hours defined", explanation: "Working hours and schedule terms were found.", recommendation: "Confirm the expected schedule and overtime policy.", confidence: 0.58, keywords: ["working hours", "work hours", "hours per week", "shifts"] }),
    kw({ id: "ec-probation", category: "Probation", severity: "Info", risk: "None", title: "Probation period present", explanation: "A probationary period is described.", recommendation: "Note probation length, confirmation criteria, and notice during probation.", confidence: 0.62, keywords: ["probation", "probationary", "confirmation"] }),
    kw({ id: "ec-probation-extension", category: "Probation", severity: "Medium", risk: "Medium", title: "Probation may be extended", explanation: "Language allowing probation extension was found, which can delay confirmation.", recommendation: "Confirm the maximum extension and whether it affects pay/benefits.", confidence: 0.55, keywords: ["extend the probation", "probation may be extended", "extended at the discretion"] }),
    kw({ id: "ec-leave", category: "Leave", severity: "Info", risk: "None", title: "Leave policy referenced", explanation: "Leave entitlements are described.", recommendation: "Confirm annual leave, sick leave, and encashment rules.", confidence: 0.58, keywords: ["leave", "vacation", "annual leave", "sick leave"] }),
    kw({ id: "ec-benefits", category: "Benefits", severity: "Info", risk: "None", title: "Benefits described", explanation: "Benefits such as insurance, retirement, or stock were found.", recommendation: "Confirm which benefits apply from day one.", confidence: 0.58, keywords: ["benefits", "insurance", "provident fund", "esop", "bonus"] }),
    kw({ id: "ec-termination", category: "Termination", severity: "Info", risk: "None", title: "Termination terms present", explanation: "Termination conditions are described.", recommendation: "Review grounds for termination and any severance.", confidence: 0.6, keywords: ["termination", "terminate", "terminated"] }),
    kw({ id: "ec-notice", category: "Notice", severity: "Info", risk: "None", title: "Notice period specified", explanation: "A notice period for resignation or termination is specified.", recommendation: "Note the notice period and any buyout terms.", confidence: 0.6, keywords: ["notice period", "days' notice", "notice of"] }),
    kw({ id: "ec-confidentiality", category: "Confidentiality", severity: "Info", risk: "None", title: "Confidentiality obligations present", explanation: "Confidentiality obligations were found.", recommendation: "Understand what is treated as confidential.", confidence: 0.62, keywords: ["confidentiality", "confidential information", "non-disclosure"] }),
    kw({ id: "ec-ip", category: "Intellectual Property", severity: "Medium", risk: "Medium", title: "IP assignment clause present", explanation: "You may be assigning all work product to the employer.", recommendation: "Check the scope of IP assignment, including personal inventions.", confidence: 0.6, keywords: ["assignment of", "intellectual property", "work product", "all rights"] }),
    kw({ id: "ec-noncompete", category: "Restrictive Covenants", severity: "Medium", risk: "Medium", title: "Non-compete clause present", explanation: "A non-compete or restrictive covenant was found.", recommendation: "Assess enforceability and negotiate scope if overbroad.", confidence: 0.6, keywords: ["non-compete", "non compete", "restrictive covenant", "non-solicit", "during and after"] }),
  ], ["employment", "employment contract", "salary", "probation", "termination"]),

  "salary-slip-analyzer": t("salary-slip-analyzer", "financial", [
    kw({ id: "ss-ctc", category: "Compensation", severity: "Info", risk: "None", title: "Salary components identified", explanation: "Earnings and allowance components were found.", recommendation: "Compare each component with your offer.", confidence: 0.62, keywords: ["basic", "allowance", "hra", "gross", "net"] }),
  ], ["salary", "payslip", "earnings", "deductions", "gross"], "salary"),

  "resume-auditor": t("resume-auditor", "general", [
    kw({ id: "rs-achievements", category: "Content", severity: "Info", risk: "None", title: "Quantified achievements present", explanation: "Achievements with numbers or metrics were found.", recommendation: "Add measurable outcomes where possible.", confidence: 0.55, keywords: ["increased", "reduced", "improved", "%", "managed", "led"] }),
  ], ["resume", "cv", "curriculum vitae", "work experience", "skills"], "resume"),

  "offer-letter-analyzer": t("offer-letter-analyzer", "legal", [
    kw({ id: "ol-comp", category: "Compensation", severity: "Info", risk: "None", title: "Compensation stated", explanation: "The offered compensation was found.", recommendation: "Verify the breakdown (fixed vs variable).", confidence: 0.66, keywords: ["compensation", "salary", "ctc", "package", "per annum"] }),
    abs({ id: "ol-no-comp", category: "Compensation", severity: "High", risk: "High", title: "No compensation stated", explanation: "No compensation amount was found.", recommendation: "Request the compensation in writing.", confidence: 0.45, terms: ["compensation", "salary", "ctc", "package"] }),
    kw({ id: "ol-role", category: "Role", severity: "Info", risk: "None", title: "Role / designation stated", explanation: "The role and responsibilities are described.", recommendation: "Confirm the title matches expectations.", confidence: 0.66, keywords: ["role", "position", "designation", "title", "responsibilities"] }),
    kw({ id: "ol-location", category: "Location", severity: "Info", risk: "None", title: "Location stated", explanation: "Work location is specified.", recommendation: "Confirm remote/office arrangements.", confidence: 0.6, keywords: ["location", "based in", "work from", "office", "city"] }),
    kw({ id: "ol-start", category: "Start Date", severity: "Info", risk: "None", title: "Start date stated", explanation: "The joining date was found.", recommendation: "Confirm the start date and onboarding process.", confidence: 0.66, keywords: ["start date", "joining date", "report to", "commence"] }),
    abs({ id: "ol-no-start", category: "Start Date", severity: "High", risk: "High", title: "No start date stated", explanation: "The joining date is not stated.", recommendation: "Confirm the start date before accepting.", confidence: 0.42, terms: ["start date", "joining date", "commencement", "onboard"] }),
    kw({ id: "ol-probation", category: "Probation", severity: "Info", risk: "None", title: "Probation mentioned", explanation: "A probation period is described.", recommendation: "Note probation length and confirmation criteria.", confidence: 0.62, keywords: ["probation", "probationary", "confirmation"] }),
    kw({ id: "ol-benefits", category: "Benefits", severity: "Info", risk: "None", title: "Benefits mentioned", explanation: "Benefits were found in the offer.", recommendation: "Confirm which benefits are guaranteed vs discretionary.", confidence: 0.58, keywords: ["benefits", "insurance", "allowance", "bonus"] }),
    kw({ id: "ol-conditions", category: "Conditions", severity: "Medium", risk: "Medium", title: "Conditional offer language", explanation: "The offer is subject to conditions or contingencies.", recommendation: "Identify conditions precedent (background checks, documents).", confidence: 0.55, keywords: ["subject to", "contingent upon", "conditional on", "pending"] }),
  ], ["offer letter", "employment offer", "joining", "compensation"]),

  "invoice-auditor": t("invoice-auditor", "financial", [], ["invoice", "tax invoice", "bill", "amount payable"], "invoice"),

  "gst-invoice-checker": t("gst-invoice-checker", "financial", [], ["gstin", "tax invoice", "gst", "supply"], "gst"),

  "tax-notice-analyzer": t("tax-notice-analyzer", "financial", [], ["notice", "assessment", "income tax", "section", "assessing officer"], "tax-notice"),

  "legal-notice-analyzer": t("legal-notice-analyzer", "legal", [], ["legal notice", "advocate", "damages", "notice"], "legal-notice"),

  "loan-agreement-analyzer": t("loan-agreement-analyzer", "financial", [
    kw({ id: "la-principal", category: "Principal", severity: "Info", risk: "None", title: "Loan amount identified", explanation: "The principal loan amount was found.", recommendation: "Verify the amount matches the sanction letter.", confidence: 0.66, keywords: ["loan amount", "principal", "sanctioned amount", "disbursed"] }),
    abs({ id: "la-no-principal", category: "Principal", severity: "High", risk: "High", title: "No loan amount found", explanation: "The principal amount is not stated.", recommendation: "Request the sanctioned amount in writing.", confidence: 0.45, terms: ["loan amount", "principal", "sanction", "disbursement"] }),
    kw({ id: "la-interest", category: "Interest", severity: "Info", risk: "None", title: "Interest rate identified", explanation: "An interest rate was found.", recommendation: "Confirm whether the rate is fixed or floating.", confidence: 0.64, keywords: ["interest rate", "interest at", "rate of interest", "roi"] }),
    kw({ id: "la-apr", category: "Interest", severity: "Info", risk: "None", title: "APR / effective rate present", explanation: "An annual percentage or effective rate was found.", recommendation: "Compare APR with the headline rate to see total cost.", confidence: 0.55, keywords: ["apr", "annual percentage", "effective rate"] }),
    kw({ id: "la-tenure", category: "Tenure", severity: "Info", risk: "None", title: "Repayment tenure identified", explanation: "The repayment period was found.", recommendation: "Confirm tenure and whether it can be changed.", confidence: 0.6, keywords: ["tenure", "repayment period", "months", "years"] }),
    kw({ id: "la-emi", category: "Repayment", severity: "Info", risk: "None", title: "EMI / instalment terms present", explanation: "Equated monthly instalments or repayment schedule are described.", recommendation: "Verify the EMI amount and due dates.", confidence: 0.6, keywords: ["emi", "installment", "instalment", "monthly payment"] }),
    kw({ id: "la-fees", category: "Fees", severity: "Medium", risk: "Medium", title: "Processing or hidden fees", explanation: "Fees such as processing charges were found.", recommendation: "Total all fees and include them in the effective cost.", confidence: 0.55, keywords: ["processing fee", "processing charges", "fee of", "service charge"] }),
    kw({ id: "la-penalties", category: "Penalties", severity: "Medium", risk: "Medium", title: "Late-payment penalty present", explanation: "Penalty interest for late payment was found.", recommendation: "Understand the penalty rate and its compounding.", confidence: 0.58, keywords: ["penalty", "default interest", "late payment", "higher rate"] }),
    kw({ id: "la-prepayment", category: "Prepayment", severity: "Info", risk: "None", title: "Prepayment terms present", explanation: "Prepayment or foreclosure terms were found.", recommendation: "Check whether prepayment penalties apply.", confidence: 0.55, keywords: ["prepayment", "pre-payment", "foreclosure", "early repayment"] }),
    kw({ id: "la-default", category: "Default", severity: "Info", risk: "None", title: "Default clause present", explanation: "Events of default are described.", recommendation: "Review what triggers default and its consequences.", confidence: 0.58, keywords: ["event of default", "default", "recalled"] }),
    kw({ id: "la-collateral", category: "Security", severity: "Info", risk: "None", title: "Collateral / guarantee referenced", explanation: "Collateral, security, or guarantees were found.", recommendation: "Know what assets are pledged and the recourse on default.", confidence: 0.58, keywords: ["collateral", "hypothecation", "pledge", "guarantee", "security"] }),
  ], ["loan", "loan agreement", "interest", "emi", "borrower"], "loan"),

  "bank-statement-analyzer": t("bank-statement-analyzer", "financial", [
    kw({ id: "bs-txn", category: "Transactions", severity: "Info", risk: "None", title: "Transactions identified", explanation: "Transaction records (credits/debits) were found.", recommendation: "Review the statement line by line for unfamiliar activity.", confidence: 0.68, keywords: ["credit", "debit", "balance", "transaction", "deposit", "withdrawal"] }),
    abs({ id: "bs-no-period", category: "Coverage", severity: "Medium", risk: "Medium", title: "No statement period found", explanation: "The statement period or dates are not stated.", recommendation: "Confirm the period the statement covers.", confidence: 0.42, terms: ["statement period", "from", "to", "opening balance"] }),
    kw({ id: "bs-fees", category: "Fees", severity: "Info", risk: "None", title: "Bank charges present", explanation: "Service charges or fees were found.", recommendation: "Check whether the charges are expected.", confidence: 0.55, keywords: ["service charge", "bank charges", "fee", "commission"] }),
  ], ["bank statement", "account", "balance", "transaction", "deposit"], "bank"),

  "medical-report-analyzer": t("medical-report-analyzer", "medical", [
    kw({ id: "mr-patient", category: "Patient", severity: "Info", risk: "None", title: "Patient identifiers found", explanation: "Patient name or identifiers were found.", recommendation: "Verify the report belongs to the correct patient.", confidence: 0.7, keywords: ["patient", "age", "sex", "date of birth", "id"] }),
    kw({ id: "mr-test", category: "Tests", severity: "Info", risk: "None", title: "Test results present", explanation: "Test or investigation results were found.", recommendation: "Compare values against the reference ranges shown.", confidence: 0.64, keywords: ["result", "value", "reference range", "report", "test"] }),
    kw({ id: "mr-abnormal", category: "Tests", severity: "Info", risk: "None", title: "Out-of-range indicators present", explanation: "Markers such as H/L (high/low) were found alongside values.", recommendation: "Flag out-of-range values and discuss with your doctor.", confidence: 0.5, keywords: ["high", "low", "abnormal", "elevated", "reduced", "increase"] }),
  ], ["medical", "report", "patient", "test", "laboratory"], "medical"),

  "prescription-checker": t("prescription-checker", "medical", [
    kw({ id: "px-medication", category: "Medication", severity: "Info", risk: "None", title: "Medication entries found", explanation: "Drug names and dosage entries were found.", recommendation: "Confirm each medicine and its dosage with your pharmacist.", confidence: 0.62, keywords: ["mg", "tablet", "capsule", "dose", "twice", "once", "daily"] }),
    kw({ id: "px-duration", category: "Medication", severity: "Info", risk: "None", title: "Duration / frequency present", explanation: "Duration or frequency instructions were found.", recommendation: "Follow the prescribed duration and do not stop early.", confidence: 0.58, keywords: ["days", "weeks", "times", "per day", "for"] }),
    abs({ id: "px-no-doctor", category: "Validity", severity: "Medium", risk: "Medium", title: "No prescriber details found", explanation: "The prescriber name or registration details were not found.", recommendation: "Verify the prescription is from a registered practitioner.", confidence: 0.45, terms: ["dr", "doctor", "prescribed", "registered"] }),
  ], ["prescription", "medication", "dosage", "doctor", "medicine"], "prescription"),

  "research-paper-reviewer": t("research-paper-reviewer", "general", [], ["research", "study", "methodology", "references", "abstract"], "research"),

  "patent-risk-analyzer": t("patent-risk-analyzer", "general", [
    kw({ id: "pt-claims", category: "Claims", severity: "Info", risk: "None", title: "Claim language detected", explanation: "Patent claim-like language was found.", recommendation: "Review claim scope carefully before filing or launch.", confidence: 0.6, keywords: ["claim 1", "wherein", "comprising", "claims"] }),
    kw({ id: "pt-ambiguity", category: "Clarity", severity: "Medium", risk: "Medium", title: "Ambiguity indicators in claims", explanation: "Open-ended or approximate language that can weaken claims was found.", recommendation: "Narrow ambiguous terms to strengthen enforceability.", confidence: 0.5, keywords: ["approximately", "optionally", "about", "such as", "and/or"] }),
    kw({ id: "pt-consistency", category: "Consistency", severity: "Info", risk: "None", title: "Consistency language present", explanation: "Dependent claim references were found.", recommendation: "Ensure dependent claims are consistent with the independent claims.", confidence: 0.55, keywords: ["according to claim", "further comprising", "the method of claim"] }),
    abs({ id: "pt-no-abstract", category: "Structure", severity: "Medium", risk: "Medium", title: "No abstract or summary found", explanation: "No abstract or summary section was detected.", recommendation: "Add an abstract summarizing the invention.", confidence: 0.45, terms: ["abstract", "summary", "field of the invention"] }),
  ], ["patent", "invention", "claims", "prior art"]),

  "trademark-checker": t("trademark-checker", "general", [
    kw({ id: "tm-mark", category: "Mark", severity: "Info", risk: "None", title: "Brand / mark identified", explanation: "A brand name or mark reference was found.", recommendation: "Use the exact mark when searching registries.", confidence: 0.6, keywords: ["trademark", "brand", "logo", "mark", "label"] }),
    kw({ id: "tm-goods", category: "Goods & Services", severity: "Info", risk: "None", title: "Goods/services described", explanation: "The goods or services associated with the mark are described.", recommendation: "Map goods/services to the correct Nice classes.", confidence: 0.55, keywords: ["goods", "services", "class", "goods and services"] }),
    kw({ id: "tm-classes", category: "Classes", severity: "Info", risk: "None", title: "Class numbers present", explanation: "Nice class numbers were found.", recommendation: "Verify classes cover all planned uses.", confidence: 0.55, keywords: ["class 1", "class 5", "class 9", "class 25", "class 35"] }),
  ], ["trademark", "brand", "logo", "class"], "trademark"),

  "copyright-risk-analyzer": t("copyright-risk-analyzer", "general", [
    kw({ id: "cr-ownership", category: "Ownership", severity: "Info", risk: "None", title: "Copyright ownership addressed", explanation: "Copyright ownership references were found.", recommendation: "Confirm you own or have rights to all included material.", confidence: 0.58, keywords: ["copyright", "owner of", "exclusive rights"] }),
    kw({ id: "cr-license", category: "Licensing", severity: "Info", risk: "None", title: "Licensing terms present", explanation: "License references were found.", recommendation: "Check license scope, duration, and restrictions.", confidence: 0.58, keywords: ["license", "licensed under", "creative commons", "royalty-free"] }),
    kw({ id: "cr-third-party", category: "Third-Party Material", severity: "Medium", risk: "Medium", title: "Third-party material references", explanation: "Material that may belong to third parties was detected.", recommendation: "Obtain permission for third-party content before use.", confidence: 0.55, keywords: ["third party", "third-party", "courtesy of", "licensed material"] }),
    kw({ id: "cr-attribution", category: "Attribution", severity: "Info", risk: "None", title: "Attribution requirements present", explanation: "Attribution or credit requirements were found.", recommendation: "Ensure correct attribution is displayed.", confidence: 0.55, keywords: ["attribution", "credit", "all rights reserved"] }),
    kw({ id: "cr-usage-rights", category: "Usage Rights", severity: "Info", risk: "None", title: "Usage rights described", explanation: "Usage or permission language was found.", recommendation: "Confirm the exact permitted uses.", confidence: 0.55, keywords: ["right to use", "permission", "may be used", "reproduce"] }),
    kw({ id: "cr-transfer", category: "Transfer", severity: "Info", risk: "None", title: "Transfer / assignment language", explanation: "Assignment or transfer of rights was found.", recommendation: "Confirm whether rights are transferred or licensed.", confidence: 0.55, keywords: ["transfer", "assign", "waive"] }),
  ], ["copyright", "reproduction", "attribution", "permission"]),

  "website-privacy-audit": t("website-privacy-audit", "general", [], ["privacy policy", "cookies", "personal data"], "website-privacy"),

  "cookie-compliance-checker": t("cookie-compliance-checker", "general", [], ["cookie", "consent", "banner"], "cookie"),

  "seo-audit": t("seo-audit", "general", [], ["seo", "title", "meta"], "seo"),

  "accessibility-audit": t("accessibility-audit", "general", [], ["accessibility", "wcag", "a11y"], "accessibility"),

  "cyber-security-checklist": t("cyber-security-checklist", "security", [], ["security", "headers", "tls", "https"], "cyber-security"),

  "ai-content-detector": t("ai-content-detector", "ai-content", [], [], "ai-content"),

  "scam-detector": t("scam-detector", "fraud", [
    kw({ id: "sm-urgency", category: "Urgency", severity: "High", risk: "High", title: "Urgency pressure detected", explanation: "Language designed to rush you into acting was found. This is a common manipulation tactic.", recommendation: "Slow down and verify the sender through an independent channel.", confidence: 0.7, keywords: ["urgent", "immediately", "act now", "within 24 hours", "right away", "asap", "limited time"] }),
    kw({ id: "sm-unrealistic", category: "Unrealistic Claims", severity: "High", risk: "High", title: "Unrealistic promise detected", explanation: "Claims of guaranteed returns, prizes, or no-risk offers were found.", recommendation: "Treat guaranteed-return offers with high suspicion.", confidence: 0.72, keywords: ["guaranteed", "no risk", "100%", "lottery", "prize", "inheritance", "you have won", "free money"] }),
    kw({ id: "sm-payment", category: "Payment Pressure", severity: "Critical", risk: "Critical", title: "Payment or advance-fee pressure", explanation: "Requests for payment, wire transfer, or gift cards were found - a hallmark of advance-fee scams.", recommendation: "Never pay or share card details in response to unsolicited contact.", confidence: 0.75, keywords: ["wire transfer", "western union", "advance fee", "gift card", "crypto", "bitcoin", "processing fee", "paypal", "money to release"] }),
    kw({ id: "sm-secrecy", category: "Manipulation", severity: "High", risk: "High", title: "Secrecy / isolation pressure", explanation: "Instructions to keep the matter secret were found, used to prevent you from checking with others.", recommendation: "Tell a trusted person before acting on any such message.", confidence: 0.62, keywords: ["keep this confidential", "don't tell anyone", "do not share this", "secret", "confidential matter"] }),
    kw({ id: "sm-contact", category: "Contact", severity: "Medium", risk: "Medium", title: "Generic or unusual contact details", explanation: "Contact details that are generic or inconsistent were detected.", recommendation: "Verify phone numbers and domains against official sources.", confidence: 0.5, keywords: ["customer care", "helpline", "refund@", "claims@", "support@gmail", "free email"] }),
  ], ["scam", "fraud", "lottery", "prize", "urgent"], "scam"),

  "fraud-risk-analyzer": t("fraud-risk-analyzer", "fraud", [], ["fraud", "inconsistent", "duplicate", "forged"], "fraud"),

  "financial-risk-analyzer": t("financial-risk-analyzer", "financial", [
    kw({ id: "fr-debt", category: "Debt", severity: "Info", risk: "None", title: "Debt / liability references", explanation: "Debt or liability items were found.", recommendation: "Assess debt relative to income and repayment capacity.", confidence: 0.58, keywords: ["debt", "liabilities", "loan", "outstanding"] }),
    kw({ id: "fr-cashflow", category: "Cash Flow", severity: "Info", risk: "None", title: "Cash-flow indicators present", explanation: "Receivables, payables, or cash-flow language was found.", recommendation: "Model monthly cash flow against obligations.", confidence: 0.55, keywords: ["cash flow", "receivable", "payable", "liquidity"] }),
    kw({ id: "fr-concentration", category: "Concentration", severity: "Medium", risk: "Medium", title: "Concentration risk indicators", explanation: "Language suggesting dependence on a single customer or revenue source.", recommendation: "Diversify revenue sources to reduce concentration risk.", confidence: 0.5, keywords: ["single customer", "dependence", "concentration", "key account", "majority of revenue"] }),
    kw({ id: "fr-exposure", category: "Exposure", severity: "Info", risk: "None", title: "Exposure references", explanation: "Exposure or credit-limit language was found.", recommendation: "Quantify exposures and set limits.", confidence: 0.55, keywords: ["exposure", "credit limit", "facility"] }),
    kw({ id: "fr-obligations", category: "Payment Obligations", severity: "Info", risk: "None", title: "Payment obligations found", explanation: "Instalments or due obligations were detected.", recommendation: "Calendar all due payments to avoid default.", confidence: 0.55, keywords: ["installment", "due on", "payment obligation", "repay"] }),
  ], ["financial", "risk", "debt", "cash flow", "liability"]),

  "business-proposal-reviewer": t("business-proposal-reviewer", "general", [], ["proposal", "business", "revenue", "market"], "business-proposal"),

  "nda-analyzer": t("nda-analyzer", "legal", [
    kw({ id: "nda-definition", category: "Confidential Information", severity: "Info", risk: "None", title: "Confidential information defined", explanation: "The scope of confidential information is defined.", recommendation: "Check whether the definition is broad or specific.", confidence: 0.64, keywords: ["confidential information", "proprietary information", "information disclosed"] }),
    abs({ id: "nda-no-definition", category: "Confidential Information", severity: "High", risk: "High", title: "No definition of confidential information", explanation: "What counts as confidential information is not defined.", recommendation: "Require a clear definition of confidential information.", confidence: 0.45, terms: ["confidential information", "proprietary information", "confidential"] }),
    kw({ id: "nda-purpose", category: "Permitted Use", severity: "Info", risk: "None", title: "Permitted use defined", explanation: "The purpose for which information may be used is described.", recommendation: "Ensure the purpose matches your actual use.", confidence: 0.6, keywords: ["permitted use", "sole purpose", "for the purpose of", "evaluation"] }),
    kw({ id: "nda-duration", category: "Duration", severity: "Info", risk: "None", title: "Duration / survival period present", explanation: "The term of the obligations is defined.", recommendation: "Note how long obligations survive the agreement.", confidence: 0.58, keywords: ["for a period of", "survive", "term of", "years after"] }),
    abs({ id: "nda-no-duration", category: "Duration", severity: "Medium", risk: "Medium", title: "No duration or survival period", explanation: "How long the obligations last is not stated.", recommendation: "Confirm the duration of confidentiality obligations.", confidence: 0.42, terms: ["for a period of", "survive", "term of", "termination of this agreement"] }),
    kw({ id: "nda-exceptions", category: "Exceptions", severity: "Info", risk: "None", title: "Exceptions to confidentiality", explanation: "Carve-outs (public domain, independent development) were found.", recommendation: "Confirm standard exceptions are included.", confidence: 0.58, keywords: ["public domain", "independently developed", "required by law", "exception"] }),
    kw({ id: "nda-return", category: "Return & Destruction", severity: "Info", risk: "None", title: "Return / destruction obligation present", explanation: "Obligations to return or destroy information were found.", recommendation: "Comply with return/destruction on termination.", confidence: 0.58, keywords: ["return", "destroy", "certify", "delete"] }),
    kw({ id: "nda-remedies", category: "Remedies", severity: "Medium", risk: "Medium", title: "Injunctive relief clause", explanation: "The NDA reserves injunctive relief for breach.", recommendation: "Understand that breaches can trigger court orders.", confidence: 0.55, keywords: ["injunctive relief", "irreparable harm", "remedies"] }),
    kw({ id: "nda-jurisdiction", category: "Governing Law", severity: "Info", risk: "None", title: "Governing law present", explanation: "The governing law is specified.", recommendation: "Confirm the jurisdiction.", confidence: 0.64, keywords: ["governing law", "jurisdiction", "shall be governed"] }),
  ], ["nda", "non-disclosure", "confidentiality", "mutual"], "nda"),

  "vendor-agreement-auditor": t("vendor-agreement-auditor", "legal", [
    kw({ id: "va-scope", category: "Scope", severity: "Info", risk: "None", title: "Scope of services defined", explanation: "The services to be delivered are described.", recommendation: "Confirm the scope matches your needs.", confidence: 0.6, keywords: ["scope of", "services", "deliverables"] }),
    abs({ id: "va-no-scope", category: "Scope", severity: "High", risk: "High", title: "No scope of work defined", explanation: "What the vendor will deliver is not described.", recommendation: "Define deliverables and acceptance criteria.", confidence: 0.45, terms: ["scope", "services", "deliverables"] }),
    kw({ id: "va-sla", category: "SLA", severity: "Info", risk: "None", title: "Service levels defined", explanation: "SLA or performance metrics were found.", recommendation: "Set realistic SLAs with remedies for failure.", confidence: 0.58, keywords: ["sla", "service level", "uptime", "response time", "availability"] }),
    kw({ id: "va-pricing", category: "Pricing", severity: "Info", risk: "None", title: "Pricing defined", explanation: "Fees or rates were found.", recommendation: "Verify pricing structure and any escalation.", confidence: 0.62, keywords: ["price", "fee", "rate", "cost", "charges"] }),
    kw({ id: "va-payment", category: "Payment", severity: "Info", risk: "None", title: "Payment terms present", explanation: "Payment terms were found.", recommendation: "Confirm invoicing cadence and due dates.", confidence: 0.6, keywords: ["payment terms", "net 30", "invoice", "payable"] }),
    kw({ id: "va-liability", category: "Liability", severity: "Info", risk: "None", title: "Liability terms present", explanation: "Liability provisions were found.", recommendation: "Check caps and exclusions.", confidence: 0.6, keywords: ["limitation of liability", "aggregate liability", "liability"] }),
    kw({ id: "va-indemnity", category: "Indemnity", severity: "Info", risk: "None", title: "Indemnity clause present", explanation: "Indemnification terms were found.", recommendation: "Scope the indemnity to the vendor's fault.", confidence: 0.58, keywords: ["indemnify", "hold harmless", "indemnification"] }),
    kw({ id: "va-data", category: "Data", severity: "Info", risk: "None", title: "Data provisions present", explanation: "Data handling or protection terms were found.", recommendation: "Confirm data ownership and protection obligations.", confidence: 0.55, keywords: ["personal data", "data protection", "data", "confidential"] }),
    kw({ id: "va-termination", category: "Termination", severity: "Info", risk: "None", title: "Termination terms present", explanation: "Termination rights are described.", recommendation: "Check for convenience termination and exit assistance.", confidence: 0.58, keywords: ["termination", "terminate", "exit"] }),
    kw({ id: "va-ip", category: "Intellectual Property", severity: "Info", risk: "None", title: "IP ownership addressed", explanation: "IP ownership for deliverables is described.", recommendation: "Ensure you own the deliverables.", confidence: 0.58, keywords: ["intellectual property", "ownership", "work product"] }),
    kw({ id: "va-renewal", category: "Renewal", severity: "Info", risk: "None", title: "Renewal terms present", explanation: "Renewal provisions were found.", recommendation: "Watch for automatic renewal and price changes.", confidence: 0.55, keywords: ["renew", "renewal", "automatically renew"] }),
  ], ["vendor", "supplier", "services agreement", "pricing", "sla"]),

  "partnership-agreement-auditor": t("partnership-agreement-auditor", "legal", [
    kw({ id: "pa-ownership", category: "Ownership", severity: "Info", risk: "None", title: "Ownership / share structure defined", explanation: "Ownership or share percentages were found.", recommendation: "Confirm percentages match the commercial deal.", confidence: 0.6, keywords: ["ownership", "share", "equity", "percentage", "holdings"] }),
    abs({ id: "pa-no-ownership", category: "Ownership", severity: "High", risk: "High", title: "No ownership structure defined", explanation: "Ownership percentages are not defined.", recommendation: "Define ownership and shareholding clearly.", confidence: 0.45, terms: ["ownership", "share", "equity", "percentage"] }),
    kw({ id: "pa-capital", category: "Capital", severity: "Info", risk: "None", title: "Capital contributions defined", explanation: "Capital contribution terms were found.", recommendation: "Confirm contribution amounts and timelines.", confidence: 0.58, keywords: ["capital", "contribution", "contribute", "initial capital"] }),
    kw({ id: "pa-profit", category: "Profit Share", severity: "Info", risk: "None", title: "Profit-sharing defined", explanation: "Profit distribution rules were found.", recommendation: "Confirm profit/loss sharing ratios.", confidence: 0.58, keywords: ["profit", "profit sharing", "distribution", "losses"] }),
    kw({ id: "pa-decisions", category: "Decision Making", severity: "Info", risk: "None", title: "Decision-making process defined", explanation: "Management and decision procedures were found.", recommendation: "Confirm which decisions require unanimity.", confidence: 0.58, keywords: ["decision", "management", "unanimous", "majority", "board"] }),
    kw({ id: "pa-exit", category: "Exit", severity: "Info", risk: "None", title: "Exit terms present", explanation: "Exit or buyout provisions were found.", recommendation: "Understand valuation method on exit.", confidence: 0.55, keywords: ["exit", "buyout", "transfer of shares", "departure"] }),
    kw({ id: "pa-deadlock", category: "Deadlock", severity: "Info", risk: "None", title: "Deadlock / dispute resolution present", explanation: "Deadlock resolution procedures were found.", recommendation: "Test the deadlock mechanism is workable.", confidence: 0.55, keywords: ["deadlock", "dispute resolution", "arbitration"] }),
    kw({ id: "pa-liability", category: "Liability", severity: "Medium", risk: "Medium", title: "Liability terms present", explanation: "Liability language, including joint and several, was found.", recommendation: "Understand personal liability exposure.", confidence: 0.55, keywords: ["joint and several", "liability", "personally liable"] }),
    kw({ id: "pa-dissolution", category: "Dissolution", severity: "Info", risk: "None", title: "Dissolution terms present", explanation: "Dissolution and wind-up procedures were found.", recommendation: "Review dissolution triggers and asset distribution.", confidence: 0.55, keywords: ["dissolution", "wind up", "dissolve"] }),
    kw({ id: "pa-ip", category: "Intellectual Property", severity: "Info", risk: "None", title: "IP ownership addressed", explanation: "IP ownership between partners is described.", recommendation: "Confirm who owns partnership IP.", confidence: 0.55, keywords: ["intellectual property", "ip", "ownership"] }),
  ], ["partnership", "partners", "profit share", "capital"]),

  "due-diligence-analyzer": t("due-diligence-analyzer", "general", [
    kw({ id: "dd-corporate", category: "Corporate", severity: "Info", risk: "None", title: "Corporate identity references", explanation: "Registration or incorporation references were found.", recommendation: "Verify registration details against official records.", confidence: 0.55, keywords: ["registered", "incorporation", "registration number", "company", "c/o"] }),
    kw({ id: "dd-ownership", category: "Ownership", severity: "Info", risk: "None", title: "Ownership references found", explanation: "Shareholder or beneficial-owner references were found.", recommendation: "Map the ownership chain and beneficial owners.", confidence: 0.55, keywords: ["shareholder", "ownership", "beneficial owner", "director"] }),
    kw({ id: "dd-financial", category: "Financial", severity: "Info", risk: "None", title: "Financial information present", explanation: "Revenue, balance-sheet, or profit references were found.", recommendation: "Obtain audited financials where possible.", confidence: 0.55, keywords: ["revenue", "balance sheet", "profit", "audited", "turnover"] }),
    kw({ id: "dd-legal", category: "Legal", severity: "Info", risk: "None", title: "Litigation references found", explanation: "Pending litigation or dispute references were detected.", recommendation: "Request details of all pending cases.", confidence: 0.55, keywords: ["litigation", "pending case", "lawsuit", "disputes", "proceedings"] }),
    kw({ id: "dd-contracts", category: "Contracts", severity: "Info", risk: "None", title: "Contract references found", explanation: "Material agreements are referenced.", recommendation: "Review key contracts and change-of-control terms.", confidence: 0.55, keywords: ["contract", "agreement", "addendum"] }),
    kw({ id: "dd-compliance", category: "Compliance", severity: "Info", risk: "None", title: "Compliance references found", explanation: "Licenses, permits, or regulatory references were found.", recommendation: "Verify licenses and regulatory standing.", confidence: 0.55, keywords: ["compliance", "license", "permit", "regulatory", "registered with"] }),
    kw({ id: "dd-operational", category: "Operations", severity: "Info", risk: "None", title: "Operational references found", explanation: "Employees, facilities, or operations references were found.", recommendation: "Assess operational continuity risks.", confidence: 0.55, keywords: ["employees", "operations", "facilities", "staff"] }),
  ], ["due diligence", "company", "target", "acquisition"], "due-diligence"),

  "corporate-governance-audit": t("corporate-governance-audit", "general", [
    kw({ id: "cg-board", category: "Board", severity: "Info", risk: "None", title: "Board structure references", explanation: "Board of directors references were found.", recommendation: "Verify board composition and independence.", confidence: 0.55, keywords: ["board of directors", "board", "directors"] }),
    abs({ id: "cg-no-board", category: "Board", severity: "High", risk: "High", title: "No board governance references", explanation: "No board or oversight references were found.", recommendation: "Document the governance structure.", confidence: 0.42, terms: ["board", "director", "governance"] }),
    kw({ id: "cg-roles", category: "Roles", severity: "Info", risk: "None", title: "Leadership roles identified", explanation: "Key roles such as CEO or chair were found.", recommendation: "Document role separation and authority.", confidence: 0.55, keywords: ["chairman", "ceo", "chief executive", "chief financial", "managing director"] }),
    kw({ id: "cg-approvals", category: "Approvals", severity: "Info", risk: "None", title: "Approval processes referenced", explanation: "Approval and ratification language was found.", recommendation: "Confirm material decisions require board approval.", confidence: 0.55, keywords: ["approval", "approved by", "ratified", "sanctioned"] }),
    kw({ id: "cg-conflicts", category: "Conflicts", severity: "Info", risk: "None", title: "Conflict-of-interest references", explanation: "Conflict of interest or related-party language was found.", recommendation: "Require disclosure of related-party transactions.", confidence: 0.55, keywords: ["conflict of interest", "related party", "interested director"] }),
    kw({ id: "cg-policies", category: "Policies", severity: "Info", risk: "None", title: "Governance policies referenced", explanation: "Policy or code-of-conduct references were found.", recommendation: "Ensure policies are adopted and communicated.", confidence: 0.55, keywords: ["policy", "code of conduct", "whistleblower"] }),
    kw({ id: "cg-records", category: "Records", severity: "Info", risk: "None", title: "Records references found", explanation: "Minutes, registers, or records references were found.", recommendation: "Ensure statutory records are maintained.", confidence: 0.55, keywords: ["minutes", "register", "records", "statutory"] }),
    kw({ id: "cg-controls", category: "Controls", severity: "Info", risk: "None", title: "Internal control references", explanation: "Internal control or audit references were found.", recommendation: "Establish an audit committee and controls.", confidence: 0.55, keywords: ["internal control", "audit committee", "internal audit"] }),
  ], ["governance", "board", "policy", "corporate"]),

  "compliance-checker": t("compliance-checker", "general", [
    kw({ id: "cc-licenses", category: "Licenses", severity: "Info", risk: "None", title: "License references found", explanation: "Licenses or registrations were found.", recommendation: "Validate each license against the checklist.", confidence: 0.55, keywords: ["license", "licence", "registration", "permit"] }),
    kw({ id: "cc-records", category: "Records", severity: "Info", risk: "None", title: "Record-keeping references", explanation: "Record-keeping or filing references were found.", recommendation: "Verify filings are current.", confidence: 0.55, keywords: ["filing", "record", "return", "submission"] }),
    kw({ id: "cc-regulatory", category: "Regulatory", severity: "Info", risk: "None", title: "Regulatory references found", explanation: "Regulatory or statutory references were found.", recommendation: "Map requirements to the applicable framework.", confidence: 0.55, keywords: ["regulation", "statutory", "act,", "rules", "directive"] }),
    kw({ id: "cc-disclosures", category: "Disclosures", severity: "Info", risk: "None", title: "Disclosure references found", explanation: "Disclosure obligations are referenced.", recommendation: "Verify required disclosures are made.", confidence: 0.55, keywords: ["disclosure", "declare", "intimate", "notify"] }),
  ], ["compliance", "regulation", "license", "act"], "compliance"),

  "clause-risk-detection": t("clause-risk-detection", "legal", [
    kw({ id: "cl-force-majeure", category: "Force Majeure", severity: "Low", risk: "Low", title: "Force majeure clause", explanation: "A force majeure clause was found.", recommendation: "Check whether the clause covers the relevant events.", confidence: 0.6, keywords: ["force majeure", "act of god", "unforeseen"] }),
    kw({ id: "cl-entire-agreement", category: "Structure", severity: "Info", risk: "None", title: "Entire agreement clause", explanation: "An entire-agreement clause was found.", recommendation: "Ensure all promises are in writing.", confidence: 0.6, keywords: ["entire agreement", "supersedes", "complete and exclusive"] }),
    kw({ id: "cl-assignment", category: "Assignment", severity: "Medium", risk: "Medium", title: "Assignment restriction", explanation: "Assignment or transfer restrictions were found.", recommendation: "Confirm consent requirements for assignment.", confidence: 0.58, keywords: ["may not assign", "cannot transfer", "without consent"] }),
    kw({ id: "cl-notices", category: "Notices", severity: "Info", risk: "None", title: "Notice provisions present", explanation: "Notice provisions were found.", recommendation: "Note the required notice format.", confidence: 0.58, keywords: ["notice in writing", "notices", "in writing"] }),
    kw({ id: "cl-survival", category: "Survival", severity: "Info", risk: "None", title: "Survival clause present", explanation: "Survival provisions were found.", recommendation: "Confirm which clauses survive termination.", confidence: 0.58, keywords: ["survive", "survival", "shall survive"] }),
  ], ["clause", "agreement", "terms"], "clause-risk"),

  "custom-ai-audit": t("custom-ai-audit", "general", [], [], "custom-audit"),

  "document-comparison": t("document-comparison", "legal", [], ["version", "revised", "comparison"], "document-comparison"),
};

export function getToolLogic(slug: string): ToolLogic | undefined {
  return TOOL_LOGIC[slug];
}

export const SAFETY_DISCLAIMERS: Record<SafetyDomain, string> = {
  legal:
    "This is document analysis, not legal advice or legal representation. An attorney should review anything you sign.",
  medical:
    "This tool summarizes information in your documents. It does not diagnose, prescribe, or treat any medical condition. Always consult a qualified healthcare professional.",
  financial:
    "This tool provides indicative analysis, not guaranteed financial, tax, or investment advice. Verify figures with a professional adviser.",
  fraud:
    "These are indicators of possible fraud, not accusations against any person or organization. Verification through official channels is essential before any action.",
  security:
    "Only authorized security testing is permitted. These checks are limited to public information and do not scan, exploit, or attack any system.",
  "ai-content":
    "AI-content detection is probabilistic and imperfect. It is not proof of authorship or generation.",
  general:
    "This analysis is informational. It is not professional advice and should be reviewed with a qualified professional before relying on it.",
};
