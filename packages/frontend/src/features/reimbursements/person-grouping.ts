import type { PendingReimbursementSummary } from "../../lib/api";

export const UNKNOWN_PERSON_LABEL = "Pessoa não identificada";

const UNKNOWN_BUCKET_KEY = "__unknown_person__";

export type PersonGroupMatchReason =
  | "normalized_exact"
  | "minor_token_typo"
  | "single_token_unique_match"
  | "fuzzy_high_similarity"
  | "unmatched";

export type ReimbursementPersonAlias = {
  alias: string;
  count: number;
  latest_occurred_at: string;
  normalized_name: string;
  match_reason: PersonGroupMatchReason;
};

export type ReimbursementPersonGroup = {
  group_id: string;
  canonical_name: string;
  canonical_normalized_name: string;
  aliases: string[];
  alias_details: ReimbursementPersonAlias[];
  items: PendingReimbursementSummary[];
  outstanding_total: number;
  item_count: number;
  status_counts: Record<PendingReimbursementSummary["status"], number>;
  latest_occurred_at: string;
};

type PersonBucket = {
  bucket_key: string;
  normalized_name: string;
  tokens: string[];
  items: PendingReimbursementSummary[];
};

type IndexedItem = {
  reimbursement: PendingReimbursementSummary;
  bucket_key: string;
  normalized_name: string;
  display_alias: string;
};

type SimilarityCandidate = {
  target_key: string;
  reason: PersonGroupMatchReason;
};

export function normalizePersonName(input: string): string {
  const collapsed = input.trim().replace(/\s+/g, " ");
  const lower = collapsed.toLocaleLowerCase("pt-BR");
  const withoutAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const withoutPunctuation = withoutAccents.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return withoutPunctuation.replace(/\s+/g, " ").trim();
}

/**
 * Conservative multi-layer grouping:
 * 1) deterministic normalization + exact equality
 * 2) minor typo on a single token (unique + mutual candidate)
 * 3) single-token names only when they map to a unique full-name group
 * 4) high-similarity fallback (unique + mutual candidate)
 */
