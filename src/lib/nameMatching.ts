/**
 * Full Name Verification and Record Matching Utility
 *
 * Ensures court and international registry results only count as adverse matches
 * if the candidate's full name matches an actual party or subject, preventing
 * false positives from partial keyword matches, judge names, venue, or counsel.
 */

export function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|atty|hon|prof|engr|adv|sir|dame|rev)\b\.?/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractIndividualParties(text: string): string[] {
  if (!text) return [];
  const vsSplit = text.split(/\s+(?:v\.?|vs\.?|versus|lwn\.?|against|and)\s+/i);
  const parties: string[] = [];

  for (const part of vsSplit) {
    const subParts = part.split(/;|\b\d+\.\s+/);
    for (const sp of subParts) {
      const clean = sp.trim();
      if (clean) parties.push(clean);
    }
  }
  return parties;
}

export function isExactFullNameMatch(candidateName: string, partyText: string): boolean {
  if (!candidateName || !partyText) return false;
  const normCandidate = normalizeName(candidateName);
  if (!normCandidate) return false;
  const candidateTokens = normCandidate.split(" ").filter((t) => t.length > 0);
  if (candidateTokens.length === 0) return false;

  const parties = extractIndividualParties(partyText);
  if (parties.length === 0) parties.push(partyText);

  for (const p of parties) {
    const normParty = normalizeName(p);
    if (!normParty) continue;

    // 1. Direct exact match
    if (normParty === normCandidate) return true;

    // 2. Inverted exact match (e.g. "Tan Meng" vs "Meng Tan")
    if (candidateTokens.length > 1) {
      const inverted = [...candidateTokens].reverse().join(" ");
      if (normParty === inverted) return true;
    }

    // 3. Remove common structural legal roles
    const strippedParty = normParty
      .replace(
        /\b(claimant|defendant|accused|petitioner|respondent|appellant|appellee|plaintiff|applicant|deceased|minor|representation|counsel|llc|advocates|solicitors)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    if (strippedParty === normCandidate) return true;
    if (candidateTokens.length > 1 && strippedParty === [...candidateTokens].reverse().join(" ")) return true;

    // 4. Exact phrase boundary match inside party text
    const phrasePattern = new RegExp("(^|\\W)" + normCandidate.replace(/\s+/g, "\\s+") + "($|\\W)", "i");
    const match = phrasePattern.exec(strippedParty);
    if (match) {
      const partyWords = strippedParty.split(" ").filter((w) => w.length > 0);
      if (partyWords.length === candidateTokens.length) return true;

      const candIdx = partyWords.findIndex((_, i) =>
        candidateTokens.every((ct, ci) => partyWords[i + ci] === ct)
      );

      if (candIdx !== -1) {
        const wordBefore = candIdx > 0 ? partyWords[candIdx - 1] : "";
        const wordAfter =
          candIdx + candidateTokens.length < partyWords.length
            ? partyWords[candIdx + candidateTokens.length]
            : "";

        const legalNonNames = new Set([
          "trading",
          "as",
          "t/a",
          "pty",
          "ltd",
          "sdn",
          "bhd",
          "inc",
          "co",
          "corp",
          "pte",
          "the",
          "estate",
          "of",
        ]);

        const beforeIsNonName = !wordBefore || legalNonNames.has(wordBefore);
        const afterIsNonName = !wordAfter || legalNonNames.has(wordAfter);
        if (beforeIsNonName && afterIsNonName) return true;
      }
    }
  }

  return false;
}

export function isRecordFullNameMatch(
  candidateName: string,
  fields: (string | undefined | null | string[])[]
): boolean {
  if (!candidateName || !candidateName.trim()) return false;

  for (const field of fields) {
    if (!field) continue;
    if (Array.isArray(field)) {
      for (const item of field) {
        if (isExactFullNameMatch(candidateName, item)) return true;
      }
    } else {
      if (isExactFullNameMatch(candidateName, field)) return true;
    }
  }
  return false;
}

function checkSingleProvinceMatch(
  rec: { province?: string; court?: string; citation?: string; url?: string },
  targetProvince: string
): boolean {
  if (!targetProvince || !targetProvince.trim()) return true;
  const prov = targetProvince.trim().toLowerCase();

  const provMap: Record<string, { codes: string[]; urlTokens: string[]; keywords: string[] }> = {
    "gauteng": {
      codes: ["zagp", "zagpjhc", "zagpphc"],
      urlTokens: ["za-gp"],
      keywords: ["gauteng", "pretoria", "johannesburg"]
    },
    "western cape": {
      codes: ["zawc", "zawchc"],
      urlTokens: ["za-wc"],
      keywords: ["western cape", "cape town"]
    },
    "eastern cape": {
      codes: ["zaec", "zaecghc", "zaecmhc", "zaecpehc", "zaecellc"],
      urlTokens: ["za-ec"],
      keywords: ["eastern cape", "grahamstown", "mthatha", "port elizabeth", "bhisho", "gqeberha", "makhanda"]
    },
    "kwazulu-natal": {
      codes: ["zakz", "zakzdhc", "zakzphc"],
      urlTokens: ["za-kzn"],
      keywords: ["kwazulu-natal", "kwazulu", "natal", "durban", "pietermaritzburg"]
    },
    "free state": {
      codes: ["zafs", "zafshc"],
      urlTokens: ["za-fs"],
      keywords: ["free state", "bloemfontein"]
    },
    "limpopo": {
      codes: ["zalb", "zalbhc", "zalmphc"],
      urlTokens: ["za-lp"],
      keywords: ["limpopo", "polokwane", "thohoyandou"]
    },
    "mpumalanga": {
      codes: ["zamn", "zamnphc", "zambhc"],
      urlTokens: ["za-mp"],
      keywords: ["mpumalanga", "nelspruit", "mbombela", "middelburg"]
    },
    "north west": {
      codes: ["zanw", "zanwhc"],
      urlTokens: ["za-nw"],
      keywords: ["north west", "mahikeng", "mafikeng"]
    },
    "northern cape": {
      codes: ["zanc", "zanchc"],
      urlTokens: ["za-nc"],
      keywords: ["northern cape", "kimberley"]
    },
  };

  const config = provMap[prov];
  if (!config) {
    const pStr = (rec.province || "").toLowerCase();
    const cStr = (rec.court || "").toLowerCase();
    return pStr.includes(prov) || cStr.includes(prov);
  }

  const recProv = (rec.province || "").toLowerCase();
  const recCourt = (rec.court || "").toLowerCase();
  const recUrl = (rec.url || "").toLowerCase();
  const recCitation = (rec.citation || "").toLowerCase();

  // 1. Direct province label check
  if (recProv && config.keywords.some((k) => recProv.includes(k))) return true;

  // 2. Canonical URL segment check e.g. /akn/za-gp/
  if (recUrl && config.urlTokens.some((u) => recUrl.includes(u))) return true;

  // 3. Official Citation check e.g. [2026] ZAGPJHC
  if (recCitation && config.codes.some((c) => recCitation.includes(c))) return true;

  // 4. Court name check e.g. High Court South Gauteng
  if (recCourt && config.keywords.some((k) => recCourt.includes(k))) return true;

  return false;
}

export function isRecordProvinceMatch(
  rec: { province?: string; court?: string; citation?: string; url?: string },
  targetProvince?: string | string[]
): boolean {
  if (!targetProvince) return true;
  const provList = Array.isArray(targetProvince)
    ? targetProvince
    : targetProvince.split(",").map((p) => p.trim()).filter(Boolean);
  if (provList.length === 0) return true;
  return provList.some((prov) => checkSingleProvinceMatch(rec, prov));
}
