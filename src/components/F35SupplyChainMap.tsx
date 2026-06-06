"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

// ─────────────────────────────────────────────────────────────────────────────
// F-35 LIGHTNING II — SUPPLY CHAIN INTELLIGENCE
// Data compiled from public sources: Lockheed Martin / f35.com, CRS reports,
// supplier disclosures (Northrop, BAE, RTX/Pratt & Whitney, Rolls-Royce, GKN,
// Kongsberg, Terma, Martin-Baker, Honeywell), and trade press. Workshare and
// scale figures are public where cited; treat as indicative, not audited.
// The program has ~1,900 direct suppliers / 13,000+ companies total; this maps
// the named, structure-defining firms.
// ─────────────────────────────────────────────────────────────────────────────

interface Node {
  id: string;
  name: string;
  ticker?: string;
  cat: string;
  tier: keyof typeof TIERS;
  country: string;
  loc?: string;
  role: string;
  scale?: string;
  soleSource?: boolean;
}

interface Link {
  source: string;
  target: string;
}

const TIERS = {
  customer: { label: "End customer", rank: 0 },
  faco: { label: "Final assembly (intl)", rank: 1 },
  prime: { label: "Prime integrator", rank: 1 },
  partner: { label: "Principal partner", rank: 2 },
  subsystem: { label: "Major subsystem", rank: 3 },
  component: { label: "Component / sub-tier", rank: 4 },
  material: { label: "Raw material", rank: 5 },
};

const CATEGORIES: Record<string, string> = {
  Integration: "#5eead4",
  Airframe: "#7aa2d4",
  Propulsion: "#f59e0b",
  Avionics: "#38bdf8",
  "Electronic warfare": "#e879b9",
  "Cockpit & escape": "#2dd4bf",
  "Power & thermal": "#fb7185",
  "Actuation & fuel": "#a3e635",
  "Mission systems": "#c084fc",
  Materials: "#94a3b8",
  Customer: "#e2e8f0",
};

