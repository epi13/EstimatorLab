export function attachGraphBuiltins(baseFns, {
  defFn,
  add,
}){
  function requireGraph(value, label){
    if (!value || typeof value !== "object" || !value.__graph) throw new Error(`${label} expects a graph`);
    return value;
  }

  function ensureNode(g, id){
    const key = typeof id === "string" ? id.trim() : String(id);
    if (!key) throw new Error("graph node id cannot be empty");
    if (!g.nodes[key]) g.nodes[key] = { id: key, cost: 0 };
    return key;
  }

  baseFns.graph = defFn("graph", 1, (name) => {
    const gname = typeof name === "string" ? name.trim() : "graph";
    return { __graph: true, name: gname || "graph", nodes: Object.create(null), edges: [] };
  });

  baseFns.gnode = defFn("gnode", 3, (g, id, cost) => {
    const graph = requireGraph(g, "gnode");
    const key = typeof id === "string" ? id.trim() : String(id);
    if (!key) throw new Error("gnode expects a node id");
    graph.nodes[key] = { id: key, cost };
    return graph;
  });

  baseFns.gedge = defFn("gedge", 3, (g, from, to) => {
    const graph = requireGraph(g, "gedge");
    const a = typeof from === "string" ? from.trim() : String(from);
    const b = typeof to === "string" ? to.trim() : String(to);
    if (!a || !b) throw new Error("gedge expects from/to ids");
    graph.edges.push({ from: a, to: b });
    return graph;
  });

  baseFns.gsum = defFn("gsum", 1, (g) => {
    const graph = requireGraph(g, "gsum");
    let acc = null;
    for (const node of Object.values(graph.nodes || {})){
      const cost = node?.cost;
      if (cost === undefined || cost === null) continue;
      acc = acc === null ? cost : add(acc, cost);
    }
    return acc === null ? 0 : acc;
  });

  baseFns.gcalc = defFn("gcalc", 1, (g) => {
    const graph = requireGraph(g, "gcalc");
    graph.nodes = graph.nodes || Object.create(null);
    graph.edges = Array.isArray(graph.edges) ? graph.edges : [];

    const indeg = Object.create(null);
    const out = Object.create(null);
    for (const id of Object.keys(graph.nodes)){
      indeg[id] = 0;
      out[id] = [];
    }

    for (const e of graph.edges){
      const from = ensureNode(graph, e?.from);
      const to = ensureNode(graph, e?.to);
      if (!out[from]) out[from] = [];
      out[from].push(to);
      indeg[to] = (indeg[to] || 0) + 1;
      if (indeg[from] === undefined) indeg[from] = 0;
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

    const nodeIds = Object.keys(indeg);
    if (order.length !== nodeIds.length){
      const stuck = nodeIds.filter((id) => indeg[id] > 0);
      throw new Error(`Graph has a cycle involving: ${stuck.join(", ")}`);
    }

    const totals = Object.create(null);
    for (const id of order){
      const base = graph.nodes[id]?.cost;
      totals[id] = base === undefined || base === null ? 0 : base;
    }

    for (const from of order){
      const fromTotal = totals[from];
      for (const to of out[from] || []){
        totals[to] = totals[to] === undefined ? fromTotal : add(totals[to], fromTotal);
      }
    }

    for (const id of Object.keys(totals)){
      graph.nodes[id].total = totals[id];
    }
    graph.__calced = true;
    return graph;
  });

  baseFns.gtotal = defFn("gtotal", 1, (g) => {
    const graph = requireGraph(g, "gtotal");
    if (!graph.__calced) baseFns.gcalc.impl(graph);
    const outdeg = Object.create(null);
    for (const id of Object.keys(graph.nodes || {})) outdeg[id] = 0;
    for (const e of graph.edges || []){
      const from = typeof e?.from === "string" ? e.from.trim() : String(e?.from);
      const to = typeof e?.to === "string" ? e.to.trim() : String(e?.to);
      if (!from || !to) continue;
      if (outdeg[from] === undefined) outdeg[from] = 0;
      outdeg[from] += 1;
      if (outdeg[to] === undefined) outdeg[to] = 0;
    }
    const sinks = Object.keys(outdeg).filter((id) => outdeg[id] === 0);
    let acc = null;
    for (const id of sinks){
      const v = graph.nodes[id]?.total;
      if (v === undefined || v === null) continue;
      acc = acc === null ? v : add(acc, v);
    }
    return acc === null ? 0 : acc;
  });
}
