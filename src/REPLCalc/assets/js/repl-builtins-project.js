export function attachProjectBuiltins(baseFns, {
  defFn,
  defFnCtx,
  isQty,
  makeQty,
  add,
  isObjToken,
  parseObjectLiteral,
  buildAssy,
  fieldInfo,
}){
  function isProject(value){
    return value && typeof value === "object" && value.__project;
  }

  function ensureTask(p, id){
    const key = typeof id === "string" ? id.trim() : String(id);
    if (!key) throw new Error("task id cannot be empty");
    if (!p.tasks[key]){
      p.tasks[key] = { id: key, props: Object.create(null) };
    }
    return key;
  }

  function toTimeScalar(t, label){
    if (isQty(t)){
      if (t.kind !== "time") throw new Error(`${label} expects time quantity`);
      return t.value;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error(`${label} expects numeric time`);
    return n;
  }

  baseFns.project = defFn("project", 1, {
    args: [{ label: "name", kinds: ["string", "scalar", "null"] }],
    returns: { kinds: ["project"] },
  }, (name) => {
    const n = typeof name === "string" ? name.trim() : String(name || "project");
    return { __project: true, name: n || "project", tasks: Object.create(null), deps: [] };
  });

  baseFns.ptask = defFnCtx("ptask", 3, {
    args: [
      { label: "project", kinds: ["project"] },
      { label: "id", kinds: ["string", "scalar"] },
      { label: "props", kinds: ["any"] },
    ],
    returns: { kinds: ["project"] },
  }, (ctx, p, id, propsRaw) => {
    if (!isProject(p)) throw new Error("ptask expects a project");
    const key = ensureTask(p, id);

    const props = Object.create(null);
    if (propsRaw){
      const entries = (() => {
        if (isObjToken(propsRaw)) return parseObjectLiteral(propsRaw.raw);
        if (typeof propsRaw === "string" && propsRaw.trim().startsWith("{")) return parseObjectLiteral(propsRaw);
        return null;
      })();
      if (entries){
        for (const entry of entries){
          props[entry.key] = ctx.evalString(entry.expr, props);
        }
      }
    }

    const prev = p.tasks[key]?.props || Object.create(null);
    p.tasks[key] = { id: key, props: Object.assign(prev, props) };
    return p;
  });

  baseFns.pdep = defFn("pdep", 3, {
    args: [
      { label: "project", kinds: ["project"] },
      { label: "from", kinds: ["string", "scalar"] },
      { label: "to", kinds: ["string", "scalar"] },
    ],
    returns: { kinds: ["project"] },
  }, (p, from, to) => {
    if (!isProject(p)) throw new Error("pdep expects a project");
    const a = ensureTask(p, from);
    const b = ensureTask(p, to);
    p.deps.push({ from: a, to: b });
    return p;
  });

  baseFns.pschedule = defFn("pschedule", 1, {
    args: [{ label: "project", kinds: ["project"] }],
    returns: { kinds: ["assy"] },
  }, (p) => {
    if (!isProject(p)) throw new Error("pschedule expects a project");

    const ids = Object.keys(p.tasks);
    const indeg = Object.create(null);
    const out = Object.create(null);
    for (const id of ids){
      indeg[id] = 0;
      out[id] = [];
    }

    for (const e of p.deps){
      const from = ensureTask(p, e.from);
      const to = ensureTask(p, e.to);
      out[from].push(to);
      indeg[to] += 1;
    }

    const q = [];
    for (const [id, d] of Object.entries(indeg)){
      if (d === 0) q.push(id);
    }

    const order = [];
    while (q.length){
      const id = q.shift();
      order.push(id);
      for (const nxt of out[id] || []){
        indeg[nxt] -= 1;
        if (indeg[nxt] === 0) q.push(nxt);
      }
    }

    if (order.length !== ids.length){
      const stuck = ids.filter((id) => indeg[id] > 0);
      throw new Error(`project has a cycle involving: ${stuck.join(", ")}`);
    }

    const start = Object.create(null);
    const end = Object.create(null);
    for (const id of order){
      start[id] = 0;
      end[id] = 0;
    }

    const durOf = (id) => {
      const d = p.tasks[id]?.props?.dur;
      if (d === undefined) return 0;
      return toTimeScalar(d, "task dur");
    };

    for (const id of order){
      const dur = durOf(id);
      end[id] = start[id] + dur;
      for (const nxt of out[id] || []){
        start[nxt] = Math.max(start[nxt], end[id]);
      }
    }

    let makespan = 0;
    for (const id of ids){
      makespan = Math.max(makespan, end[id] || 0);
      p.tasks[id].start = makeQty(start[id] || 0, "time");
      p.tasks[id].end = makeQty(end[id] || 0, "time");
    }

    return buildAssy("pschedule", {
      total_time: fieldInfo(makeQty(makespan, "time")),
      n: fieldInfo(ids.length),
    });
  });

  baseFns.pcost = defFn("pcost", 1, {
    args: [{ label: "project", kinds: ["project"] }],
    returns: { kinds: ["any"] },
  }, (p) => {
    if (!isProject(p)) throw new Error("pcost expects a project");
    let acc = null;
    for (const t of Object.values(p.tasks)){
      const c = t?.props?.cost;
      if (c === undefined || c === null) continue;
      acc = acc === null ? c : add(acc, c);
    }
    return acc === null ? 0 : acc;
  });
}