export function groupReimbursementsByPerson(
  reimbursements: PendingReimbursementSummary[],
): ReimbursementPersonGroup[] {
  if (reimbursements.length === 0) {
    return [];
  }

  const indexedItems: IndexedItem[] = [];
  const buckets = new Map<string, PersonBucket>();

  for (const reimbursement of reimbursements) {
    const displayAlias = cleanAliasForDisplay(reimbursement.person_id);
    const normalizedName = normalizePersonName(displayAlias);
    const bucketKey = normalizedName || UNKNOWN_BUCKET_KEY;

    indexedItems.push({
      reimbursement,
      bucket_key: bucketKey,
      normalized_name: normalizedName,
      display_alias: displayAlias,
    });

    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.items.push(reimbursement);
      continue;
    }

    buckets.set(bucketKey, {
      bucket_key: bucketKey,
      normalized_name: normalizedName,
      tokens: tokenize(normalizedName),
      items: [reimbursement],
    });
  }

  const parents = new Map<string, string>();
  const members = new Map<string, Set<string>>();
  const bucketMatchReasons = new Map<string, PersonGroupMatchReason>();

  for (const bucketKey of buckets.keys()) {
    parents.set(bucketKey, bucketKey);
    members.set(bucketKey, new Set([bucketKey]));
    bucketMatchReasons.set(bucketKey, "normalized_exact");
  }

  const findRoot = (bucketKey: string): string => {
    const parent = parents.get(bucketKey);
    if (!parent || parent === bucketKey) {
      return bucketKey;
    }

    const root = findRoot(parent);
    parents.set(bucketKey, root);
    return root;
  };

  const unionBuckets = (
    leftKey: string,
    rightKey: string,
    reason: PersonGroupMatchReason,
  ) => {
    const leftRoot = findRoot(leftKey);
    const rightRoot = findRoot(rightKey);

    if (leftRoot === rightRoot) {
      return;
    }

    const leftMembers = members.get(leftRoot);
    const rightMembers = members.get(rightRoot);
    if (!leftMembers || !rightMembers) {
      return;
    }

    const shouldKeepLeftRoot =
      leftMembers.size > rightMembers.size ||
      (leftMembers.size === rightMembers.size && leftRoot.localeCompare(rightRoot) <= 0);

    const winner = shouldKeepLeftRoot ? leftRoot : rightRoot;
    const absorbed = shouldKeepLeftRoot ? rightRoot : leftRoot;

    const winnerMembers = members.get(winner);
    const absorbedMembers = members.get(absorbed);
    if (!winnerMembers || !absorbedMembers) {
      return;
    }

    for (const member of absorbedMembers) {
      winnerMembers.add(member);
    }

    parents.set(absorbed, winner);
    members.delete(absorbed);

    const currentReason = bucketMatchReasons.get(absorbed);
    if (currentReason === "normalized_exact") {
      bucketMatchReasons.set(absorbed, reason);
    }
  };

  applyMutualUniqueMerges({
    buckets,
    members,
    findRoot,
    unionBuckets,
    detectCandidate: detectMinorTokenTypoCandidate,
  });

  applySingleTokenMerges({
    buckets,
    members,
    findRoot,
    unionBuckets,
  });

  applyMutualUniqueMerges({
    buckets,
    members,
    findRoot,
    unionBuckets,
    detectCandidate: detectHighSimilarityCandidate,
  });

  const groupedByRoot = new Map<string, IndexedItem[]>();
  for (const indexedItem of indexedItems) {
    const rootKey = findRoot(indexedItem.bucket_key);
    const rootItems = groupedByRoot.get(rootKey);
    if (rootItems) {
      rootItems.push(indexedItem);
      continue;
    }
    groupedByRoot.set(rootKey, [indexedItem]);
  }

  const groups: ReimbursementPersonGroup[] = [];

  for (const [rootKey, rootItems] of groupedByRoot.entries()) {
    const statusCounts: Record<PendingReimbursementSummary["status"], number> = {
      pending: 0,
      partial: 0,
      overdue: 0,
      received: 0,
      canceled: 0,
    };

    let outstandingTotal = 0;
    let latestOccurredAt = "";

    const aliasesByName = new Map<string, ReimbursementPersonAlias>();
    for (const indexedItem of rootItems) {
      const { reimbursement, display_alias: alias } = indexedItem;
      const bucketReason = bucketMatchReasons.get(indexedItem.bucket_key) ?? "unmatched";
      const existingAlias = aliasesByName.get(alias);

      if (existingAlias) {
        existingAlias.count += 1;
        if (reimbursement.occurred_at > existingAlias.latest_occurred_at) {
          existingAlias.latest_occurred_at = reimbursement.occurred_at;
        }
      } else {
        aliasesByName.set(alias, {
          alias,
          count: 1,
          latest_occurred_at: reimbursement.occurred_at,
          normalized_name: normalizePersonName(alias),
          match_reason: bucketReason,
        });
      }

      statusCounts[reimbursement.status] += 1;
      outstandingTotal += getOutstandingAmount(reimbursement);
      if (reimbursement.occurred_at > latestOccurredAt) {
        latestOccurredAt = reimbursement.occurred_at;
      }
    }

    const aliasDetails = Array.from(aliasesByName.values()).sort(compareAliasesForCanonicalChoice);
    const canonicalName = selectCanonicalAlias(rootKey, aliasDetails);
    const canonicalNormalizedName =
      rootKey === UNKNOWN_BUCKET_KEY ? "" : normalizePersonName(canonicalName);
    const groupedAliases = aliasDetails
      .filter((alias) => alias.alias !== canonicalName)
      .sort(compareAliasesForDisplay)
      .map((alias) => alias.alias);

    groups.push({
      group_id: `person:${encodeURIComponent(rootKey)}`,
      canonical_name: canonicalName,
      canonical_normalized_name: canonicalNormalizedName,
      aliases: groupedAliases,
      alias_details: aliasDetails,
      items: rootItems.map((indexedItem) => indexedItem.reimbursement),
      outstanding_total: outstandingTotal,
      item_count: rootItems.length,
      status_counts: statusCounts,
      latest_occurred_at: latestOccurredAt,
    });
  }

  return groups.sort((left, right) => {
    if (left.outstanding_total !== right.outstanding_total) {
      return right.outstanding_total - left.outstanding_total;
    }
    if (left.latest_occurred_at !== right.latest_occurred_at) {
      return right.latest_occurred_at.localeCompare(left.latest_occurred_at);
    }
    return left.canonical_name.localeCompare(right.canonical_name, "pt-BR");
  });
}

function cleanAliasForDisplay(input: string | null | undefined): string {
  const collapsed = String(input ?? "").trim().replace(/\s+/g, " ");
  return collapsed || UNKNOWN_PERSON_LABEL;
}

