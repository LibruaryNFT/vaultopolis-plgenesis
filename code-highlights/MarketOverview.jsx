import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign, TrendingUp, ShoppingCart, Layers, Flame,
  Lock, Zap, Target, BarChart2, Users, Award, SearchX,
} from "lucide-react";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE, CHART_CURSOR_STYLE, CHART_ANIMATION_PROPS, CHART_SERIES_COLORS } from "../config/chartStyles";
import { getTopShotMarketData } from "../utils/topShotMarketDataCache";
import { getAllDayMarketData } from "../utils/allDayMarketDataCache";
import { getPinnacleMarketData } from "../utils/pinnacleMarketDataCache";
import { nameToSlug } from "../utils/playerRankingsCache";
import fetchWithTimeout from "../utils/fetchWithTimeout";
import { MARKET_DATA_API } from "../utils/marketDataApi";
import { getMarketSummary } from "../utils/marketSummaryCache";
import { TIER_CONFIG, TIER_LABEL_MAP, getTopShotSeriesName, getTopShotSeriesShort } from "../utils/topShotHelpers";
import { getPinnacleImageUrlSized, getPinnacleEditionTypeLabel, getPinnacleCardBgColor } from "../utils/pinnacleHelpers";
import { getAllDayImageUrlConsistent } from "../utils/allDayImages";
import Spinner from "./Spinner";
import EmptyState from "./EmptyState";
import MomentCellCompact from "./MomentCellCompact";
import FadeIn from "./FadeIn";


function fmtCap(val) {
  if (val == null || isNaN(val)) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function fmtPrice(val) {
  if (val == null || val === 0) return "—";
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function fmtNum(val) {
  if (val == null) return "—";
  return val.toLocaleString();
}

function fmtPct(val) {
  if (val == null || isNaN(val)) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function fmtMomentum(val) {
  if (val == null || isNaN(val)) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val}`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getMomentImage(nftId) {
  if (!nftId) return null;
  return `https://assets.nbatopshot.com/media/${nftId}/image?format=webp&width=256&quality=80`;
}

function getGcsImage(setId, playId) {
  if (!setId || !playId) return null;
  return `https://storage.googleapis.com/flowconnect/topshot/images_small/${setId}_${playId}.jpg`;
}

const PLATFORM_FETCHERS = {
  topshot: getTopShotMarketData,
  allday: getAllDayMarketData,
  pinnacle: getPinnacleMarketData,
};

const PLATFORM_NAME_FIELD = {
  topshot: (e) => (e.FullName || e.player_name || "").trim(),
  allday: (e) => (e.player_name || e.FullName || "").trim(),
  pinnacle: (e) => (e.character_name || e.player_name || "").trim(),
};

function editionLink(platform, e) {
  if (platform === "topshot" && (e.setID || e.set_id) && (e.playID || e.play_id)) {
    return `/analytics/topshot/edition/${e.setID || e.set_id}/${e.playID || e.play_id}`;
  }
  if (platform === "allday" && e.edition_id) return `/analytics/allday/edition/${e.edition_id}`;
  if (platform === "pinnacle" && e.edition_id) return `/analytics/pinnacle/edition/${e.edition_id}`;
  return null;
}

// Extract common card data from a raw edition
function editionToCard(e, platform) {
  const nameField = PLATFORM_NAME_FIELD[platform] || PLATFORM_NAME_FIELD.topshot;
  let imageUrl, tier;
  if (platform === "pinnacle") {
    imageUrl = e.render_id ? getPinnacleImageUrlSized(e.render_id, 200) : null;
    tier = getPinnacleEditionTypeLabel(e.edition_type_id, e.edition_type_name);
  } else if (platform === "allday") {
    imageUrl = e.edition_id ? getAllDayImageUrlConsistent(e.edition_id) : null;
    tier = (e.tier || "").toLowerCase();
  } else {
    imageUrl = e.nft_id_serial1
      ? `https://assets.nbatopshot.com/media/${e.nft_id_serial1}/image?format=webp&width=256&quality=90`
      : null;
    tier = (e.tier || e.momentTier || "").toLowerCase();
  }
  return {
    playerName: nameField(e),
    setName: e.set_name || e.name || "",
    tier,
    imageUrl,
    series: e.series ?? e.series_id ?? null,
    nftId: e.nft_id_serial1 || e.nft_id_recent,
    nftIdFallback: e.nft_id_recent,
    setId: e.setID || e.set_id,
    playId: e.playID || e.play_id,
    editionId: e.edition_id,
    mintCount: parseInt(e.original_mint_count) || parseInt(e.momentCount) || parseInt(e.mint_count) || parseInt(e.existing_supply) || 0,
    serialNumber: null,
    link: editionLink(platform, e),
    platform,
    // Pinnacle-specific
    editionTypeId: e.edition_type_id,
    existingSupply: e.existing_supply,
    variant: e.variant,
  };
}

const PLATFORM_CONFIG = {
  topshot: { entityLabel: "Player", hasLocked: true },
  allday: { entityLabel: "Player", hasLocked: false },
  pinnacle: { entityLabel: "Character", hasLocked: false },
};

const PERIOD_OPTIONS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "90d", label: "90D" },
];