const NODES: Node[] = [
  // Customers
  { id: "usaf", name: "U.S. Air Force", cat: "Customer", tier: "customer", country: "USA", role: "F-35A operator", scale: "~1,763 planned" },
  { id: "usn", name: "U.S. Navy", cat: "Customer", tier: "customer", country: "USA", role: "F-35C carrier operator", scale: "~273 planned" },
  { id: "usmc", name: "U.S. Marine Corps", cat: "Customer", tier: "customer", country: "USA", role: "F-35B / F-35C operator", scale: "~420 planned" },
  { id: "partners", name: "Partner nations", cat: "Customer", tier: "customer", country: "Multi", role: "Co-development buyers", scale: "UK, Italy, NL, AUS, CAN, DEN, NOR" },
  { id: "fms", name: "FMS buyers", cat: "Customer", tier: "customer", country: "Multi", role: "Foreign Military Sales", scale: "Japan, Israel, S.Korea, Belgium, Poland, Germany, Finland, Switzerland" },

  // Prime + FACO
  { id: "lmt", name: "Lockheed Martin", ticker: "LMT", cat: "Integration", tier: "prime", country: "USA", loc: "Fort Worth, TX", role: "Prime contractor — final assembly, forward fuselage, wings, mission systems integration, low-observable / stealth", scale: "~13 jets/mo", soleSource: true },
  { id: "leonardo-faco", name: "Leonardo (Cameri FACO)", ticker: "LDO.MI", cat: "Integration", tier: "faco", country: "Italy", loc: "Cameri", role: "Only European final-assembly & checkout line; wing production", scale: "F-35A/B for Italy, NL" },
  { id: "mhi-faco", name: "Mitsubishi Heavy Ind. (FACO)", ticker: "7011.T", cat: "Integration", tier: "faco", country: "Japan", loc: "Nagoya", role: "Japanese final-assembly & checkout line", scale: "F-35A for JASDF" },

  // Principal partners
  { id: "noc", name: "Northrop Grumman", ticker: "NOC", cat: "Airframe", tier: "partner", country: "USA", loc: "Palmdale, CA", role: "Center fuselage; AN/APG-81 AESA radar; AN/AAQ-37 DAS; comms/nav avionics; mission-systems software; low-observable mgmt", scale: "~25%+ of aircraft", soleSource: true },
  { id: "bae", name: "BAE Systems", ticker: "BA.L", cat: "Airframe", tier: "partner", country: "UK", loc: "Samlesbury", role: "Aft fuselage & empennage (tails); AN/ASQ-239 Barracuda EW suite; fuel system; crew-escape & life-support integration; vehicle-management computer", scale: "13–15% workshare", soleSource: true },
  { id: "pw", name: "Pratt & Whitney (RTX)", ticker: "RTX", cat: "Propulsion", tier: "partner", country: "USA", loc: "East Hartford / Middletown, CT", role: "F135 engine — sole propulsion source & systems integrator", scale: "Sole engine", soleSource: true },
  { id: "rr", name: "Rolls-Royce", ticker: "RR.L", cat: "Propulsion", tier: "partner", country: "UK/USA", loc: "Bristol / Indianapolis, IN", role: "LiftSystem for F-35B (LiftFan, 3-bearing swivel module, roll posts)", scale: "Sole source — B variant", soleSource: true },

  // Major subsystems
  { id: "collins", name: "Collins Aerospace (RTX)", ticker: "RTX", cat: "Power & thermal", tier: "subsystem", country: "USA", role: "Electric power system, landing system, GPS, air-data sensing", scale: "" },
  { id: "cevs", name: "Collins Elbit Vision Systems", cat: "Cockpit & escape", tier: "subsystem", country: "USA/Israel", role: "Gen III Helmet-Mounted Display System (HMDS) — JV of Collins & Elbit", scale: "Sole HMDS source", soleSource: true },
  { id: "elbit", name: "Elbit Systems of America", ticker: "ESLT", cat: "Cockpit & escape", tier: "component", country: "Israel", role: "HMDS partner (display, tracking)", scale: "" },
  { id: "hon", name: "Honeywell", ticker: "HON", cat: "Power & thermal", tier: "subsystem", country: "USA", role: "Power & Thermal Management System (PTMS); wheels & brakes; on-board oxygen (OBOGS)", scale: "Sole PTMS source", soleSource: true },
  { id: "mb", name: "Martin-Baker", cat: "Cockpit & escape", tier: "subsystem", country: "UK", role: "US16E ejection seat — common across all three variants", scale: "Sole source, all variants; ~700 UK jobs", soleSource: true },
  { id: "lmmfc", name: "LM Missiles & Fire Control", ticker: "LMT", cat: "Avionics", tier: "subsystem", country: "USA", loc: "Orlando, FL", role: "AN/AAQ-40 Electro-Optical Targeting System (EOTS)", scale: "" },
  { id: "lhx", name: "L3Harris", ticker: "LHX", cat: "Avionics", tier: "subsystem", country: "USA", role: "Comms/nav/ID (CNI) components", scale: "" },
  { id: "hs", name: "Hamilton Sundstrand (RTX)", ticker: "RTX", cat: "Propulsion", tier: "subsystem", country: "USA", role: "F135 electronic engine control, actuation, gearbox, health monitoring", scale: "" },
  { id: "wwd", name: "Woodward", ticker: "WWD", cat: "Propulsion", tier: "subsystem", country: "USA", role: "F135 fuel system", scale: "" },
  { id: "gkn", name: "GKN Aerospace / Fokker", ticker: "MRO.L", cat: "Airframe", tier: "subsystem", country: "UK/NL", role: "Fuselage structures, canopy/transparencies, flaperons, in-flight opening doors, EWIS wiring harnesses (all aircraft), arresting gear", scale: "EWIS on every F-35", soleSource: true },
  { id: "moog", name: "Moog", ticker: "MOG.A", cat: "Actuation & fuel", tier: "subsystem", country: "USA", role: "Flight-control actuation", scale: "" },
  { id: "parker", name: "Parker Aerospace", ticker: "PH", cat: "Actuation & fuel", tier: "subsystem", country: "USA", role: "Fuel & hydraulic systems", scale: "" },
  { id: "eaton", name: "Eaton", ticker: "ETN", cat: "Actuation & fuel", tier: "subsystem", country: "USA/IRL", role: "Fuel/hydraulic & electrical conveyance", scale: "" },
  { id: "cobham", name: "Cobham", cat: "Actuation & fuel", tier: "subsystem", country: "UK", role: "Air-to-air refueling & fuel systems", scale: "" },

  // Component / sub-tier
  { id: "terma", name: "Terma", cat: "Airframe", tier: "component", country: "Denmark", role: "Composite tail leading edges, stabilizer skins, center-fuselage composites; missionized gun pod (B/C); APG-81 radar modules; DART pods", scale: "Top-tier NOC supplier" },
  { id: "kongsberg", name: "Kongsberg", ticker: "KOG.OL", cat: "Airframe", tier: "component", country: "Norway", role: "Composite fuselage panels & hatches, titanium parts, rudder; Joint Strike Missile (JSM)", scale: "Parts for ~100–150 ac/yr" },
  { id: "rheinmetall", name: "Rheinmetall", ticker: "RHM.DE", cat: "Airframe", tier: "component", country: "Germany", role: "Center-fuselage sections (for export aircraft)", scale: "New entrant" },
  { id: "asdam", name: "ASDAM (ex-RUAG Australia)", cat: "Airframe", tier: "component", country: "Australia", role: "Vertical tails, machined components — largest AUS supplier", scale: "70+ AUS firms; 700+ parts from Victoria" },
  { id: "marand", name: "Marand", cat: "Airframe", tier: "component", country: "Australia", role: "Vertical tails; engine removal/install trailers", scale: "" },
  { id: "selex", name: "Leonardo (avionics)", ticker: "LDO.MI", cat: "Avionics", tier: "component", country: "Italy", role: "EOTS components, radios, engine components", scale: "~4.1% workshare" },
  { id: "ultra", name: "Ultra", cat: "Avionics", tier: "component", country: "UK", role: "Electronic subsystems", scale: "" },

  // Materials
  { id: "titanium", name: "Titanium & specialty alloys", cat: "Materials", tier: "material", country: "Multi", role: "Airframe structural metal — sourcing tightly controlled", scale: "Sourcing-sensitive" },
  { id: "composites", name: "Carbon fiber / composites", cat: "Materials", tier: "material", country: "Multi", role: "Toray, Hexcel, Solvay — airframe skins & structures", scale: "" },
  { id: "stealth", name: "RAM / stealth coatings", cat: "Materials", tier: "material", country: "USA", role: "Radar-absorbent materials — proprietary, LO-team managed", scale: "Classified composition" },
];