function tokenize(normalizedName: string): string[] {
  if (!normalizedName) {
    return [];
  }
  return normalizedName.split(" ").filter(Boolean);
}

function getOutstandingAmount(reimbursement: PendingReimbursementSummary): number {
  if (
    reimbursement.status === "pending" ||
    reimbursement.status === "partial" ||
    reimbursement.status === "overdue"
  ) {
    return Math.max(0, reimbursement.amount - (reimbursement.amount_received ?? 0));
  }
  return 0;
}

function compareAliasesForCanonicalChoice(
  left: ReimbursementPersonAlias,
  right: ReimbursementPersonAlias,
): number {
  const leftTokens = tokenize(left.normalized_name).length;
  const rightTokens = tokenize(right.normalized_name).length;

  if (leftTokens !== rightTokens) {
    return rightTokens - leftTokens;
  }
  if (left.normalized_name.length !== right.normalized_name.length) {
    return right.normalized_name.length - left.normalized_name.length;
  }
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  if (left.latest_occurred_at !== right.latest_occurred_at) {
    return right.latest_occurred_at.localeCompare(left.latest_occurred_at);
  }

  return left.alias.localeCompare(right.alias, "pt-BR");
}

function compareAliasesForDisplay(
  left: ReimbursementPersonAlias,
  right: ReimbursementPersonAlias,
): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  if (left.latest_occurred_at !== right.latest_occurred_at) {
    return right.latest_occurred_at.localeCompare(left.latest_occurred_at);
  }
  return left.alias.localeCompare(right.alias, "pt-BR");
}

function selectCanonicalAlias(
  rootKey: string,
  aliasDetails: ReimbursementPersonAlias[],
): string {
  if (rootKey === UNKNOWN_BUCKET_KEY || aliasDetails.length === 0) {
    return UNKNOWN_PERSON_LABEL;
  }
  return aliasDetails[0].alias;
}

