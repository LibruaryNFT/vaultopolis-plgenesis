import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Trophy, ChevronUp, ChevronDown, RefreshCw, Filter, SearchX } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE, CHART_CURSOR_STYLE, CHART_ANIMATION_PROPS, CHART_SERIES_COLORS } from "../config/chartStyles";
import { getPlayerRankings, invalidatePlayerRankings, nameToSlug } from "../utils/playerRankingsCache";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

const PLATFORM_OPTIONS = [
  { value: "all", label: "All Platforms" },
  { value: "topshot", label: "Top Shot" },
  { value: "allday", label: "All Day" },
  { value: "pinnacle", label: "Pinnacle" },
];

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];


function formatMarketCap(val) {
  if (val == null || isNaN(val)) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function formatPrice(val) {
  if (val == null || val === 0) return "—";
  return `$${val.toFixed(2)}`;
}

function formatNumber(val) {
  if (val == null) return "—";
  return val.toLocaleString();
}

function platformBadge(platforms) {
  const arr = Array.from(platforms);
  const colors = { topshot: "text-orange-400 bg-orange-400/15", allday: "text-blue-400 bg-blue-400/15", pinnacle: "text-purple-400 bg-purple-400/15" };
  const labels = { topshot: "TS", allday: "AD", pinnacle: "PIN" };
  return arr.map(p => (
    <span key={p} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colors[p] || "text-white/50 bg-white/10"}`}>
      {labels[p] || p}
    </span>
  ));
}

const Rankings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const platform = searchParams.get("platform") || "all";
  const sortField = searchParams.get("sort") || "total_market_cap";
  const sortOrder = searchParams.get("order") || "desc";
  const teamFilter = searchParams.get("team") || "";
  const search = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page")) || 1;
  const perPage = parseInt(searchParams.get("per_page")) || 50;

  const setParam = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value && value !== getDefault(key)) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (key !== "page") next.delete("page");
      return next;
    });
  };

  function getDefault(key) {
    const defaults = { platform: "all", sort: "total_market_cap", order: "desc", team: "", q: "", page: "1", per_page: "50" };
    return defaults[key] || "";
  }

  const fetchData = async (force = false) => {
    try {
      if (force) {
        setRefreshing(true);
        invalidatePlayerRankings();
      }
      const result = await getPlayerRankings({ force, platform });
      setPlayers(result.players);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [platform]);

  // Derive teams for filter
  const allTeams = useMemo(() => {
    const teams = new Set();
    players.forEach(p => p.teams?.forEach(t => teams.add(t)));
    return Array.from(teams).sort();
  }, [players]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...players];
    if (teamFilter) {
      result = result.filter(p => p.teams && p.teams.has(teamFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.player_name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === "string") return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [players, teamFilter, search, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Top 10 chart data
  const top10 = useMemo(() =>
    filtered.slice(0, 10).map(p => ({
      name: p.player_name.length > 15 ? p.player_name.slice(0, 14) + "…" : p.player_name,
      fullName: p.player_name,
      market_cap: p.total_market_cap,
      slug: nameToSlug(p.player_name),
    })),
    [filtered]
  );

  const toggleSort = (field) => {
    if (sortField === field) {
      setParam("order", sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set("sort", field);
        next.set("order", "desc");
        next.delete("page");
        return next;
      });
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortOrder === "asc"
      ? <ChevronUp className="w-3 h-3 text-opolis" />
      : <ChevronDown className="w-3 h-3 text-opolis" />;
  };

  const columns = [
    { id: "rank", label: "#", sortable: false, minWidth: 40 },
    { id: "player_name", label: "Player", sortable: true, minWidth: 160 },
    { id: "platforms", label: "Platforms", sortable: false, minWidth: 80 },
    { id: "total_market_cap", label: "Market Cap", sortable: true, minWidth: 100 },
    { id: "edition_count", label: "Editions", sortable: true, minWidth: 70 },
    { id: "total_supply", label: "Total Supply", sortable: true, minWidth: 90 },
    { id: "cheapest_floor", label: "Cheapest Floor", sortable: true, minWidth: 100 },
  ];

  return (
    <>
      <Helmet>
        <title>Player Rankings | Vaultopolis</title>
        <meta name="description" content="Top players ranked by total digital collectible market cap across NBA Top Shot, NFL All Day, and Disney Pinnacle." />
      </Helmet>

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-opolis/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-opolis" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Player Rankings</h1>
              <p className="text-sm text-white/50">
                {filtered.length.toLocaleString()} players ranked by total market cap
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-secondary border border-brand-border text-sm text-brand-text hover:border-opolis/40 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Platform tabs */}
          <div className="flex rounded-lg bg-brand-secondary border border-brand-border overflow-hidden">
            {PLATFORM_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setParam("platform", opt.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-all ${
                  platform === opt.value
                    ? "bg-opolis/15 text-opolis"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Team filter */}
          <div className="relative">
            <select
              value={teamFilter}
              onChange={e => setParam("team", e.target.value)}
              className="appearance-none bg-brand-secondary border border-brand-border rounded-lg px-3 py-1.5 pr-8 text-sm text-brand-text cursor-pointer hover:border-opolis/40 transition-all"
            >
              <option value="">All Teams</option>
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={e => setParam("q", e.target.value)}
            className="bg-brand-secondary border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text placeholder:text-white/30 w-44 focus:outline-none focus:border-opolis/40 transition-all"
          />
        </div>

        {/* Top 10 Bar Chart */}
        {!loading && top10.length > 0 && (
          <div className="mb-6 rounded-xl bg-brand-secondary border border-brand-border p-4">
            <h2 className="text-sm font-semibold text-white/70 mb-3">Top 10 by Market Cap</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => formatMarketCap(v)}
                    width={65}
                  />
                  <Tooltip
                    cursor={CHART_CURSOR_STYLE}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: "#fff", fontWeight: 600 }}
                    formatter={(value) => [formatMarketCap(value), "Market Cap"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  />
                  <Bar dataKey="market_cap" radius={[4, 4, 0, 0]} fill={CHART_SERIES_COLORS[0]} {...CHART_ANIMATION_PROPS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Loading / Error */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size={24} />
          </div>
        )}
        {error && (
          <div className="text-center py-10 text-red-400 text-sm">{error}</div>
        )}

        {/* Table */}
        {!loading && !error && (
          <>
            <div className="rounded-xl bg-brand-secondary border border-brand-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border">
                      {columns.map(col => (
                        <th
                          key={col.id}
                          className={`px-3 py-2.5 text-left text-xs font-semibold text-white/50 uppercase tracking-wider whitespace-nowrap ${
                            col.sortable ? "cursor-pointer select-none hover:text-white/80 transition-colors" : ""
                          }`}
                          style={{ minWidth: col.minWidth }}
                          onClick={col.sortable ? () => toggleSort(col.id) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.sortable && <SortIcon field={col.id} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((player, i) => {
                      const rank = (page - 1) * perPage + i + 1;
                      return (
                        <tr
                          key={player.player_name}
                          className="border-b border-brand-border/50 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-3 py-2.5 text-white/40 font-mono text-xs">{rank}</td>
                          <td className="px-3 py-2.5">
                            <Link
                              to={`/players/${nameToSlug(player.player_name)}`}
                              className="text-white font-medium hover:text-opolis transition-colors"
                            >
                              {player.player_name}
                            </Link>
                            {player.teams && player.teams.size > 0 && (
                              <div className="text-[11px] text-white/40 mt-0.5">
                                {Array.from(player.teams).slice(0, 2).join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              {platformBadge(player.platforms)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-white font-mono font-medium">
                            {formatMarketCap(player.total_market_cap)}
                          </td>
                          <td className="px-3 py-2.5 text-white/70 font-mono">
                            {formatNumber(player.edition_count)}
                          </td>
                          <td className="px-3 py-2.5 text-white/70 font-mono">
                            {formatNumber(player.total_supply)}
                          </td>
                          <td className="px-3 py-2.5 text-white/70 font-mono">
                            {formatPrice(player.cheapest_floor)}
                          </td>
                        </tr>
                      );
                    })}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={columns.length}>
                          <EmptyState
                            icon={SearchX}
                            title="No players found"
                            description="Try adjusting your filters."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <div className="flex items-center gap-2 text-white/50">
                  <span>Rows:</span>
                  <select
                    value={perPage}
                    onChange={e => setParam("per_page", e.target.value)}
                    className="bg-brand-secondary border border-brand-border rounded px-2 py-1 text-brand-text text-xs"
                  >
                    {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setParam("page", String(page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg bg-brand-secondary border border-brand-border text-white/70 hover:text-white disabled:opacity-30 transition-all"
                  >
                    Prev
                  </button>
                  <span className="text-white/50">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setParam("page", String(page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg bg-brand-secondary border border-brand-border text-white/70 hover:text-white disabled:opacity-30 transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Rankings;
