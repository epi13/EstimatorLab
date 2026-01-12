export function costItems(items, db, logistics, freightRules) {
  // base cost
  const matBase = items.reduce((s, it) => s + (it.base ?? 0), 0);

  // shipping by freight class (per-item), then global multiplier
  const shipByClass = (it) => {
    const cls = it.freight_class || "bulk";
    const pct = freightRules.by_class_pct[cls] ?? 0.18;
    return (it.base ?? 0) * pct;
  };

  const shipRaw = items.reduce((s, it) => s + shipByClass(it), 0);
  const ship = shipRaw * (logistics.shipMult ?? 1.0);

  const handling = matBase * (logistics.handlingPct ?? 0);

  const matDelivered = matBase + ship + handling;

  return { matBase, ship, handling, matDelivered };
}