function applyMutualUniqueMerges(params: {
  buckets: Map<string, PersonBucket>;
  members: Map<string, Set<string>>;
  findRoot: (bucketKey: string) => string;
  unionBuckets: (
    leftKey: string,
    rightKey: string,
    reason: PersonGroupMatchReason,
  ) => void;
  detectCandidate: (
    leftBucket: PersonBucket,
    rightBucket: PersonBucket,
  ) => SimilarityCandidate | null;
}) {
  const activeRoots = Array.from(params.members.keys());
  const candidateMap = new Map<string, SimilarityCandidate[]>();

  for (const leftRoot of activeRoots) {
    const leftBucket = params.buckets.get(leftRoot);
    if (!leftBucket) {
      continue;
    }
    const candidates: SimilarityCandidate[] = [];

    for (const rightRoot of activeRoots) {
      if (leftRoot === rightRoot) {
        continue;
      }

      const rightBucket = params.buckets.get(rightRoot);
      if (!rightBucket) {
        continue;
      }

      const candidate = params.detectCandidate(leftBucket, rightBucket);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    candidateMap.set(leftRoot, candidates);
  }

  for (const [leftRoot, candidates] of candidateMap.entries()) {
    if (candidates.length !== 1) {
      continue;
    }

    const [candidate] = candidates;
    const reverseCandidates = candidateMap.get(candidate.target_key) ?? [];
    const isMutualUnique =
      reverseCandidates.length === 1 && reverseCandidates[0].target_key === leftRoot;

    if (!isMutualUnique) {
      continue;
    }

    params.unionBuckets(leftRoot, candidate.target_key, candidate.reason);
  }
}

function applySingleTokenMerges(params: {
  buckets: Map<string, PersonBucket>;
  members: Map<string, Set<string>>;
  findRoot: (bucketKey: string) => string;
  unionBuckets: (
    leftKey: string,
    rightKey: string,
    reason: PersonGroupMatchReason,
  ) => void;
}) {
  const activeRoots = Array.from(params.members.keys());

  for (const sourceRoot of activeRoots) {
    const sourceToken = getClusterSingleToken(sourceRoot, params);
    if (!sourceToken || sourceToken.length < 3) {
      continue;
    }

    const candidates: string[] = [];
    for (const targetRoot of activeRoots) {
      if (sourceRoot === targetRoot) {
        continue;
      }

      if (clusterHasMultiTokenWithFirstToken(targetRoot, sourceToken, params)) {
        candidates.push(targetRoot);
      }
    }

    if (candidates.length === 1) {
      params.unionBuckets(sourceRoot, candidates[0], "single_token_unique_match");
    }
  }
}

function getClusterSingleToken(
  rootKey: string,
  params: {
    buckets: Map<string, PersonBucket>;
    members: Map<string, Set<string>>;
    findRoot: (bucketKey: string) => string;
  },
): string | null {
  const clusterMembers = params.members.get(rootKey);
  if (!clusterMembers) {
    return null;
  }

  let token: string | null = null;
  for (const member of clusterMembers) {
    const memberRoot = params.findRoot(member);
    if (memberRoot !== rootKey) {
      continue;
    }
    const bucket = params.buckets.get(member);
    if (!bucket || bucket.tokens.length !== 1) {
      return null;
    }
    if (!token) {
      token = bucket.tokens[0];
      continue;
    }
    if (token !== bucket.tokens[0]) {
      return null;
    }
  }

  return token;
}

function clusterHasMultiTokenWithFirstToken(
  rootKey: string,
  firstToken: string,
  params: {
    buckets: Map<string, PersonBucket>;
    members: Map<string, Set<string>>;
    findRoot: (bucketKey: string) => string;
  },
): boolean {
  const clusterMembers = params.members.get(rootKey);
  if (!clusterMembers) {
    return false;
  }

  for (const member of clusterMembers) {
    if (params.findRoot(member) !== rootKey) {
      continue;
    }
    const bucket = params.buckets.get(member);
    if (!bucket || bucket.tokens.length < 2) {
      continue;
    }
    if (bucket.tokens[0] === firstToken) {
      return true;
    }
  }

  return false;
}

function detectMinorTokenTypoCandidate(
  leftBucket: PersonBucket,
  rightBucket: PersonBucket,
): SimilarityCandidate | null {
  if (
    leftBucket.bucket_key === UNKNOWN_BUCKET_KEY ||
    rightBucket.bucket_key === UNKNOWN_BUCKET_KEY
  ) {
    return null;
  }
  if (leftBucket.tokens.length !== rightBucket.tokens.length || leftBucket.tokens.length < 2) {
    return null;
  }
  if (leftBucket.tokens[0] !== rightBucket.tokens[0]) {
    return null;
  }

  let mismatchCount = 0;
  for (let index = 0; index < leftBucket.tokens.length; index += 1) {
    const leftToken = leftBucket.tokens[index];
    const rightToken = rightBucket.tokens[index];
    if (leftToken === rightToken) {
      continue;
    }

    mismatchCount += 1;
    if (mismatchCount > 1) {
      return null;
    }

    if (leftToken.length < 5 || rightToken.length < 5) {
      return null;
    }

    if (levenshteinDistance(leftToken, rightToken) !== 1) {
      return null;
    }
  }

  if (mismatchCount !== 1) {
    return null;
  }

  return {
    target_key: rightBucket.bucket_key,
    reason: "minor_token_typo",
  };
}

function detectHighSimilarityCandidate(
  leftBucket: PersonBucket,
  rightBucket: PersonBucket,
): SimilarityCandidate | null {
  if (
    leftBucket.bucket_key === UNKNOWN_BUCKET_KEY ||
    rightBucket.bucket_key === UNKNOWN_BUCKET_KEY
  ) {
    return null;
  }
  if (leftBucket.tokens.length < 2 || rightBucket.tokens.length < 2) {
    return null;
  }
  if (leftBucket.tokens[0] !== rightBucket.tokens[0]) {
    return null;
  }

  const similarity = similarityScore(leftBucket.normalized_name, rightBucket.normalized_name);
  if (similarity < 0.97) {
    return null;
  }

  return {
    target_key: rightBucket.bucket_key,
    reason: "fuzzy_high_similarity",
  };
}

function similarityScore(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }
  const distance = levenshteinDistance(left, right);
  return (maxLength - distance) / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return right.length;
  }
  if (!right) {
    return left.length;
  }

  const distances: number[] = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previousDiagonal = distances[0];
    distances[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previousUp = distances[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      distances[rightIndex] = Math.min(
        distances[rightIndex] + 1,
        distances[rightIndex - 1] + 1,
        previousDiagonal + substitutionCost,
      );

      previousDiagonal = previousUp;
    }
  }

  return distances[right.length];
}
