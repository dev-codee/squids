/** Keep editor-selected flagship stores visible without altering feed status.
 * Individual offers still pass the market, expiry and source checks below. */
export function publicMerchantFilter(): Record<string, unknown> {
  return { relationship: "joined", $or: [{ status: /^active$/i }, { isFlagship: true }] };
}

/** Shared public offer gate. Missing market data is withheld pending review. */
export function publicOfferFilter(country?: string): Record<string, unknown> {
  return { $and: [
    { status: { $in: ["active", "expiring-soon", "expiringSoon"] }, isAutoWelcome: { $ne: true }, isBrandDeal: { $ne: true }, quarantined: { $ne: true }, aiStatus: { $ne: "REVIEW" }, title: { $type: "string", $regex: /\S/ }, trackingUrl: { $regex: /^https?:\/\//i } },
    { $expr: { $and: [
      { $or: [{ $eq: [{ $ifNull: ["$startDate", null] }, null] }, { $lte: [{ $convert: { input: "$startDate", to: "date", onError: new Date("9999-01-01"), onNull: null } }, "$$NOW"] }] },
      { $or: [{ $eq: [{ $ifNull: ["$endDate", null] }, null] }, { $gt: [{ $convert: { input: "$endDate", to: "date", onError: new Date("1970-01-01"), onNull: null } }, "$$NOW"] }] },
    ] } },
    ...(country ? [{ $expr: { $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$reviewedRegionCodes", { $ifNull: ["$regionCodes", []] }] }, [country.toUpperCase(), "WW", "GLOBAL", "INT", "00"]] } }, 0] } }] : []),
  ] };
}

/** The same distinct offer key is used for cards and totals, before pagination. */
export function distinctOfferStages(byMerchantName = false): Record<string, unknown>[] {
  const norm = (field: string) => ({ $toLower: { $trim: { input: { $ifNull: [field, ""] } } } });
  return [
    { $sort: { isExclusive: -1, sourceUpdatedAt: -1, id: 1 } },
    { $group: { _id: { network: "$network", merchant: { $toString: "$advertiser.id" }, ...(byMerchantName ? { merchantName: "$_publicMerchantName" } : {}), type: "$type", title: norm("$title"), code: norm("$code"), discount: norm("$discountText") }, doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
  ];
}

/** Count offers once per market rather than scanning them for every merchant.
 * Name remains part of identity so a mismatched feed name cannot publish offers. */
export function publicOfferCountStages(country?: string): Record<string, unknown>[] {
  return [
    { $match: publicOfferFilter(country) },
    { $set: { _publicMerchantName: merchantNameExpression("$advertiser.name") } },
    ...distinctOfferStages(true),
    { $group: { _id: { network: "$network", merchant: { $toString: "$advertiser.id" }, name: "$_publicMerchantName" }, n: { $sum: 1 } } },
  ];
}

export function publicMerchantCountKey(network: unknown, id: unknown, name: string): string {
  return JSON.stringify([network ?? null, String(id ?? ""), name]);
}

/** Legacy feed names may include a market suffix that the merchant record strips. */
export function merchantNameExpression(field: string): Record<string, unknown> {
  return { $toLower: { $trim: { input: { $let: {
    vars: { match: { $regexFind: { input: { $ifNull: [field, ""] }, regex: /^(.*?)(?:[\s\-[(]+(?:WW|GLOBAL|INT|WORLDWIDE|MANY GEOS?|DE|FR|UK|GB|US|ES|IT|CA|AU)[\])]?)*$/i } } },
    in: { $ifNull: [{ $arrayElemAt: ["$$match.captures", 0] }, { $ifNull: [field, ""] }] },
  } } } } };
}