const PLATFORM_LABELS = { topshot: "Top Shot", allday: "All Day", pinnacle: "Pinnacle" };
const PLATFORM_COLORS = { topshot: "text-orange-400", allday: "text-blue-400", pinnacle: "text-purple-400" };

const MarketOverviewTab = ({ platform = "topshot" }) => {
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketSummary, setMarketSummary] = useState([]);
  const [topPurchases, setTopPurchases] = useState([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [period, setPeriod] = useState("7d");
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.topshot;

  useEffect(() => {
    setLoading(true);
    const fetcher = PLATFORM_FETCHERS[platform];
    if (!fetcher) return;
    fetcher()
      .then(result => setEditions(result.editions || []))
      .catch(() => setEditions([]))
      .finally(() => setLoading(false));
  }, [platform]);

  // Fetch platform-specific market summary + top purchases
  useEffect(() => {
    setPulseLoading(true);
    Promise.all([
      getMarketSummary(platform, "3m")
        .then(d => Array.isArray(d) ? d : (d?.weeks || d?.data || []))
        .catch(() => []),
      fetchWithTimeout(`${MARKET_DATA_API}/top-purchases?period=${period}&limit=10&_v=3`, { timeout: 15000, cache: "no-cache" })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([summaryData, purchasesData]) => {
      setMarketSummary(Array.isArray(summaryData) ? summaryData : []);
      setTopPurchases(Array.isArray(purchasesData) ? purchasesData : []);
    }).finally(() => setPulseLoading(false));
  }, [period, platform]);

  // Derive pulse stats from market-summary (platform-specific, not cross-platform)
  const PERIOD_WEEKS = { "1d": 1, "7d": 1, "30d": 4, "60d": 8, "90d": 13 };
  const pulse = useMemo(() => {
    if (!marketSummary.length) return null;
    const sorted = [...marketSummary].sort((a, b) => new Date(b.period_start) - new Date(a.period_start));
    const weeks = PERIOD_WEEKS[period] || 1;
    const current = sorted.slice(0, weeks);
    const previous = sorted.slice(weeks, weeks * 2);
    const sum = (arr, key) => arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);
    const curVol = sum(current, "total_volume");
    const curSales = sum(current, "total_sales");
    const curBuyers = sum(current, "unique_buyers");
    const curSellers = sum(current, "unique_sellers");
    const prevVol = sum(previous, "total_volume");
    const prevSales = sum(previous, "total_sales");
    const prevBuyers = sum(previous, "unique_buyers");
    const prevSellers = sum(previous, "unique_sellers");
    const pct = (cur, prev) => {
      if (prev <= 0 || previous.length === 0) return null;
      const change = (cur - prev) / prev * 100;
      // Cap at ±999% to avoid absurd numbers on long periods
      return Math.max(-999, Math.min(999, change));
    };
    // Only show WoW change for periods with enough comparison data
    const showChange = previous.length > 0;
    return {
      total_volume: curVol, total_purchases: curSales,
      unique_buyers: curBuyers, unique_sellers: curSellers,
      vol_change: showChange ? pct(curVol, prevVol) : null,
      sales_change: showChange ? pct(curSales, prevSales) : null,
      buyers_change: showChange ? pct(curBuyers, prevBuyers) : null,
      sellers_change: showChange ? pct(curSellers, prevSellers) : null,
    };
  }, [marketSummary, period]);

  // Sparkline data (last 8 weeks of sales)
  const sparklineData = useMemo(() => {
    if (!marketSummary.length) return [];
    return [...marketSummary]
      .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
      .slice(-8)
      .map(w => ({ sales: w.total_sales || 0 }));
  }, [marketSummary]);

  const getName = PLATFORM_NAME_FIELD[platform] || PLATFORM_NAME_FIELD.topshot;

  // Edition lookup for top purchases (match set_id+play_id to get image)
  const editionLookup = useMemo(() => {
    const map = new Map();
    for (const e of editions) {
      const sid = e.setID || e.set_id;
      const pid = e.playID || e.play_id;
      if (sid && pid) map.set(`${sid}_${pid}`, e);
      if (e.edition_id) map.set(`ed_${e.edition_id}`, e);
    }
    return map;
  }, [editions]);

  // ── Edition stats ──
  const editionStats = useMemo(() => {
    let totalMarketCap = 0, totalListings = 0, sales7d = 0;
    let totalSupply = 0, totalLocked = 0, editionCount = 0;
    const floors = [];
    for (const e of editions) {
      totalMarketCap += parseFloat(e.market_cap) || 0;
      totalListings += parseInt(e.total_listings || e.listed_count) || 0;
      sales7d += parseInt(e.total_sales_7d) || 0;
      totalSupply += parseInt(e.existing_supply) || 0;
      totalLocked += parseInt(e.locked_count) || 0;
      editionCount++;
      const fp = parseFloat(e.floor_price);
      if (fp > 0) floors.push(fp);
    }
    floors.sort((a, b) => a - b);
    const medianFloor = floors.length > 0 ? floors[Math.floor(floors.length / 2)] : 0;
    const listedPct = totalSupply > 0 ? (totalListings / totalSupply * 100) : 0;
    return { totalMarketCap, totalListings, sales7d, totalSupply, totalLocked, editionCount, medianFloor, listedPct };
  }, [editions]);

  // ── Hottest ──
  const hottest = useMemo(() => editions
    .filter(e => (parseInt(e.sales_momentum_score) || 0) > 0 && (parseInt(e.total_sales_7d) || 0) >= 2)
    .sort((a, b) => {
      const d = (parseInt(b.sales_momentum_score) || 0) - (parseInt(a.sales_momentum_score) || 0);
      return d !== 0 ? d : (parseInt(b.total_sales_7d) || 0) - (parseInt(a.total_sales_7d) || 0);
    })
    .slice(0, 5)
    .map(e => ({
      card: editionToCard(e, platform),
      badge: <span className={(parseInt(e.sales_momentum_score) || 0) > 50 ? "text-green-400 font-semibold" : "text-green-400/70"}>{fmtMomentum(parseInt(e.sales_momentum_score) || 0)}</span>,
      stats: [
        { label: "Floor", value: fmtPrice(parseFloat(e.floor_price) || 0) },
        { label: "7d Sales", value: fmtNum(parseInt(e.total_sales_7d) || 0) },
      ],
    })),
  [editions, platform]);

  // ── Trending Up ──
  const trending = useMemo(() => editions
    .filter(e => (parseFloat(e.price_trend_30d_vs_180d) || 0) > 10 && (parseInt(e.total_sales_30d) || 0) >= 3 && (parseFloat(e.estimated_value) || 0) >= 1)
    .sort((a, b) => (parseFloat(b.price_trend_30d_vs_180d) || 0) - (parseFloat(a.price_trend_30d_vs_180d) || 0))
    .slice(0, 5)
    .map(e => ({
      card: editionToCard(e, platform),
      badge: <span className="text-green-400 font-semibold">{fmtPct(parseFloat(e.price_trend_30d_vs_180d) || 0)}</span>,
      stats: [
        { label: "Floor", value: fmtPrice(parseFloat(e.floor_price) || 0) },
        { label: "EV", value: fmtPrice(parseFloat(e.estimated_value) || 0) },
      ],
    })),
  [editions, platform]);

  // ── Best Value (floor below estimated value) ──
  const bestValue = useMemo(() => editions
    .filter(e => {
      const fp = parseFloat(e.floor_price) || 0;
      const ev = parseFloat(e.estimated_value) || 0;
      const sales = parseInt(e.total_sales_30d) || parseInt(e.total_sales_7d) || 0;
      return fp > 0 && ev > 0 && fp < ev && sales >= 1;
    })
    .sort((a, b) => {
      const ratioA = (parseFloat(a.floor_price) || 99) / (parseFloat(a.estimated_value) || 1);
      const ratioB = (parseFloat(b.floor_price) || 99) / (parseFloat(b.estimated_value) || 1);
      return ratioA - ratioB;
    })
    .slice(0, 5)
    .map(e => ({
      card: editionToCard(e, platform),
      badge: <span className="text-amber-400 font-semibold">{((parseFloat(e.floor_price) || 0) / (parseFloat(e.estimated_value) || 1)).toFixed(2)}x</span>,
      stats: [
        { label: "Floor", value: fmtPrice(parseFloat(e.floor_price) || 0) },
        { label: "EV", value: fmtPrice(parseFloat(e.estimated_value) || 0) },
      ],
    })),
  [editions, platform]);

  // ── Most Active ──
  const mostActive = useMemo(() => editions
    .filter(e => (parseInt(e.total_sales_7d) || 0) > 0)
    .sort((a, b) => (parseInt(b.total_sales_7d) || 0) - (parseInt(a.total_sales_7d) || 0))
    .slice(0, 5)
    .map(e => ({
      card: editionToCard(e, platform),
      badge: <span className="text-blue-400 font-semibold">{fmtNum(parseInt(e.total_sales_7d) || 0)} sales</span>,
      stats: [
        { label: "30d", value: fmtNum(parseInt(e.total_sales_30d) || 0) },
        { label: "Floor", value: fmtPrice(parseFloat(e.floor_price) || 0) },
      ],
    })),
  [editions, platform]);

  // ── Top purchases enriched with edition images (filtered to current platform) ──
  const enrichedPurchases = useMemo(() => {
    return topPurchases.filter(sale => sale.platform === platform).map(sale => {
      let matched = null;
      if (sale.set_id && sale.play_id) matched = editionLookup.get(`${sale.set_id}_${sale.play_id}`);
      if (!matched && sale.edition_id) matched = editionLookup.get(`ed_${sale.edition_id}`);
      // Use editionToCard for platform-aware image/tier handling
      const baseCard = matched ? editionToCard(matched, sale.platform) : {
        playerName: sale.player_name || "Unknown",
        setName: "", tier: "", series: null, imageUrl: null,
        nftId: null, nftIdFallback: null, setId: sale.set_id, playId: sale.play_id,
        editionId: sale.edition_id, mintCount: 0, serialNumber: null,
        link: null, platform: sale.platform,
      };
      return {
        card: {
          ...baseCard,
          playerName: sale.player_name || baseCard.playerName,
          serialNumber: sale.serial_number || null,
          link: sale.set_id && sale.play_id
            ? `/analytics/${sale.platform}/edition/${sale.set_id}/${sale.play_id}`
            : sale.edition_id ? `/analytics/${sale.platform}/edition/${sale.edition_id}` : baseCard.link,
        },
        badge: <span className="text-green-400 font-bold">${Number(sale.price).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>,
        stats: [
          { label: "", value: <span className="text-white/40">{timeAgo(sale.block_timestamp)}</span> },
        ],
      };
    });
  }, [topPurchases, editionLookup, platform]);

  // ── Top 10 players chart ──
  const top10Players = useMemo(() => {
    const playerMap = new Map();
    for (const e of editions) {
      const name = getName(e);
      if (!name || name === "Unknown Player") continue;
      const mcap = parseFloat(e.market_cap) || 0;
      const key = name.toLowerCase();
      playerMap.set(key, { name, market_cap: (playerMap.get(key)?.market_cap || 0) + mcap });
    }
    return Array.from(playerMap.values())
      .sort((a, b) => b.market_cap - a.market_cap)
      .slice(0, 10)
      .map(p => ({
        name: p.name.length > 15 ? p.name.slice(0, 14) + "…" : p.name,
        fullName: p.name, slug: nameToSlug(p.name), market_cap: p.market_cap,
      }));
  }, [editions, getName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <FadeIn>
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-5">

      {/* ── 1. Market Pulse (platform-specific from market-summary) ── */}
      <div className="rounded-xl bg-brand-secondary border border-brand-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-white/70">Market Pulse — {PLATFORM_LABELS[platform]}</h2>
          <div className="inline-flex items-center rounded-lg bg-white/[0.04] p-0.5 border border-brand-border/30">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${period === opt.value ? "bg-opolis/15 text-opolis shadow-sm" : "text-white/50 hover:text-white/80"}`}
              >{opt.label}</button>
            ))}
          </div>
        </div>
        {pulseLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : pulse ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PulseCard icon={DollarSign} label="Sales Volume" value={fmtCap(pulse.total_volume)} accent="text-green-400" change={pulse.vol_change} />
              <PulseCard icon={ShoppingCart} label="Sales" value={fmtNum(pulse.total_purchases)} change={pulse.sales_change} />
              <PulseCard icon={Users} label="Buyers" value={fmtNum(pulse.unique_buyers)} change={pulse.buyers_change} />
              <PulseCard icon={Users} label="Sellers" value={fmtNum(pulse.unique_sellers)} change={pulse.sellers_change} />
            </div>
            {sparklineData.length > 2 && (
              <div className="mt-3 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <Area type="monotone" dataKey="sales" stroke="#50c878" fill="#50c878" fillOpacity={0.1} strokeWidth={1.5} dot={false} {...CHART_ANIMATION_PROPS} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-white/30 text-xs">Market pulse data unavailable</div>
        )}
      </div>

      {/* ── 2. Edition Snapshot Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={DollarSign} label="Market Cap" value={fmtCap(editionStats.totalMarketCap)} />
        <StatCard icon={ShoppingCart} label="Active Listings" value={fmtNum(editionStats.totalListings)} />
        <StatCard icon={TrendingUp} label="7d Sales" value={fmtNum(editionStats.sales7d)} />
        <StatCard icon={Layers} label="Editions" value={fmtNum(editionStats.editionCount)} />
        <StatCard icon={Target} label="Listed %" value={`${editionStats.listedPct.toFixed(1)}%`} />
        <StatCard icon={DollarSign} label="Median Floor" value={fmtPrice(editionStats.medianFloor)} />
      </div>

      {/* ── 3. Mover Cards + Top Purchases (3-column grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {enrichedPurchases.length > 0 && (
          <MoverSection icon={Award} title="Top Purchases" subtitle={`Biggest sales (${period})`} iconColor="text-amber-400"
            items={enrichedPurchases} />
        )}
        <MoverSection icon={Zap} title="Hottest" subtitle="Accelerating sales momentum" items={hottest} />
        <MoverSection icon={TrendingUp} title="Trending Up" subtitle="30d vs 180d price change" items={trending} />
        <MoverSection icon={Target} title="Best Value" subtitle="Floor below estimated value" iconColor="text-amber-400" items={bestValue} />
        <MoverSection icon={BarChart2} title="Most Active" subtitle="Highest 7-day sales count" items={mostActive} />
      </div>

      {/* ── 5. Top 10 Players Chart ── */}
      {top10Players.length > 0 && (
        <div className="rounded-xl bg-brand-secondary border border-brand-border p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Top 10 {config.entityLabel}s by Market Cap</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Players} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtCap(v)} width={65} />
                <Tooltip cursor={CHART_CURSOR_STYLE} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#fff", fontWeight: 600 }} formatter={(value) => [fmtCap(value), "Market Cap"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""} />
                <Bar dataKey="market_cap" radius={[4, 4, 0, 0]} fill={CHART_SERIES_COLORS[0]} {...CHART_ANIMATION_PROPS} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-brand-border">
            {top10Players.map((p, i) => (
              <Link key={p.slug} to={`/players/${p.slug}`} className="text-xs text-white/50 hover:text-opolis transition-colors">
                <span className="font-mono mr-1" style={{ color: CHART_SERIES_COLORS[0] }}>{i + 1}.</span>{p.fullName}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
    </FadeIn>
  );
};

// ── Moment Cell (uses shared MomentCellCompact) ──
const MomentCell = ({ card, badge, stats }) => {
  const isPinnacle = card.platform === "pinnacle";
  const isAllDay = card.platform === "allday";
  const tierKey = isPinnacle ? "" : (card.tier || "unknown").toLowerCase();
  const tierConfig = TIER_CONFIG[tierKey] || TIER_CONFIG.unknown;
  const tierLabel = isPinnacle ? card.tier : (TIER_LABEL_MAP[tierKey] || tierKey);
  const tierTextColor = isPinnacle ? "text-white/90" : (tierConfig?.text || "text-brand-text/50");
  const tierBorderClass = isPinnacle ? "" : (tierConfig?.border || "border-gray-500/40");

  const imgSrc = card.imageUrl || (card.nftId
    ? `https://assets.nbatopshot.com/media/${card.nftId}/image?format=webp&width=256&quality=90`
    : card.setId && card.playId
      ? `https://storage.googleapis.com/flowconnect/topshot/images_small/${card.setId}_${card.playId}.jpg`
      : null);

  const imageScale = isPinnacle ? null : isAllDay ? "scale-[1.75]" : (tierKey === "ultimate" || tierKey === "legendary" ? "scale-125" : "scale-150");
  const imagePosition = isPinnacle ? "center center" : isAllDay ? "center 20%" : "center 25%";
  const bgColor = isPinnacle ? getPinnacleCardBgColor(card.editionTypeId, card.existingSupply) : null;

  const Wrapper = card.link ? Link : "div";
  const wrapperProps = card.link ? { to: card.link, className: "block no-underline min-w-0 flex-shrink" } : { className: "min-w-0 flex-shrink" };

  const serialText = (card.serialNumber || card.mintCount > 0) ? `${card.serialNumber ? `#${card.serialNumber.toLocaleString()}` : ""}${card.mintCount > 0 ? `${card.serialNumber ? " / " : "/ "}${fmtNum(card.mintCount)}` : ""}` : null;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 overflow-hidden">
      <Wrapper {...wrapperProps}>
        <MomentCellCompact
          width="w-full"
          imageUrl={imgSrc}
          imageAlt={card.playerName}
          imageScale={imageScale}
          imagePosition={imagePosition}
          bgColor={bgColor}
          onImageError={(e) => {
            const t = e.target;
            if (card.nftIdFallback && !t.dataset.triedRecent) {
              t.dataset.triedRecent = "1";
              t.src = `https://assets.nbatopshot.com/media/${card.nftIdFallback}/image?format=webp&width=256&quality=90`;
            } else if (!t.dataset.triedGcs && card.setId && card.playId) {
              t.dataset.triedGcs = "1";
              t.src = `https://storage.googleapis.com/flowconnect/topshot/images_small/${card.setId}_${card.playId}.jpg`;
            } else {
              t.style.display = "none";
            }
          }}
          tierBorderClass={tierBorderClass}
          playerName={card.playerName || "Unknown Player"}
          setName={card.setName || ""}
          seriesText={isPinnacle ? (card.variant || null) : (card.series != null ? getTopShotSeriesShort(card.series) : null)}
          tierLabel={tierLabel}
          tierColor={tierTextColor}
          serialInline={serialText}
        />
      </Wrapper>

      {/* Badge */}
      <div className="flex-shrink-0 text-sm font-mono">{badge}</div>

      {/* Stats */}
      {stats.map((s, i) => (
        <div key={i} className="hidden sm:block flex-shrink-0 text-right min-w-[50px]">
          {s.label && <div className="text-[9px] text-brand-text/30 uppercase">{s.label}</div>}
          <div className="text-xs text-brand-text/70 font-mono">{s.value}</div>
        </div>
      ))}
    </div>
  );
};

// ── Mover Section (uses MomentRow cards) ──
const MoverSection = ({ icon: Icon, title, subtitle, items, iconColor = "text-opolis" }) => (
  <div className="rounded-xl bg-brand-secondary border border-brand-border overflow-hidden">
    <div className="px-4 py-3 border-b border-brand-border flex items-center gap-2">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-[11px] text-white/40">{subtitle}</p>
      </div>
    </div>
    {items.length === 0 ? (
      <EmptyState
        icon={SearchX}
        title="No qualifying editions"
        description="No editions match the current criteria."
      />
    ) : (
      <div className="divide-y divide-brand-border/30">
        {items.map((item, i) => (
          <MomentCell key={i} card={item.card} badge={item.badge} stats={item.stats} />
        ))}
      </div>
    )}
  </div>
);

// ── Stat Card ──
const StatCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl bg-brand-secondary border border-brand-border p-3 sm:p-4">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-4 h-4 text-opolis/70" />
      <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">{label}</span>
    </div>
    <div className="text-lg sm:text-xl font-bold font-mono text-white">{value}</div>
  </div>
);

// ── Pulse Card ──
const PulseCard = ({ icon: Icon, label, value, accent, change }) => (
  <div className="text-center sm:text-left">
    <div className="flex items-center gap-1.5 justify-center sm:justify-start mb-1">
      <Icon className="w-3.5 h-3.5 text-white/30" />
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-2 justify-center sm:justify-start">
      <span className={`text-xl sm:text-2xl font-bold font-mono ${accent || "text-white"}`}>{value}</span>
      {change != null && (
        <span className={`text-[11px] font-medium ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? "↑" : "↓"}{Math.abs(change).toFixed(0)}%
        </span>
      )}
    </div>
  </div>
);

export default MarketOverviewTab;
