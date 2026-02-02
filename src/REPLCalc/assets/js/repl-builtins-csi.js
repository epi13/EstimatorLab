export function attachCsiBuiltins(baseFns, {
  defFn,
  add,
}){
  function requireAssy(value, label){
    if (!value || typeof value !== "object" || !value.__assy) throw new Error(`${label} expects an assembly`);
    return value;
  }

  function requireLine(value, label){
    const a = requireAssy(value, label);
    if (!a.__line) throw new Error(`${label} expects a line assembly`);
    return a;
  }

  function asString(value){
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function digitsOnly(value){
    return asString(value).replace(/[^0-9]/g, "");
  }

  function csiNorm(code){
    const d = digitsOnly(code);
    if (d.length >= 6){
      const a = d.slice(0, 2);
      const b = d.slice(2, 4);
      const c = d.slice(4, 6);
      return `${a} ${b} ${c}`;
    }
    if (d.length >= 4){
      const a = d.slice(0, 2);
      const b = d.slice(2, 4);
      return `${a} ${b}`;
    }
    if (d.length >= 2){
      return d.slice(0, 2);
    }
    return asString(code).trim();
  }

  function csiDiv(code){
    const d = digitsOnly(code);
    if (d.length >= 2) return d.slice(0, 2);
    return "";
  }

  function csiSection(code){
    const d = digitsOnly(code);
    if (d.length >= 4) return `${d.slice(0, 2)} ${d.slice(2, 4)}`;
    if (d.length >= 2) return d.slice(0, 2);
    return "";
  }

  function csiItem(code){
    const d = digitsOnly(code);
    if (d.length >= 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}`;
    return csiNorm(code);
  }

  function keyForCsi(code){
    const normalized = csiNorm(code);
    const safe = normalized.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "");
    return safe ? `csi_${safe}` : "csi_unassigned";
  }

  baseFns.csi_norm = defFn("csi_norm", 1, (code) => csiNorm(code));
  baseFns.csi_div = defFn("csi_div", 1, (code) => csiDiv(code));
  baseFns.csi_section = defFn("csi_section", 1, (code) => csiSection(code));
  baseFns.csi_item = defFn("csi_item", 1, (code) => csiItem(code));

  baseFns.csi_rollup = defFn("csi_rollup", -1, (...lines) => {
    if (!lines.length) throw new Error("csi_rollup expects at least one line");
    let grand = null;
    let n = 0;
    const byCsi = Object.create(null);

    for (const item of lines){
      const line = requireLine(item, "csi_rollup");
      const total = line.fields?.total?.value;
      const csi = line.fields?.csi?.value || "";
      if (total === undefined) continue;
      grand = grand === null ? total : add(grand, total);
      const key = keyForCsi(csi);
      byCsi[key] = byCsi[key] === undefined ? total : add(byCsi[key], total);
      n += 1;
    }

    const fields = Object.create(null);
    fields.total = { value: grand === null ? 0 : grand, note: "", raw: "" };
    fields.n = { value: n, note: "", raw: "" };
    for (const [k, v] of Object.entries(byCsi)){
      fields[k] = { value: v, note: "", raw: "" };
    }

    return { __assy: true, name: "csi_rollup", fields, __rollup: true, __csi: true };
  });
}
