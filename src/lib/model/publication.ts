/** Keep editor-selected flagship stores visible without altering feed status.
 * Individual offers still pass the market, expiry and source checks below. */
export function publicMerchantFilter(): Record<string, unknown> {
  return { relationship: "joined", $or: [{ status: /^active$/i }, { isFlagship: true }] };
}

/** Shared public offer gate. A joined merchant can supply missing offer geography,
 * but explicit offer restrictions and reviewed overrides always take precedence. */
export function publicOfferFilter(country?: string): Record<string, unknown> {
  return { $and: [
    { status: { $in: ["active", "expiring-soon", "expiringSoon"] }, isAutoWelcome: { $ne: true }, isBrandDeal: { $ne: true }, quarantined: { $ne: true }, aiStatus: { $ne: "REVIEW" }, title: { $type: "string", $regex: /\S/ }, trackingUrl: { $regex: /^https?:\/\//i } },
    { $expr: { $and: [
      { $or: [{ $eq: [{ $ifNull: ["$startDate", null] }, null] }, { $lte: [{ $convert: { input: "$startDate", to: "date", onError: new Date("9999-01-01"), onNull: null } }, "$$NOW"] }] },
      { $or: [{ $eq: [{ $ifNull: ["$endDate", null] }, null] }, { $gt: [{ $convert: { input: "$endDate", to: "date", onError: new Date("1970-01-01"), onNull: null } }, "$$NOW"] }] },
    ] } },
    ...(country ? [{ $expr: { $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$_publicRegionCodes", { $ifNull: ["$reviewedRegionCodes", { $ifNull: ["$regionCodes", []] }] }] }, [country.toUpperCase(), "WW", "GLOBAL", "INT", "00"]] } }, 0] } }] : []),
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
    { $match: publicOfferFilter() },
    ...publicOfferMerchantStages({}, country),
    { $set: { _publicMerchantName: merchantNameExpression("$advertiser.name") } },
    ...distinctOfferStages(true),
    { $group: { _id: { network: "$network", merchant: { $toString: "$advertiser.id" }, name: "$_publicMerchantName" }, n: { $sum: 1 } } },
  ];
}

/** Resolve ownership before geography, so a feed's empty country list does not
 * hide an offer from its own explicitly assigned merchant market. */
export function publicOfferMerchantStages(merchantFilter: Record<string, unknown> = {}, country?: string): Record<string, unknown>[] {
  return [
    { $set: { _publicMerchantIds: { $let: {
      vars: {
        text: { $toString: "$advertiser.id" },
        numeric: { $convert: { input: "$advertiser.id", to: "double", onError: null, onNull: null } },
      },
      in: ["$$text", { $cond: [
        { $and: [{ $ne: ["$$numeric", null] }, { $eq: [{ $toString: "$$numeric" }, "$$text"] }] },
        "$$numeric", "$$text",
      ] }],
    } } } },
    { $lookup: {
      from: "advertisers", localField: "_publicMerchantIds", foreignField: "id",
      let: { merchantNetwork: "$network", merchantName: merchantNameExpression("$advertiser.name") },
      pipeline: [
        { $match: { $and: [merchantFilter, publicMerchantFilter()] } },
        { $match: { $expr: { $and: [
          { $eq: ["$network", "$$merchantNetwork"] },
          { $eq: [merchantNameExpression("$name"), "$$merchantName"] },
        ] } } },
        { $project: { _id: 0, countryCode: 1, countryCodes: 1, region: 1 } },
        { $limit: 1 },
      ], as: "publicMerchant",
    } },
    { $match: { "publicMerchant.0": { $exists: true } } },
    { $set: { _publicRegionCodes: { $ifNull: ["$reviewedRegionCodes", { $cond: [
      { $gt: [{ $size: { $ifNull: ["$regionCodes", []] } }, 0] }, "$regionCodes",
      { $let: {
        vars: { merchant: { $arrayElemAt: ["$publicMerchant", 0] } },
        in: { $setDifference: [{ $map: {
          input: { $concatArrays: [
            { $ifNull: ["$$merchant.countryCodes", []] },
            [{ $ifNull: ["$$merchant.countryCode", ""] }, { $ifNull: ["$$merchant.region", ""] }],
          ] },
          as: "code",
          in: { $let: {
            vars: { match: { $regexFind: { input: { $toUpper: { $trim: { input: { $ifNull: ["$$code", ""] } } } }, regex: /(?:^|[-_])([A-Z]{2})$/ } } },
            in: { $ifNull: [{ $arrayElemAt: ["$$match.captures", 0] }, ""] },
          } },
        } }, ["", "WW"]] },
      } },
    ] }] } } },
    { $match: publicOfferFilter(country) },
    // Expose the resolved markets to alerts and other consumers without writing
    // inherited geography back over the original feed record.
    { $set: { regionCodes: "$_publicRegionCodes" } },
    { $unset: ["publicMerchant", "_publicMerchantIds", "_publicRegionCodes"] },
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