const LINKS: Link[] = [
  // materials → structures
  ["titanium", "noc"], ["titanium", "bae"], ["titanium", "kongsberg"], ["titanium", "lmt"],
  ["composites", "noc"], ["composites", "bae"], ["composites", "terma"], ["composites", "kongsberg"], ["composites", "gkn"],
  ["stealth", "lmt"], ["stealth", "noc"],
  // components → partners/subsystems
  ["terma", "noc"], ["terma", "bae"], ["terma", "lmt"],
  ["kongsberg", "noc"], ["kongsberg", "lmt"],
  ["rheinmetall", "noc"],
  ["asdam", "lmt"], ["marand", "lmt"],
  ["selex", "leonardo-faco"], ["selex", "lmmfc"],
  ["ultra", "bae"],
  ["elbit", "cevs"],
  ["hs", "pw"], ["wwd", "pw"],
  ["cobham", "bae"],
  // subsystems → prime
  ["collins", "lmt"], ["cevs", "lmt"], ["hon", "lmt"], ["mb", "bae"],
  ["lmmfc", "lmt"], ["lhx", "noc"], ["moog", "lmt"], ["parker", "lmt"],
  ["parker", "pw"], ["eaton", "lmt"], ["eaton", "pw"], ["gkn", "noc"], ["gkn", "lmt"],
  // partners → prime / propulsion package
  ["noc", "lmt"], ["bae", "lmt"], ["pw", "lmt"], ["rr", "pw"],
  // prime → faco / customers
  ["lmt", "usaf"], ["lmt", "usn"], ["lmt", "usmc"],
  ["lmt", "leonardo-faco"], ["lmt", "mhi-faco"],
  ["lmt", "partners"], ["lmt", "fms"],
  ["leonardo-faco", "partners"], ["mhi-faco", "fms"],
];

const COUNTRIES = [...new Set(NODES.map((n) => n.country))].sort();

export default function F35SupplyChainMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [soleOnly, setSoleOnly] = useState(false);
  const [cascadeFrom, setCascadeFrom] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 560 });

  const cascadeSet = useMemo(() => {
    if (!cascadeFrom) return null;
    const adj: Record<string, string[]> = {};
    LINKS.forEach(([s, t]) => { (adj[s] = adj[s] || []).push(t); });
    const seen = new Set([cascadeFrom]);
    const stack = [cascadeFrom];
    while (stack.length) {
      const cur = stack.pop()!;
      (adj[cur] || []).forEach((nx) => { if (!seen.has(nx)) { seen.add(nx); stack.push(nx); } });
    }
    return seen;
  }, [cascadeFrom]);

  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return new Set(
      NODES.filter((n) => {
        if (tierFilter !== "all" && n.tier !== tierFilter) return false;
        if (catFilter !== "all" && n.cat !== catFilter) return false;
        if (countryFilter !== "all" && n.country !== countryFilter) return false;
        if (soleOnly && !n.soleSource) return false;
        if (q && !(`${n.name} ${n.role || ""} ${n.ticker || ""}`.toLowerCase().includes(q))) return false;
        return true;
      }).map((n) => n.id)
    );
  }, [tierFilter, catFilter, countryFilter, query, soleOnly]);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setDims({ w: Math.max(360, cr.width), h: Math.max(420, cr.height) });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const { w, h } = dims;
    const nodes = NODES.map((n) => ({ ...n }));
    const links = LINKS.map(([source, target]) => ({ source, target }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const radius = (n: Node) => {
      const base: Record<string, number> = { prime: 22, partner: 16, faco: 14, subsystem: 11, component: 9, material: 9, customer: 13 };
      return base[n.tier] || 9;
    };

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((l: any) => {
        const r = (TIERS[byId[l.source.id || l.source].tier].rank + TIERS[byId[l.target.id || l.target].tier].rank);
        return 60 + r * 6;
      }).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("x", d3.forceX((d: any) => {
        const rank = TIERS[d.tier].rank;
        return (w * (5 - rank)) / 5 * 0.86 + w * 0.07;
      }).strength(0.28))
      .force("y", d3.forceY(h / 2).strength(0.05))
      .force("collide", d3.forceCollide((d: any) => radius(d) + 6));

    simRef.current = sim;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    const grid = svg.append("g").attr("opacity", 0.5);
    for (let gx = 0; gx < w; gx += 40) grid.append("line").attr("x1", gx).attr("y1", 0).attr("x2", gx).attr("y2", h).attr("stroke", "#16304a").attr("stroke-width", 0.5);
    for (let gy = 0; gy < h; gy += 40) grid.append("line").attr("x1", 0).attr("y1", gy).attr("x2", w).attr("y2", gy).attr("stroke", "#16304a").attr("stroke-width", 0.5);

    const link = svg.append("g").attr("stroke", "#2a4865").attr("stroke-width", 1).selectAll("line").data(links).join("line").attr("class", "f35-link");

    const node = svg.append("g").selectAll("g").data(nodes).join("g").attr("class", "f35-node").style("cursor", "pointer");

    node.append("circle")
      .attr("r", radius)
      .attr("fill", (d: Node) => CATEGORIES[d.cat] || "#94a3b8")
      .attr("fill-opacity", 0.9)
      .attr("stroke", (d: Node) => (d.soleSource ? "#fbbf24" : "#0a0e14"))
      .attr("stroke-width", (d: Node) => (d.soleSource ? 2 : 1.5));

    node.append("text")
      .text((d: Node) => d.name)
      .attr("x", (d: Node) => radius(d) + 5)
      .attr("y", 4)
      .attr("font-size", (d: Node) => (d.tier === "prime" ? 13 : d.tier === "partner" || d.tier === "customer" ? 11 : 9.5))
      .attr("fill", "#cbd5e1")
      .attr("font-family", "'IBM Plex Mono', monospace")
      .style("pointer-events", "none");

    node.on("click", (e: any, d: Node) => { setSelected(d); })
      .on("mouseenter", (e: any, d: Node) => setHovered(d.id))
      .on("mouseleave", () => setHovered(null));

    node.call(d3.drag<any, Node>()
      .on("start", (e: any, d: any) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e: any, d: any) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e: any, d: any) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [dims]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.empty()) return;
    const adjHi = new Set<string>();
    if (hovered) {
      adjHi.add(hovered);
      LINKS.forEach(([s, t]) => { if (s === hovered) adjHi.add(t); if (t === hovered) adjHi.add(s); });
    }
    svg.selectAll(".f35-node").each(function (d: Node) {
      const visible = visibleIds.has(d.id);
      const inCascade = cascadeSet ? cascadeSet.has(d.id) : true;
      const dim = !visible || (cascadeSet && !inCascade) || (hovered && !adjHi.has(d.id));
      d3.select(this).attr("opacity", dim ? 0.13 : 1);
      d3.select(this).select("circle")
        .attr("stroke", d.id === cascadeFrom ? "#f87171" : (d.id === selected?.id ? "#5eead4" : (d.soleSource ? "#fbbf24" : "#0a0e14")))
        .attr("stroke-width", d.id === cascadeFrom || d.id === selected?.id ? 3 : (d.soleSource ? 2 : 1.5));
    });
    svg.selectAll(".f35-link").each(function (l: Link) {
      const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      const visible = visibleIds.has(sId) && visibleIds.has(tId);
      const inCascade = cascadeSet ? (cascadeSet.has(sId) && cascadeSet.has(tId)) : true;
      const hi = hovered && (sId === hovered || tId === hovered);
      const dim = !visible || (cascadeSet && !inCascade) || (hovered && !hi);
      d3.select(this)
        .attr("stroke", cascadeSet && inCascade ? "#f8717155" : hi ? "#5eead4" : "#2a4865")
        .attr("stroke-width", hi ? 2 : 1)
        .attr("opacity", dim ? 0.06 : 0.7);
    });
  }, [visibleIds, hovered, selected, cascadeSet, cascadeFrom]);

  const stats = useMemo(() => ({
    nodes: NODES.length,
    sole: NODES.filter((n) => n.soleSource).length,
    countries: COUNTRIES.length,
    intl: NODES.filter((n) => n.country !== "USA" && n.tier !== "customer").length,
  }), []);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-sm border text-[11px] tracking-wide transition-colors ${
      active ? "border-amber-400 text-amber-300 bg-amber-400/10" : "border-slate-700 text-slate-400 hover:border-slate-500"
    }`;

  return (
    <div className="w-full min-h-screen bg-[#070b12] text-slate-200" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>

      <div className="border-b border-slate-800 px-5 py-4 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-b from-[#0a1320] to-[#070b12]">
        <div>
          <div className="text-[11px] text-amber-400/80 tracking-[0.3em]">SUPPLY CHAIN INTELLIGENCE</div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif" }} className="text-3xl font-bold tracking-wide text-slate-50 leading-none mt-1">
            F-35 LIGHTNING II <span className="text-amber-400">// PROGRAM MAP</span>
          </h1>
          <div className="text-[11px] text-slate-500 mt-1">Prime-contractor model · ~1,900 direct suppliers · {stats.nodes} structure-defining nodes mapped</div>
        </div>
        <div className="flex gap-5 text-right">
          {[["NODES", stats.nodes], ["SOLE-SOURCE", stats.sole], ["COUNTRIES", stats.countries], ["INT'L SUPPLIERS", stats.intl]].map(([l, v]) => (
            <div key={l}>
              <div className="text-2xl font-semibold text-slate-100" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{v}</div>
              <div className="text-[10px] text-slate-500 tracking-widest">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-400">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search supplier / role / ticker…"
          className="bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 focus:border-amber-400 outline-none w-56"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 tracking-widest">TIER</span>
          <button className={chip(tierFilter === "all")} onClick={() => setTierFilter("all")}>ALL</button>
          {Object.entries(TIERS).map(([k]) => (
            <button key={k} className={chip(tierFilter === k)} onClick={() => setTierFilter(k)}>{TIERS[k as keyof typeof TIERS].label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 tracking-widest">COUNTRY</span>
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded-sm px-2 py-1 text-[11px] text-slate-300 outline-none">
            <option value="all">all</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className={chip(soleOnly)} onClick={() => setSoleOnly((s) => !s)}>⚑ SOLE-SOURCE ONLY</button>
        {cascadeFrom && (
          <button className="px-2.5 py-1 rounded-sm border border-rose-500 text-rose-300 bg-rose-500/10 text-[11px]" onClick={() => setCascadeFrom(null)}>
            ✕ CLEAR DISRUPTION CASCADE
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row" style={{ height: "calc(100vh - 132px)", minHeight: 480 }}>
        <div ref={wrapRef} className="relative flex-1 min-h-[440px]">
          <svg ref={svgRef} className="w-full h-full" />
          <div className="absolute bottom-3 left-3 bg-[#0a1320]/90 border border-slate-800 rounded-sm p-2.5 text-[10px] space-y-1 max-w-[220px]">
            <div className="text-slate-500 tracking-widest mb-1">CATEGORY</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {Object.entries(CATEGORIES).map(([k, c]) => (
                <div key={k} className="flex items-center gap-1.5 text-slate-400">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} /> {k}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-amber-300 pt-1 border-t border-slate-800 mt-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-amber-400" /> sole-source chokepoint
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] text-slate-600 tracking-wider">◄ MATERIALS · TIERS · CUSTOMERS ►</div>
        </div>

        <div className="lg:w-[340px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#0a1320]/60 overflow-y-auto">
          {selected ? (
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] tracking-widest" style={{ color: CATEGORIES[selected.cat] }}>{selected.cat.toUpperCase()}</div>
                  <h2 style={{ fontFamily: "'Rajdhani', sans-serif" }} className="text-2xl font-semibold text-slate-50 leading-tight">{selected.name}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300 text-sm">✕</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selected.ticker && <span className="px-2 py-0.5 rounded-sm bg-slate-800 text-slate-300 text-[11px]">{selected.ticker}</span>}
                <span className="px-2 py-0.5 rounded-sm bg-slate-800 text-slate-300 text-[11px]">{TIERS[selected.tier].label}</span>
                <span className="px-2 py-0.5 rounded-sm bg-slate-800 text-slate-300 text-[11px]">{selected.country}</span>
                {selected.soleSource && <span className="px-2 py-0.5 rounded-sm bg-amber-400/15 text-amber-300 text-[11px] border border-amber-400/40">⚑ sole-source</span>}
              </div>
              {selected.loc && <div className="text-[11px] text-slate-500 mt-2">📍 {selected.loc}</div>}
              <div className="mt-3 text-[10px] text-slate-500 tracking-widest">ROLE</div>
              <p className="text-[13px] text-slate-300 leading-relaxed mt-0.5">{selected.role}</p>
              {selected.scale && <><div className="mt-3 text-[10px] text-slate-500 tracking-widest">SCALE / WORKSHARE</div><p className="text-[13px] text-slate-300 mt-0.5">{selected.scale}</p></>}

              <div className="mt-4 flex flex-col gap-2">
                <SupplyList title="SUPPLIES TO →" ids={LINKS.filter(([s]) => s === selected.id).map(([, t]) => t)} onPick={(id) => setSelected(NODES.find((n) => n.id === id) || null)} />
                <SupplyList title="← SOURCED FROM" ids={LINKS.filter(([, t]) => t === selected.id).map(([s]) => s)} onPick={(id) => setSelected(NODES.find((n) => n.id === id) || null)} />
              </div>

              {selected.tier !== "customer" && (
                <button
                  onClick={() => setCascadeFrom(selected.id)}
                  className="mt-4 w-full py-2 rounded-sm border border-rose-500/60 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 text-[12px] tracking-wide"
                >
                  ▶ RUN DISRUPTION CASCADE
                </button>
              )}
              {cascadeFrom === selected.id && cascadeSet && (
                <div className="mt-2 text-[11px] text-rose-300/90">
                  Disruption here propagates to <b>{cascadeSet.size - 1}</b> downstream nodes — everything highlighted feeds off this supplier.
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-slate-500 text-[13px] leading-relaxed">
              <div style={{ fontFamily: "'Rajdhani', sans-serif" }} className="text-xl text-slate-300 mb-2">How to read this</div>
              <p>Nodes flow left → right: <span className="text-slate-300">raw materials</span> feed <span className="text-slate-300">component suppliers</span>, which feed <span className="text-slate-300">principal partners</span> (Northrop, BAE, Pratt & Whitney), which converge on <span className="text-slate-300">Lockheed Martin</span> for final assembly, then deliver to <span className="text-slate-300">end customers</span>.</p>
              <p className="mt-2"><span className="text-amber-300">Amber rings</span> mark sole-source chokepoints — single points of failure with no qualified alternate.</p>
              <p className="mt-2">Click any node for its profile, supply links, and a <span className="text-rose-300">disruption cascade</span> showing everything downstream that depends on it.</p>
              <p className="mt-2 text-slate-600 text-[11px]">Hover to isolate a supplier's direct connections. Drag nodes to rearrange. Use the filters above to slice by tier, country, or subsystem.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplyList({ title, ids, onPick }: { title: string; ids: string[]; onPick: (id: string) => void }) {
  if (!ids.length) return null;
  return (
    <div>
      <div className="text-[10px] text-slate-500 tracking-widest mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const n = NODES.find((x) => x.id === id);
          if (!n) return null;
          return (
            <button key={id} onClick={() => onPick(id)} className="px-2 py-0.5 rounded-sm bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700">
              {n.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
