// TopShotEditionAnalytics.js — Ported from FlowConnect
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Tooltip from "./PortfolioTooltip";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, SearchX } from "lucide-react";
import EmptyState from "./EmptyState";
import MultiSelectFilterPopover from "./MultiSelectFilterPopover";
import ColumnSettingsPopover from "./ColumnSettingsPopover";
import AddColumnFilterPopover from "./AddColumnFilterPopover";
import useColumnVisibility from "../hooks/useColumnVisibility";
import useTopShotUUIDMap from "../hooks/useTopShotUUIDMap";
import { COLUMN_DEFINITIONS, COLUMN_PRESETS } from "../config/topShotColumns";

import DataAge from "./DataAge";
import { SUBEDITIONS, getParallelIconUrl } from "../utils/subeditions";
import MomentCellCompact from "./MomentCellCompact";
import { getTopShotMarketData, invalidateTopShotMarketData } from "../utils/topShotMarketDataCache";
import {
  TIER_CONFIG,
  TIER_ORDER,
  TIER_LABEL_MAP,
  getTopShotSeriesName,
  getTopShotSeriesShort,
} from "../utils/topShotHelpers";
import { WNBA_TEAMS } from "../hooks/useMomentFilters";

// Field definitions based on EX44 PostgreSQL calculations
const FIELD_DEFINITIONS = {
  floor_price: "The lowest price at which a moment from this edition is currently listed for sale on the marketplace.",
  mint_count: "The total number of moments that were minted for this edition (including burned ones).",
  burn_count: "The total number of moments from this edition that have been permanently destroyed/burned.",
  existing_supply: "The current circulating supply: mint_count minus burn_count. This is the actual number of moments that exist.",
  asp_lifetime: "Average Sale Price (Lifetime): The average price of all sales for this edition across its entire history.",
  asp_180d: "Median Sale Price (180 days): The median price of sales in the last 180 days. Median is used to prevent outlier sales from skewing the value.",
  total_sales_lifetime: "Total number of sales transactions for this edition across its entire history.",
  total_sales_180d: "Total number of sales transactions in the last 180 days.",
  total_volume_lifetime: "Total dollar volume (sum of all sale prices) for this edition across its entire history.",
  total_volume_180d: "Total dollar volume (sum of all sale prices) in the last 180 days.",
  total_listings: "Number of moments from this edition currently listed for sale on the marketplace.",
  locked_count: "Number of moments from this edition that are currently locked (challenge/pack locking).",
  held_count: "Number of moments from this edition held in wallets (not listed, not locked, not in packs).",
  highest_edition_offer: "The highest current offer amount for the entire edition (edition-level offers from OffersV1/V2 contracts).",
  total_edition_offer_volume: "Total dollar volume of all current edition-level offers for this edition (sum of all edition offer amounts).",
  edition_offer_count: "Number of active edition-level offers currently available for this edition.",
  avg_edition_offer: "Average amount of all current edition-level offers for this edition.",
  lowest_edition_offer: "The lowest current edition-level offer amount for this edition.",
  total_listings: "Total number of listings for this edition (same as listed_count).",
  median_listing_price: "Median price of all current listings for this edition.",
  listings_at_floor: "Number of listings currently priced at the floor price.",
  listing_price_ratio: "Ratio of median listing price to floor price. Higher = more listings above floor.",
  last_sale_price: "The actual price of the most recent sale for this edition.",
  price_trend: "Price trend showing percentage change between timeframes. 7d vs 30d compares recent week to recent month, 30d vs 180d compares recent month to 6-month average. Positive = price increasing, negative = price decreasing.",
  price_trend_7d_vs_30d: "Percentage change in median sale price from 30-day period to 7-day period. Positive = price increased in recent week, negative = price decreased.",
  price_trend_30d_vs_180d: "Percentage change in median sale price from 180-day period to 30-day period. Positive = price increased in recent month, negative = price decreased.",
  sales_momentum_score: "Score (-100 to +100) measuring sales velocity trends. Positive = accelerating (heating up), negative = slowing down (cooling off). Higher absolute values indicate stronger momentum.",
  sales_momentum_confidence: "Confidence level for sales_momentum_score: 'high' (3+ sales in both 7d and 30d), 'medium' (1+ in both), 'low' (any sales), or 'none'.",
  floating_supply_pct: "Percentage of existing supply that is currently listed for sale. Higher percentage = more available on market, but may also indicate weak hands or oversupply.",
  avg_offer_7d: "Average offer amount over the last 7 days.",
  avg_offer_30d: "Average offer amount over the last 30 days.",
  avg_offer_180d: "Average offer amount over the last 180 days.",
  estimated_value: "Fair market value estimate. Uses median sale prices from the last 180 days (excluding special serials and outliers). More recent sales are weighted heavier. Blends with floor price when fewer sales exist. Falls back to last sale price when no recent sales are available. Valuations do not account for serial number premiums (e.g. #1, jersey numbers) or other special attributes.",
  ask_ev_ratio: "Low Ask divided by Estimated Value. Below 1.0x means the floor price is below what the edition is estimated to be worth (potential buy). Above 1.0x means the floor is above EV. Green ≤ 0.9x, yellow 0.9–1.1x, red > 1.1x.",
  value_confidence: "Confidence in estimated value based on 180d sales volume: high (10+), medium (3-9), low (1-2), none (0 sales).",
  liquidity_score: "Composite score (0-100) measuring overall market health. Combines sales velocity, bidder depth, proportional listing supply, and spread tightness.",
  days_since_last_sale: "Number of days since the most recent sale of any moment from this edition.",
  liquidity_spread_pct: "Gap between floor price and highest offer as a % of floor. 0% = offer matches floor (high liquidity). 100% = offer is negligible vs floor (no liquidity).",
  unique_edition_bidders: "Number of unique users who have placed edition-level offers on this edition. Higher count indicates broader demand and more competitive bidding.",
  total_sales_7d: "Total number of sales transactions in the last 7 days. Shows recent trading activity.",
  total_sales_30d: "Total number of sales transactions in the last 30 days. Shows monthly trading activity.",
  sales_activity_score: "Normalized score (0-100) measuring recent trading intensity. Weighted: 50% 7d, 30% 30d, 20% 180d sales.",
  sales_activity_confidence: "Confidence in sales_activity_score: 'high' (5+ sales in 30d), 'medium' (2-4), 'low' (1), or 'none'.",
  offer_frequency_score: "Normalized score (0-100) measuring how often offers are made. Combines days with offers and current bidder count.",
  offer_frequency_confidence: "Confidence in offer_frequency_score: 'high' (10+ days with offers in 180d), 'medium' (3-9), 'low' (1-2), or 'none'.",
  market_freshness_score: "Score (0-100) based on recency of last sale. 100 = sold in last 7 days, decreases as time since sale increases.",
  locked_count: "Number of moments from this edition currently locked in challenges or other contracts.",
  held_count: "Number of moments from this edition currently held in user wallets (not listed, not locked, not in packs).",
  in_packs_count: "Number of moments from this edition currently in Dapper's pack inventory (not yet opened).",
  subedition: "The parallel/subedition variant of this moment. 'Standard' indicates the base edition, other names indicate special parallel variants.",
  market_cap: "Estimated total market value of all moments in this edition: estimated_value × existing_supply.",
  sell_through_rate: "Inventory turnover: total sales in last 30 days / current listed count. Higher = faster turnover of available inventory.",
};

// Header with tooltip helper
const HeaderWithTooltip = ({ field, children, onClick, className = "", style = {}, sortColumn }) => {
  const definition = FIELD_DEFINITIONS[field];
  const isActive = sortColumn === field;
  return (
    <th
      scope="col"
      className={`px-2 py-1.5 text-left text-xs font-semibold cursor-pointer hover:bg-brand-secondary transition-colors select-none focus:outline-none whitespace-nowrap ${isActive ? "text-opolis" : "text-brand-text"} ${className}`}
      onClick={onClick}
      style={style}
    >
      <Tooltip content={definition}>
        <div className="flex items-center gap-1">
          {children}
        </div>
      </Tooltip>
    </th>
  );
};


// Helper function to get unique plays from market data (one per setID+playID)
// Prefers standard edition (subeditionID === 0 or null), falls back to first entry
function getUniquePlays(allData) {
  const playMap = new Map();

  allData.forEach((item) => {
    const key = `${item.setID}_${item.playID}`;
    const subeditionID = item.subeditionID ?? item.subedition_id ?? null;

    // Prefer standard edition (subeditionID === 0 or null)
    if (!playMap.has(key)) {
      playMap.set(key, item);
    } else {
      const existing = playMap.get(key);
      const existingSubeditionID = existing.subeditionID ?? existing.subedition_id ?? null;

      // If current is standard (0 or null) and existing is not, replace
      if ((subeditionID === 0 || subeditionID === null) && existingSubeditionID !== 0 && existingSubeditionID !== null) {
        playMap.set(key, item);
      }
    }
  });

  return Array.from(playMap.values());
}

// Helper function to build subeditions map and hasParallels set from full market data
function buildSubeditionsData(allData) {
  const subeditionsMap = new Map();
  const hasParallelsSet = new Set();

  // Group by setID_playID
  const grouped = new Map();
  allData.forEach((item) => {
    const key = `${item.setID}_${item.playID}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  // Process each group
  grouped.forEach((items, key) => {
    // Filter to actual subeditions (exclude null/undefined subeditionID)
    const subeditions = items.filter(item => {
      const subeditionID = item.subeditionID ?? item.subedition_id;
      return subeditionID !== null && subeditionID !== undefined;
    });

    // Convert to format expected by the component
    const formattedSubeditions = subeditions.map(item => ({
      subedition_id: item.subeditionID ?? item.subedition_id,
      subedition_name: item.subedition_name,
      mint_count: item.mint_count,
      existing_supply: item.existing_supply,
      play_id: item.playID,
      set_id: item.setID,
      player_name: item.FullName || item.player_name,
      first_name: item.first_name,
      last_name: item.last_name,
      series: item.series,
    }));

    // Check if has parallels (more than just standard edition)
    const hasParallels = subeditions.length > 1 ||
      (subeditions.length === 1 && (subeditions[0].subeditionID ?? subeditions[0].subedition_id) !== 0);

    if (hasParallels) {
      hasParallelsSet.add(key);
      subeditionsMap.set(key, formattedSubeditions);
    } else {
      subeditionsMap.set(key, []);
    }
  });

  return { subeditionsMap, hasParallelsSet };
}

export default function TopShotEditionAnalytics({ onDataLoaded }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { getEditionUrl } = useTopShotUUIDMap();
  const [allMoments, setAllMoments] = useState([]);
  const [allMarketData, setAllMarketData] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [subeditionsMap, setSubeditionsMap] = useState(new Map());
  const [hasParallelsSet, setHasParallelsSet] = useState(new Set());
  const [seriesList, setSeriesList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, message: "Loading editions..." });
  const [error, setError] = useState(null);
  const [dataFetchedAt, setDataFetchedAt] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Filter states - vaultopolis pattern: empty array = "All" when emptyMeansAll=true
  // Note: seriesList is already defined above from context/local state
  const [selectedSeries, setSelectedSeries] = useState([]); // Empty array = "All", [2, 3] = selected series
  const [selectedTier, setSelectedTier] = useState([]); // Empty array = "All", ["common", "rare"] = selected tiers
  const [selectedSetID, setSelectedSetID] = useState(null);
  const [selectedSetNames, setSelectedSetNames] = useState([]);

  const hasInitializedFromURL = useRef(false);
  const loadedFromURLRef = useRef(false);
  const [sortColumn, setSortColumn] = useState("estimated_value");
  const [sortDirection, setSortDirection] = useState("desc");
  // Unified filters (used for both table and grid views)
  const [selectedTablePlayerName, setSelectedTablePlayerName] = useState([]);
  const [tableSubeditionFilter, setTableSubeditionFilter] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState([]);
  const [columnValueFilters, setColumnValueFilters] = useState([]);
  // Check if filters differ from defaults
  const hasNonDefaultFilters = selectedSeries.length > 0 || selectedTier.length > 0 ||
    selectedSetNames.length > 0 || selectedTablePlayerName.length > 0 ||
    tableSubeditionFilter.length > 0 || selectedLeague.length > 0 || selectedTeam.length > 0 ||
    columnValueFilters.length > 0 ||
    sortColumn !== "estimated_value" || sortDirection !== "desc";

  const resetAllFilters = () => {
    setSelectedSeries([]);
    setSelectedTier([]);
    setSelectedSetID(null);
    setSelectedSetNames([]);
    setSelectedTablePlayerName([]);
    setTableSubeditionFilter([]);
    setSelectedLeague([]);
    setSelectedTeam([]);
    setColumnValueFilters([]);
    setSortColumn("estimated_value");
    setSortDirection("desc");
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("setID");
    newParams.delete("setName");
    setSearchParams(newParams);
  };

  const addColumnValueFilter = (columnId, operator, value) => {
    setColumnValueFilters(prev => [
      ...prev,
      { id: `${columnId}_${operator}_${value}_${Date.now()}`, columnId, operator, value }
    ]);
    setCurrentPage(1);
  };

  const removeColumnValueFilter = (filterId) => {
    setColumnValueFilters(prev => prev.filter(f => f.id !== filterId));
    setCurrentPage(1);
  };

  // Column visibility
  const {
    visibleColumns, activePreset, atMax, setPreset,
    toggleColumn, resetToDefault, isColumnVisible,
  } = useColumnVisibility();


  // Fetch data function (can be called on mount or manually via refresh)
  const fetchData = async (forceRefresh = false) => {
      try {
        setLoading(true);

      // If data already loaded and not forcing refresh, skip
      // IMPORTANT: Only skip if we have complete data (including parallels)
      if (dataLoaded && !forceRefresh && allMoments.length > 0 && allMarketData.length > 0) {
        // Validate that we have complete data with parallels
        const hasParallels = allMarketData.some(item => {
          const subeditionID = item.subeditionID ?? item.subedition_id ?? null;
          return subeditionID !== null && subeditionID !== 0;
        });
        // If we have parallels, data is complete - skip refetch
        if (hasParallels || allMarketData.length > allMoments.length * 1.5) {
          // Data appears complete (has parallels or significantly more items than unique plays)
          setLoading(false);
          return;
        }
        // Otherwise, data might be incomplete - continue to fetch
        console.warn('Data appears incomplete (no parallels found), refetching...');
      }

      // NEVER use cached unique plays for display - we need ALL editions including parallels
      // Keep loading true until we have complete data

      setLoadingProgress({ current: 0, total: 0, message: "Loading editions..." });

      // Use shared cache — invalidate first if force-refreshing
      if (forceRefresh) invalidateTopShotMarketData();
      const result = await getTopShotMarketData({ force: forceRefresh });
      let allData = result.editions;

      setLoadingProgress({ current: allData.length, total: result.total, message: `Loaded ${allData.length} editions` });
      setLoadingProgress({ current: allData.length, total: allData.length, message: "Processing data..." });

      // Store full market data for table view (all editions including parallels)
      // Format: add isSubedition flag and normalize subeditionID, include all market data
      const formattedAllData = allData.map(item => {
        const subeditionID = item.subeditionID ?? item.subedition_id ?? null;
        // Normalize: treat 0 and null/undefined as the same (both are Standard edition)
        const normalizedSubeditionID = (subeditionID === 0 || subeditionID === null || subeditionID === undefined) ? null : subeditionID;
        return {
          ...item,
          isSubedition: normalizedSubeditionID !== null,
          subeditionID: normalizedSubeditionID,
          subeditionName: item.subedition_name || (normalizedSubeditionID === null ? 'Standard' : `Parallel ${normalizedSubeditionID}`),
          // Use original_mint_count for momentCount (original minted, not circulating)
          momentCount: item.original_mint_count ?? item.momentCount ?? item.mint_count ?? item.existing_supply,
          // Include ALL market data fields (spread to get everything)
          ...item,
        };
      });

      // Deduplicate: Remove entries where setID + playID + normalized subeditionID are the same
      // Uses Map for O(n) performance instead of O(n²) findIndex
      const dedupeMap = new Map();

      formattedAllData.forEach(item => {
        const key = `${item.setID}_${item.playID}_${item.subeditionID ?? 'standard'}`;

        if (!dedupeMap.has(key)) {
          dedupeMap.set(key, item);
        } else {
          // Prefer entry with more non-null fields
          const existing = dedupeMap.get(key);
          const existingDataCount = Object.values(existing).filter(v => v !== null && v !== undefined).length;
          const currentDataCount = Object.values(item).filter(v => v !== null && v !== undefined).length;
          if (currentDataCount > existingDataCount) {
            dedupeMap.set(key, item);
          }
        }
      });

      const deduplicatedData = Array.from(dedupeMap.values());

      // Store full data (all editions including parallels) for table view
      // Also get unique plays (standard editions) for grid view and filtering
      const uniquePlays = getUniquePlays(deduplicatedData);

      // Build subeditions map and hasParallels set from deduplicated data
      const { subeditionsMap: newSubeditionsMap, hasParallelsSet: newHasParallelsSet } = buildSubeditionsData(deduplicatedData);
      setSubeditionsMap(newSubeditionsMap);
      setHasParallelsSet(newHasParallelsSet);

      const formattedParallelCount = deduplicatedData.filter(item => item.isSubedition).length;

      // VALIDATION: Ensure we have complete data before proceeding
      // We should have significantly more items than unique plays (because of parallels)
      // If we don't have parallels, something is wrong - don't mark as loaded
      if (formattedParallelCount === 0 && deduplicatedData.length <= uniquePlays.length * 1.1) {
        console.error('⚠️ CRITICAL: No parallels found in data! Data appears incomplete.');
        console.error(`Unique plays: ${uniquePlays.length}, Total data: ${deduplicatedData.length}`);
        console.error('This should not happen - API should return all editions including parallels.');
        // Still proceed, but log the issue - might be legitimate if no parallels exist
        // (though unlikely for TopShot which has many parallels)
      }

      // Ensure we have data before marking as complete
      if (deduplicatedData.length === 0) {
        throw new Error('No data received from API');
      }

        // Unique sorted list of series
        const s = new Set();
      uniquePlays.forEach((m) => {
          if (Number.isInteger(m.series)) s.add(m.series);
        });
        const sortedSeries = [...s].sort((a, b) => a - b);

      setAllMoments(uniquePlays);
      setAllMarketData(deduplicatedData);
      setSubeditionsMap(newSubeditionsMap);
      setHasParallelsSet(newHasParallelsSet);
        setSeriesList(sortedSeries);

        // Initialize with "All" selected
        setSelectedSeries([]);
        setSelectedTier([]);

      // Data is kept in React state only — sessionStorage removed because
      // the full dataset with all market fields exceeds the 5 MB quota.

      // Only mark as loaded after we have complete data with all editions
      setDataLoaded(true);
      // Share raw edition data with parent (for Live Feed FMV lookups)
      if (onDataLoaded) onDataLoaded(allData);
      // Use backend data_timestamp (when EX44 PostgreSQL table was last rebuilt) if available
      const backendTimestamp = result.dataGeneratedAt
        ? new Date(result.dataGeneratedAt)
        : new Date();
      setDataFetchedAt(backendTimestamp);
      setError(null);
      } catch (err) {
      console.error("Error fetching moment data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
    }
  };

  // Manual refresh function
  // 1) Fetch data (only once per mount)
  useEffect(() => {
    // If data already loaded in state, don't refetch
    if (allMoments.length > 0 && allMarketData.length > 0) {
      setDataLoaded(true);
      setLoading(false);
      return;
    }

    // NEVER use old cache (unique plays only) - it's incomplete
    // Always fetch fresh complete data if we don't have complete data in sessionStorage

    // First time loading, fetch from API
    if (!dataLoaded) {
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Note: hasParallelsSet is already defined above from context/local state

  // hasParallelsSet and subeditionsMap are now built from main data in fetchData
  // No separate fetching needed!

  // fetchSubeditions removed - subeditions are now built from main market data
  // Use subeditionsMap.get(`${setID}_${playID}`) to get subeditions

  // Subeditions map is now built from main data in fetchData
  // No separate cache loading needed!

  // 2) Load from URL ONCE on mount (vaultopolis pattern - single source of truth)
  useEffect(() => {
    // Only run once, when we have data and haven't initialized yet
    if (hasInitializedFromURL.current) return;
    if (allMoments.length === 0 && allMarketData.length === 0) return;

    const urlSetID = searchParams.get("setID");

    if (urlSetID) {
      const numericSetID = parseInt(urlSetID, 10);
      if (!isNaN(numericSetID)) {
        // Find matching moment in data
        const dataSource = allMoments.length > 0 ? allMoments : allMarketData;
        const matchingMoment = dataSource.find(m => {
          const momentSetID = typeof m.setID === 'string' ? parseInt(m.setID, 10) : m.setID;
          return momentSetID === numericSetID;
        });

        if (matchingMoment && matchingMoment.name) {
          setSelectedSetID(numericSetID);
          // selectedSetNames will be synced once setNameOptions are available
          loadedFromURLRef.current = true;
        }
      }
    }

    hasInitializedFromURL.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allMoments.length, allMarketData.length]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedSeries,
    selectedTier,
    selectedSetNames,
    selectedTablePlayerName,
    tableSubeditionFilter,
    selectedLeague,
    selectedTeam,
    subeditionsMap.size, // Reset when subeditions load
  ]);

  // Build set options with both name and setID for unique identification
  // Format: {name: "Set Name", setID: 27, displayText: "Set Name (27)"}
  const setNameOptions = useMemo(() => {
    const setMap = new Map(); // key: "name_setID", value: {name, setID}

    // Use allMoments if available, otherwise fall back to allMarketData
    const dataSource = allMoments.length > 0 ? allMoments : allMarketData;

    dataSource.forEach((m) => {
      if (m.name && typeof m.name === 'string' && m.name.trim() && m.setID != null) {
        const momentSetID = typeof m.setID === 'string' ? parseInt(m.setID, 10) : Number(m.setID);
        if (!isNaN(momentSetID) && isFinite(momentSetID)) {
          const trimmedName = String(m.name.trim());
          const key = `${trimmedName}_${momentSetID}`;
          if (!setMap.has(key)) {
            setMap.set(key, {
              name: trimmedName,
              setID: momentSetID,
              displayText: `${trimmedName} (SetID: ${momentSetID})`
            });
          }
        }
      }
    });

    // Sort by setID (so sets with same name are grouped, ordered by ID)
    const options = Array.from(setMap.values()).sort((a, b) => {
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name);
      }
      return a.setID - b.setID;
    });

    return options;
  }, [allMoments, allMarketData]);

  // 3) Sync selectedSetNames from URL-loaded selectedSetID when setNameOptions becomes available
  useEffect(() => {
    if (!setNameOptions || !Array.isArray(setNameOptions) || setNameOptions.length <= 1) return;
    // Only sync if we have a URL-loaded selectedSetID but selectedSetNames is empty
    if (selectedSetID !== null && selectedSetNames.length === 0) {
      const option = setNameOptions.find(o => o && o.setID === selectedSetID);
      if (option && option.displayText) {
        setSelectedSetNames([option.displayText]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetID, setNameOptions]);


  const playerOptions = useMemo(() => {
    const players = new Set();
    allMoments.forEach((m) => {
      const name = m.FullName || m.fullName;
      if (name && name.trim() && name.trim() !== "Unknown Player") {
        players.add(name.trim());
      }
    });
    return ["all", ...Array.from(players).sort()];
  }, [allMoments]);

  // Memoize derived option arrays to prevent re-renders in filter popovers
  const playerFilterOptions = useMemo(() => playerOptions.filter(p => p !== "all"), [playerOptions]);
  const setFilterOptions = useMemo(() => setNameOptions.map(opt => opt.displayText), [setNameOptions]);
  const tierFilterOptions = useMemo(() => TIER_ORDER.filter(tier => tier !== "mixed"), []);
  const subeditionOptions = useMemo(() => {
    const subeditions = new Set();
    allMarketData.forEach(m => {
      const name = m.subeditionName || (m.isSubedition ? `Parallel ${m.subeditionID}` : "Standard");
      if (name) subeditions.add(name);
    });
    return Array.from(subeditions).sort();
  }, [allMarketData]);

  const leagueOptions = useMemo(() => {
    const leagues = new Set();
    allMarketData.forEach(m => {
      const team = m.TeamAtMoment || "";
      if (team) leagues.add(WNBA_TEAMS.includes(team) ? "WNBA" : "NBA");
    });
    return Array.from(leagues).sort();
  }, [allMarketData]);

  const teamOptions = useMemo(() => {
    const teams = new Set();
    allMarketData.forEach(m => {
      const team = m.TeamAtMoment || "";
      if (team) teams.add(team);
    });
    return Array.from(teams).sort();
  }, [allMarketData]);

  // Cross-filter counts: for each filter, count editions matching all OTHER active filters
  // This lets each dropdown show "(N)" counts and auto-hide options with 0 matches
  const crossFilterCounts = useMemo(() => {
    if (allMarketData.length === 0) return null;

    // Pre-build setID → displayText lookup for Set filter counts
    const setIdToDisplay = new Map();
    setNameOptions.forEach(o => { if (o.setID != null) setIdToDisplay.set(o.setID, o.displayText); });

    // Build predicates for each active filter — only added when filter is non-empty
    const preds = {};
    if (selectedSeries.length > 0) {
      const nums = new Set(selectedSeries.map(Number));
      preds.series = (m) => nums.has(m.series);
    }
    if (selectedTier.length > 0) {
      preds.tier = (m) => {
        const raw = (m.tier || "").trim().toLowerCase();
        if (!raw || raw === "none") return selectedTier.includes("unknown");
        if (raw.includes("/")) return selectedTier.includes("mixed");
        return selectedTier.includes(raw);
      };
    }
    if (selectedLeague.length > 0) {
      preds.league = (m) => {
        const team = m.TeamAtMoment || "";
        return team ? selectedLeague.includes(WNBA_TEAMS.includes(team) ? "WNBA" : "NBA") : false;
      };
    }
    if (selectedSetNames.length > 0) {
      const ids = new Set();
      selectedSetNames.forEach(dt => { const o = setNameOptions.find(x => x.displayText === dt); if (o) ids.add(o.setID); });
      preds.set = (m) => {
        const sid = typeof m.setID === "string" ? parseInt(m.setID, 10) : Number(m.setID);
        return !isNaN(sid) && ids.has(sid);
      };
    }
    if (selectedTeam.length > 0) {
      preds.team = (m) => { const t = m.TeamAtMoment || ""; return t && selectedTeam.includes(t); };
    }
    if (selectedTablePlayerName.length > 0) {
      preds.player = (m) => { const n = m.FullName || m.fullName; return n && selectedTablePlayerName.includes(n.trim()); };
    }
    if (tableSubeditionFilter.length > 0) {
      preds.parallel = (m) => {
        const name = m.subeditionName || (m.isSubedition ? `Parallel ${m.subeditionID}` : "Standard");
        return tableSubeditionFilter.includes(name);
      };
    }
    if (columnValueFilters.length > 0) {
      preds.colVal = (m) => columnValueFilters.every(({ columnId, operator, value }) => {
        const colDef = COLUMN_DEFINITIONS.find(c => c.id === columnId);
        const raw = m[colDef?.field || columnId];
        if (raw == null) return false;
        const num = Number(raw);
        if (isNaN(num)) return false;
        return operator === ">" ? num > value : operator === "<" ? num < value : operator === ">=" ? num >= value : operator === "<=" ? num <= value : true;
      });
    }

    const predEntries = Object.entries(preds);

    // Count editions grouped by a key, applying all predicates EXCEPT the excluded one
    const countBy = (excludeKey, groupFn) => {
      const active = predEntries.filter(([k]) => k !== excludeKey).map(([, fn]) => fn);
      const counts = {};
      let total = 0;
      for (const m of allMarketData) {
        // Always exclude zero-supply and Genesis set
        const supply = m.existing_supply ?? m.momentCount ?? 0;
        if (supply <= 0) continue;
        if (m.set_id === 1 || m.setID === 1) continue;

        let passes = true;
        for (const fn of active) { if (!fn(m)) { passes = false; break; } }
        if (!passes) continue;

        total++;
        const group = groupFn(m);
        if (group != null && group !== "") counts[group] = (counts[group] || 0) + 1;
      }
      counts["All"] = total;
      return counts;
    };

    return {
      series: countBy("series", m => m.series),
      tier: countBy("tier", m => {
        const raw = (m.tier || "").trim().toLowerCase();
        return (!raw || raw === "none") ? "unknown" : raw;
      }),
      league: countBy("league", m => {
        const team = m.TeamAtMoment || "";
        return team ? (WNBA_TEAMS.includes(team) ? "WNBA" : "NBA") : null;
      }),
      set: countBy("set", m => {
        const sid = typeof m.setID === "string" ? parseInt(m.setID, 10) : Number(m.setID);
        return !isNaN(sid) ? (setIdToDisplay.get(sid) || null) : null;
      }),
      team: countBy("team", m => m.TeamAtMoment || null),
      player: countBy("player", m => { const n = m.FullName || m.fullName; return n ? n.trim() : null; }),
      parallel: countBy("parallel", m => m.subeditionName || (m.isSubedition ? `Parallel ${m.subeditionID}` : "Standard")),
    };
  }, [allMarketData, selectedSeries, selectedTier, selectedLeague, selectedSetNames, setNameOptions,
      selectedTeam, selectedTablePlayerName, tableSubeditionFilter, columnValueFilters]);

  // 3) Apply Filters
  const filtered = useMemo(() => {
    const sourceData = allMarketData;
    if (sourceData.length === 0) return [];
    let result = [...sourceData];

    // Series - empty array = "All" (emptyMeansAll=true)
    if (selectedSeries.length > 0) {
      const numericSeries = selectedSeries.map(s => Number(s)).filter(n => !isNaN(n));
      result = result.filter((m) => numericSeries.includes(m.series));
    }

    // Tier - empty array = "All" (emptyMeansAll=true)
    if (selectedTier.length > 0) {
      result = result.filter((m) => {
        const raw = (m.tier || "").trim().toLowerCase();
        if (!raw || raw === "none") return selectedTier.includes("unknown");
        if (raw.includes("/")) return selectedTier.includes("mixed");
        return selectedTier.includes(raw);
      });
    }

    // Set filter (multi-select via displayText → setID lookup)
    if (selectedSetNames.length > 0) {
      const selectedSetIDs = new Set();
      selectedSetNames.forEach(displayText => {
        const opt = setNameOptions.find(o => o.displayText === displayText);
        if (opt && opt.setID != null) selectedSetIDs.add(opt.setID);
      });
      result = result.filter((m) => {
        const momentSetID = m.setID != null
          ? (typeof m.setID === 'string' ? parseInt(m.setID, 10) : Number(m.setID))
          : null;
        if (momentSetID === null || isNaN(momentSetID)) return false;
        return selectedSetIDs.has(momentSetID);
      });
    }

    // Player filter
    if (selectedTablePlayerName.length > 0) {
      result = result.filter((m) => {
        const name = m.FullName || m.fullName;
        return name && selectedTablePlayerName.includes(name.trim());
      });
    }

    // Subedition filter
    if (tableSubeditionFilter.length > 0) {
      result = result.filter((m) => {
        const subeditionName = m.subeditionName || (m.isSubedition ? `Parallel ${m.subeditionID}` : "Standard");
        return tableSubeditionFilter.includes(subeditionName);
      });
    }

    // League filter (NBA/WNBA derived from TeamAtMoment)
    if (selectedLeague.length > 0) {
      result = result.filter((m) => {
        const team = m.TeamAtMoment || "";
        if (!team) return false;
        const league = WNBA_TEAMS.includes(team) ? "WNBA" : "NBA";
        return selectedLeague.includes(league);
      });
    }

    // Team filter
    if (selectedTeam.length > 0) {
      result = result.filter((m) => {
        const team = m.TeamAtMoment || "";
        return team && selectedTeam.includes(team);
      });
    }

    // Column value filters
    if (columnValueFilters.length > 0) {
      result = result.filter((m) => {
        return columnValueFilters.every(({ columnId, operator, value }) => {
          const colDef = COLUMN_DEFINITIONS.find(c => c.id === columnId);
          const dataField = colDef?.field || columnId;
          const raw = m[dataField];
          if (raw == null) return false;
          const num = Number(raw);
          if (isNaN(num)) return false;
          switch (operator) {
            case ">":  return num > value;
            case "<":  return num < value;
            case ">=": return num >= value;
            case "<=": return num <= value;
            default:   return true;
          }
        });
      });
    }

    // Always exclude zero supply editions and Genesis set (set_id 1)
    result = result.filter((m) => {
      const supply = m.existing_supply ?? m.momentCount ?? 0;
      if (supply <= 0) return false;
      if (m.set_id === 1 || m.setID === 1) return false;
      return true;
    });

    // Apply sorting if sortColumn is set
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
          case "FullName":
            aVal = (a.FullName || "").toLowerCase();
            bVal = (b.FullName || "").toLowerCase();
            break;
          case "name":
            aVal = (a.name || "").toLowerCase();
            bVal = (b.name || "").toLowerCase();
            break;
          case "setID":
            aVal = a.setID || 0;
            bVal = b.setID || 0;
            break;
          case "series":
            aVal = a.series ?? 999;
            bVal = b.series ?? 999;
            break;
          case "tier":
            aVal = (a.tier || "").toLowerCase();
            bVal = (b.tier || "").toLowerCase();
            break;
          case "momentCount":
            aVal = a.momentCount || 0;
            bVal = b.momentCount || 0;
            break;
          case "retired":
            aVal = a.retired ? 1 : 0;
            bVal = b.retired ? 1 : 0;
            break;
          case "subeditionName":
            aVal = (a.subeditionName || "Standard").toLowerCase();
            bVal = (b.subeditionName || "Standard").toLowerCase();
            break;
          case "floor_price":
            aVal = a.floor_price;
            bVal = b.floor_price;
            break;
          case "mint_count":
            aVal = a.mint_count ?? 0;
            bVal = b.mint_count ?? 0;
            break;
          case "burn_count":
            aVal = a.burn_count ?? 0;
            bVal = b.burn_count ?? 0;
            break;
          case "existing_supply":
            aVal = a.existing_supply ?? a.momentCount ?? 0;
            bVal = b.existing_supply ?? b.momentCount ?? 0;
            break;
          case "asp_180d":
            aVal = a.asp_180d;
            bVal = b.asp_180d;
            break;
          case "highest_edition_offer":
            aVal = a.highest_edition_offer;
            bVal = b.highest_edition_offer;
            break;
          case "liquidity_spread_pct":
            aVal = a.liquidity_spread_pct;
            bVal = b.liquidity_spread_pct;
            break;
          case "total_edition_offer_volume":
            aVal = a.total_edition_offer_volume;
            bVal = b.total_edition_offer_volume;
            break;
          case "unique_edition_bidders":
            aVal = a.unique_edition_bidders;
            bVal = b.unique_edition_bidders;
            break;
          case "edition_offer_count":
            aVal = a.edition_offer_count;
            bVal = b.edition_offer_count;
            break;
          case "avg_edition_offer":
            aVal = a.avg_edition_offer;
            bVal = b.avg_edition_offer;
            break;
          case "listings_at_floor":
            aVal = a.listings_at_floor;
            bVal = b.listings_at_floor;
            break;
          case "last_sale_price":
            aVal = a.last_sale_price;
            bVal = b.last_sale_price;
            break;
          case "price_trend_30d_vs_180d":
            aVal = a.price_trend_30d_vs_180d;
            bVal = b.price_trend_30d_vs_180d;
            break;
          case "sales_momentum_score":
            aVal = a.sales_momentum_score;
            bVal = b.sales_momentum_score;
            break;
          case "total_sales_7d":
            aVal = a.total_sales_7d;
            bVal = b.total_sales_7d;
            break;
          case "total_sales_30d":
            aVal = a.total_sales_30d;
            bVal = b.total_sales_30d;
            break;
          case "total_sales_180d":
            aVal = a.total_sales_180d;
            bVal = b.total_sales_180d;
            break;
          case "floating_supply_pct":
            aVal = a.floating_supply_pct;
            bVal = b.floating_supply_pct;
            break;
          case "estimated_value":
            aVal = a.estimated_value;
            bVal = b.estimated_value;
            break;
          case "ask_ev_ratio":
            aVal = (a.floor_price && a.estimated_value) ? a.floor_price / a.estimated_value : null;
            bVal = (b.floor_price && b.estimated_value) ? b.floor_price / b.estimated_value : null;
            break;
          case "liquidity_score":
            aVal = a.liquidity_score;
            bVal = b.liquidity_score;
            break;
          case "days_since_last_sale":
            aVal = a.days_since_last_sale;
            bVal = b.days_since_last_sale;
            break;
          case "market_cap":
            aVal = a.market_cap;
            bVal = b.market_cap;
            break;
          case "sell_through_rate":
            aVal = a.sell_through_rate;
            bVal = b.sell_through_rate;
            break;
          default:
            return 0;
        }
        // Push null/undefined/0 values to bottom regardless of sort direction
        const aEmpty = aVal == null || aVal === 0;
        const bEmpty = bVal == null || bVal === 0;
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;  // a has no data → push to bottom
        if (bEmpty) return -1; // b has no data → push to bottom
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by setID then playID for TopShot (if no sort is applied)
      result = result.sort((a, b) => {
        if (a.setID !== b.setID) {
          return (a.setID || 0) - (b.setID || 0);
        }
        return (a.playID || 0) - (b.playID || 0);
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allMoments,
    selectedSeries,
    selectedTier,
    selectedSetNames,
    setNameOptions,
    selectedTablePlayerName,
    tableSubeditionFilter,
    selectedLeague,
    selectedTeam,
    columnValueFilters,
    sortColumn,
    sortDirection,
    hasParallelsSet,
    allMarketData,
  ]);

  // Subeditions are now built from main data in fetchData
  // No separate on-demand loading needed!

  // 2) Loading / Error - MUST be after all hooks
  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }
  if (loading) {
    const progressPercent = loadingProgress.total > 0
      ? Math.round((loadingProgress.current / loadingProgress.total) * 100)
      : 0;

    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={36} />
        <span className="text-xl text-brand-text mb-2">{loadingProgress.message}</span>
        {loadingProgress.total > 0 && (
          <>
            <div className="w-64 bg-brand-secondary rounded-full h-2.5 mb-2">
              <div
                className="bg-opolis h-2.5 rounded-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-sm text-brand-text/70">
              {loadingProgress.current.toLocaleString()} / {loadingProgress.total.toLocaleString()} editions
            </span>
          </>
        )}
      </div>
    );
  }

  // All editions (including parallels) are already in filtered data
  const expandedFiltered = filtered;

  // Helper function to get sort icon
  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="text-brand-text/50" size={12} />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="text-opolis" size={12} />
      : <ArrowDown className="text-opolis" size={12} />;
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handlePresetChange = (key) => {
    setPreset(key);
    const preset = COLUMN_PRESETS[key];
    setColumnValueFilters(preset?.defaultFilters || []);
    if (preset?.defaultSort) {
      setSortColumn(preset.defaultSort.field);
      setSortDirection(preset.defaultSort.order);
    }
  };

  // 4) Render
  return (
    <div className="p-3 sm:p-4">
      {/* Edition Filters section */}
      <div className="mb-2 rounded-lg bg-white/[0.04] px-3 py-2.5 relative z-30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-text/40 mr-0.5">Edition Filters</span>
          <MultiSelectFilterPopover
            label="Series"
            options={seriesList}
            selectedValues={selectedSeries}
            onChange={(values) => {
              setSelectedSeries(values.map(Number).filter(n => !isNaN(n)));
              setCurrentPage(1);
            }}
            placeholder="Search series..."
            emptyMeansAll={true}
            formatOption={(num) => getTopShotSeriesName(Number(num))}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.series[v] ?? 0 : null}
            minSelection={0}
          />
          <MultiSelectFilterPopover
            label="Tier"
            options={tierFilterOptions}
            selectedValues={selectedTier}
            onChange={(values) => {
              setSelectedTier(values);
              setCurrentPage(1);
            }}
            placeholder="Search tiers..."
            emptyMeansAll={true}
            formatOption={(tierKey) => TIER_LABEL_MAP[tierKey] || tierKey}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.tier[v] ?? 0 : null}
            minSelection={0}
          />
          <MultiSelectFilterPopover
            label="League"
            options={leagueOptions}
            selectedValues={selectedLeague}
            onChange={(values) => {
              setSelectedLeague(values);
              setCurrentPage(1);
            }}
            placeholder="Search leagues..."
            emptyMeansAll={true}
            formatOption={(league) => league}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.league[v] ?? 0 : null}
          />
          <MultiSelectFilterPopover
            label="Set"
            options={setFilterOptions}
            selectedValues={selectedSetNames}
            onChange={(values) => {
              setSelectedSetNames(values);
              const newParams = new URLSearchParams(searchParams);
              if (values.length > 0) {
                const firstOption = setNameOptions.find(o => o && o.displayText === values[0]);
                if (firstOption && firstOption.setID != null) {
                  setSelectedSetID(firstOption.setID);
                  newParams.set("setID", String(firstOption.setID));
                } else {
                  newParams.delete("setID");
                }
              } else {
                setSelectedSetID(null);
                newParams.delete("setID");
              }
              newParams.delete("setName");
              setSearchParams(newParams);
              setCurrentPage(1);
            }}
            placeholder="Search sets..."
            emptyMeansAll={true}
            formatOption={(displayText) => displayText}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.set[v] ?? 0 : null}
          />
          <MultiSelectFilterPopover
            label="Team"
            options={teamOptions}
            selectedValues={selectedTeam}
            onChange={(values) => {
              setSelectedTeam(values);
              setCurrentPage(1);
            }}
            placeholder="Search teams..."
            emptyMeansAll={true}
            formatOption={(team) => team}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.team[v] ?? 0 : null}
          />
          <MultiSelectFilterPopover
            label="Player"
            options={playerFilterOptions}
            selectedValues={selectedTablePlayerName}
            onChange={(values) => {
              setSelectedTablePlayerName(values);
              setCurrentPage(1);
            }}
            placeholder="Search players..."
            formatOption={(player) => player}
            emptyMeansAll={true}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.player[v] ?? 0 : null}
          />
          <MultiSelectFilterPopover
            label="Parallel"
            options={subeditionOptions}
            selectedValues={tableSubeditionFilter}
            onChange={(values) => {
              setTableSubeditionFilter(values);
              setCurrentPage(1);
            }}
            placeholder="Search parallels..."
            emptyMeansAll={true}
            formatOption={(name) => name}
            getCount={crossFilterCounts ? (v) => crossFilterCounts.parallel[v] ?? 0 : null}
            minSelection={0}
          />
          {hasNonDefaultFilters && (
            <button
              onClick={resetAllFilters}
              className="text-[11px] text-opolis hover:opacity-80 transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </div>


      {/* Active edition filter tags */}
      {hasNonDefaultFilters && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {selectedSeries.length > 0 && selectedSeries.length < seriesList.length && selectedSeries.map((serieIdStr) => {
            const serieId = Number(serieIdStr);
            return (
              <span key={`filter-series-${serieId}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
                Series: {getTopShotSeriesName(serieId)}
                <button onClick={() => { setSelectedSeries(selectedSeries.filter(s => s !== serieIdStr)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
              </span>
            );
          })}
          {selectedTier.length > 0 && selectedTier.length < TIER_ORDER.filter(t => t !== "mixed").length && selectedTier.map((tierKey) => {
            const tierConfig = TIER_CONFIG[tierKey];
            const label = TIER_LABEL_MAP[tierKey] || tierKey;
            const tierTextColor = tierConfig?.text || "text-brand-text";
            return (
              <span key={`filter-tier-${tierKey}`} className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary ${tierTextColor} rounded h-[24px]`}>
                Tier: {label}
                <button onClick={() => { setSelectedTier(selectedTier.filter(t => t !== tierKey)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
              </span>
            );
          })}
          {selectedLeague.length > 0 && selectedLeague.map((league) => (
            <span key={`f-league-${league}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
              League: {league}
              <button onClick={() => { setSelectedLeague(selectedLeague.filter(l => l !== league)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          {selectedSetNames.length > 0 && selectedSetNames.map(s => (
            <span key={`f-set-${s}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
              Set: {s}
              <button onClick={() => { const updated = selectedSetNames.filter(x => x !== s); setSelectedSetNames(updated); if (updated.length === 0) { setSelectedSetID(null); const newParams = new URLSearchParams(searchParams); newParams.delete("setID"); newParams.delete("setName"); setSearchParams(newParams); } setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          {selectedTeam.length > 0 && selectedTeam.map((team) => (
            <span key={`f-team-${team}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
              Team: {team}
              <button onClick={() => { setSelectedTeam(selectedTeam.filter(t => t !== team)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          {selectedTablePlayerName.length > 0 && selectedTablePlayerName.map((player) => (
            <span key={`f-player-${player}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
              Player: {player}
              <button onClick={() => { setSelectedTablePlayerName(selectedTablePlayerName.filter(p => p !== player)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          {tableSubeditionFilter.length > 0 && tableSubeditionFilter.map((sub) => (
            <span key={`f-sub-${sub}`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
              Parallel: {sub}
              <button onClick={() => { setTableSubeditionFilter(tableSubeditionFilter.filter(s => s !== sub)); setCurrentPage(1); }} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
            </span>
          ))}
          {columnValueFilters.map((f) => {
            const colDef = COLUMN_DEFINITIONS.find(c => c.id === f.columnId);
            const label = colDef?.label || f.columnId;
            const priceColumns = ["floor_price", "highest_edition_offer", "last_sale_price", "estimated_value", "asp_180d", "total_edition_offer_volume", "market_cap"];
            const pctColumns = ["liquidity_spread_pct", "floating_supply_pct"];
            const ratioColumns = ["ask_ev_ratio"];
            const displayValue = priceColumns.includes(f.columnId) ? `$${f.value.toLocaleString()}` : pctColumns.includes(f.columnId) ? `${f.value}%` : ratioColumns.includes(f.columnId) ? `${f.value}x` : f.value.toLocaleString();
            return (
              <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-secondary text-brand-text rounded h-[24px]">
                {label} {f.operator} {displayValue}
                <button onClick={() => removeColumnValueFilter(f.id)} className="hover:text-red-400 ml-0.5" title="Remove">×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Info line + column controls */}
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1 mb-2">
        <span className="text-[11px] text-brand-text/40">
          {expandedFiltered.length.toLocaleString()} {expandedFiltered.length === 1 ? 'edition' : 'editions'}
          {dataFetchedAt && (
            <DataAge fetchedAt={dataFetchedAt} schedule="Refreshes daily" />
          )}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-brand-text/40 font-medium">View</span>
            <select
              value={activePreset ?? "__custom__"}
              onChange={e => { if (e.target.value !== "__custom__") handlePresetChange(e.target.value); }}
              className="text-[11px] bg-brand-secondary border border-brand-border rounded-md px-2 py-1 text-brand-text/70 cursor-pointer focus:outline-none focus:border-opolis/50"
            >
              {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
              {activePreset === null && <option value="__custom__" disabled>Custom</option>}
            </select>
          </div>
          <div className="h-5 w-px bg-brand-border/30 hidden sm:block" />
          <ColumnSettingsPopover
            visibleColumns={visibleColumns}
            activePreset={activePreset}
            atMax={atMax}
            onSetPreset={handlePresetChange}
            onToggleColumn={toggleColumn}
            onReset={resetToDefault}
          />
          <AddColumnFilterPopover
            columnDefinitions={COLUMN_DEFINITIONS}
            onApply={addColumnValueFilter}
            existingFilters={columnValueFilters}
          />
        </div>
      </div>

      {/* Table view */}
      <div className="relative w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-6rem)] table-scroll bg-white/[0.04] rounded-lg">
            <table className="border-collapse" style={{ minWidth: '100%' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-brand-secondary border-b border-brand-border">
                  {(isColumnVisible("artwork") || isColumnVisible("moment")) && (
                    <th scope="col" className="px-1 py-1.5 text-left text-xs font-semibold text-brand-text sticky left-0 z-20 bg-brand-secondary" style={{ width: '255px', minWidth: '255px', maxWidth: '255px', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.3)' }}>
                      Moment
                    </th>
                  )}
                  {isColumnVisible("onchain_ids") && (
                    <th scope="col" className="px-2 py-1.5 text-left text-xs font-semibold text-brand-text" style={{ minWidth: '110px', width: '110px' }}>
                      On-Chain IDs
                    </th>
                  )}
                  {isColumnVisible("floor_price") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="floor_price" onClick={() => handleSort("floor_price")} style={{ minWidth: '82px', width: '82px' }}>
                      Low Ask
                      {getSortIcon("floor_price")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("highest_edition_offer") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="highest_edition_offer" onClick={() => handleSort("highest_edition_offer")} style={{ minWidth: '88px', width: '88px' }}>
                      Hi Offer
                      {getSortIcon("highest_edition_offer")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("liquidity_spread_pct") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="liquidity_spread_pct" onClick={() => handleSort("liquidity_spread_pct")} style={{ minWidth: '76px', width: '76px' }}>
                      Bid-Ask %
                      {getSortIcon("liquidity_spread_pct")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("last_sale_price") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="last_sale_price" onClick={() => handleSort("last_sale_price")} style={{ minWidth: '82px', width: '82px' }}>
                      Last Sale
                      {getSortIcon("last_sale_price")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("estimated_value") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="estimated_value" onClick={() => handleSort("estimated_value")} style={{ minWidth: '88px', width: '88px' }}>
                      Est. Value
                      {getSortIcon("estimated_value")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("ask_ev_ratio") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="ask_ev_ratio" onClick={() => handleSort("ask_ev_ratio")} style={{ minWidth: '68px', width: '68px' }}>
                      Ask/EV
                      {getSortIcon("ask_ev_ratio")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("asp_180d") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="asp_180d" onClick={() => handleSort("asp_180d")} style={{ minWidth: '82px', width: '82px' }}>
                      ASP (180d)
                      {getSortIcon("asp_180d")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("market_cap") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="market_cap" onClick={() => handleSort("market_cap")} style={{ minWidth: '90px', width: '90px' }}>
                      Market Cap
                      {getSortIcon("market_cap")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("existing_supply") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="existing_supply" onClick={() => handleSort("existing_supply")} style={{ minWidth: '72px', width: '72px' }}>
                      Supply
                      {getSortIcon("existing_supply")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("total_listings") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="total_listings" onClick={() => handleSort("total_listings")} style={{ minWidth: '68px', width: '68px' }}>
                      Listed
                      {getSortIcon("total_listings")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("locked_count") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="locked_count" onClick={() => handleSort("locked_count")} style={{ minWidth: '68px', width: '68px' }}>
                      Locked
                      {getSortIcon("locked_count")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("held_count") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="held_count" onClick={() => handleSort("held_count")} style={{ minWidth: '68px', width: '68px' }}>
                      Held
                      {getSortIcon("held_count")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("burn_count") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="burn_count" onClick={() => handleSort("burn_count")} style={{ minWidth: '68px', width: '68px' }}>
                      Burned
                      {getSortIcon("burn_count")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("floating_supply_pct") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="floating_supply_pct" onClick={() => handleSort("floating_supply_pct")} style={{ minWidth: '76px', width: '76px' }}>
                      % Listed
                      {getSortIcon("floating_supply_pct")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("listings_at_floor") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="listings_at_floor" onClick={() => handleSort("listings_at_floor")} style={{ minWidth: '78px', width: '78px' }}>
                      At Floor
                      {getSortIcon("listings_at_floor")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("total_edition_offer_volume") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="total_edition_offer_volume" onClick={() => handleSort("total_edition_offer_volume")} style={{ minWidth: '100px', width: '100px' }}>
                      Offer Vol
                      {getSortIcon("total_edition_offer_volume")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("unique_edition_bidders") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="unique_edition_bidders" onClick={() => handleSort("unique_edition_bidders")} style={{ minWidth: '76px', width: '76px' }}>
                      Bidders
                      {getSortIcon("unique_edition_bidders")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("total_sales_7d") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="total_sales_7d" onClick={() => handleSort("total_sales_7d")} style={{ minWidth: '82px', width: '82px' }}>
                      Sales 7d
                      {getSortIcon("total_sales_7d")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("total_sales_30d") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="total_sales_30d" onClick={() => handleSort("total_sales_30d")} style={{ minWidth: '82px', width: '82px' }}>
                      Sales 30d
                      {getSortIcon("total_sales_30d")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("total_sales_180d") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="total_sales_180d" onClick={() => handleSort("total_sales_180d")} style={{ minWidth: '82px', width: '82px' }}>
                      Sales 180d
                      {getSortIcon("total_sales_180d")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("days_since_last_sale") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="days_since_last_sale" onClick={() => handleSort("days_since_last_sale")} style={{ minWidth: '100px', width: '100px' }}>
                      Days No Sale
                      {getSortIcon("days_since_last_sale")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("sales_momentum_score") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="sales_momentum_score" onClick={() => handleSort("sales_momentum_score")} style={{ minWidth: '82px', width: '82px' }}>
                      Momentum
                      {getSortIcon("sales_momentum_score")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("price_trend") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="price_trend" onClick={() => handleSort("price_trend_30d_vs_180d")} style={{ minWidth: '100px', width: '100px' }}>
                      Price Trend
                      {getSortIcon("price_trend_30d_vs_180d")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("liquidity_score") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="liquidity_score" onClick={() => handleSort("liquidity_score")} style={{ minWidth: '72px', width: '72px' }}>
                      Liquidity
                      {getSortIcon("liquidity_score")}
                    </HeaderWithTooltip>
                  )}
                  {isColumnVisible("sell_through_rate") && (
                    <HeaderWithTooltip sortColumn={sortColumn} field="sell_through_rate" onClick={() => handleSort("sell_through_rate")} style={{ minWidth: '78px', width: '78px' }}>
                      Sell-Through
                      {getSortIcon("sell_through_rate")}
                    </HeaderWithTooltip>
                  )}
                </tr>
              </thead>
            <tbody>
              {expandedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.size} className="px-4 py-8 text-center text-brand-text/70">
                    <EmptyState icon={SearchX} title="No editions match your filters" description="Try adjusting your filters or search terms." />
                  </td>
                </tr>
              ) : (
                expandedFiltered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((m) => {
                  const raw = (m.tier || "").trim().toLowerCase();
                  let finalTier = "unknown";
                  if (!raw || raw === "none") finalTier = "unknown";
                  else if (raw.includes("/")) finalTier = "mixed";
                  else finalTier = raw;

                  const tierConfig = TIER_CONFIG[finalTier] || TIER_CONFIG.unknown;
                  const tierTextColor = tierConfig?.text || "text-brand-text";
                  const tierBorderClass = tierConfig?.border || "border-gray-500/40";
                  const tierLabel = TIER_LABEL_MAP[finalTier] || finalTier;

                  return (
                    <tr
                      key={`${m.setID}-${m.playID}${m.isSubedition ? `-${m.subeditionID}` : ''}`}
                      className={`border-b border-brand-border cursor-pointer hover:bg-white/[0.03] transition-colors ${
                        m.isSubedition ? 'bg-brand-primary/30' : ''
                      }`}
                      onClick={() => {
                        const path = m.isSubedition && m.subeditionID != null
                          ? `/analytics/topshot/edition/${m.setID}/${m.playID}/${m.subeditionID}`
                          : `/analytics/topshot/edition/${m.setID}/${m.playID}`;
                        navigate(path, { state: { edition: m } });
                      }}
                    >
                      {(isColumnVisible("artwork") || isColumnVisible("moment")) && (() => {
                        const supply = m.existing_supply ?? m.momentCount;
                        const listed = m.total_listings ?? 0;
                        const locked = m.locked_count ?? 0;
                        const held = m.held_count ?? 0;
                        const burned = m.burn_count ?? 0;
                        const hasSupply = supply != null && supply > 0;
                        const listedPct = hasSupply ? (listed / supply) * 100 : 0;
                        const lockedPct = hasSupply ? (locked / supply) * 100 : 0;
                        const heldPct = hasSupply ? (held / supply) * 100 : 0;
                        const burnedPct = m.mint_count && m.mint_count > 0 ? (burned / m.mint_count) * 100 : 0;
                        return (
                          <td className="px-1 py-1 sticky left-0 z-[5] bg-brand-primary" style={{ width: '255px', minWidth: '255px', maxWidth: '255px', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.3)' }}>
                            <MomentCellCompact
                              imageUrl={m.nft_id_serial1
                                ? `https://assets.nbatopshot.com/media/${m.nft_id_serial1}/image?format=webp&width=256&quality=90`
                                : `https://storage.googleapis.com/flowconnect/topshot/images_small/${m.setID}_${m.playID}.jpg`}
                              imageAlt={m.FullName || "Moment"}
                              imageScale={finalTier === "ultimate" || finalTier === "legendary" ? "scale-125" : "scale-150"}
                              onImageError={(e) => {
                                const t = e.target;
                                if (m.nft_id_recent && !t.dataset.triedRecent) {
                                  t.dataset.triedRecent = "1";
                                  t.src = `https://assets.nbatopshot.com/media/${m.nft_id_recent}/image?format=webp&width=256&quality=90`;
                                } else if (!t.dataset.triedGcs) {
                                  t.dataset.triedGcs = "1";
                                  t.src = `https://storage.googleapis.com/flowconnect/topshot/images_small/${m.setID}_${m.playID}.jpg`;
                                } else {
                                  t.style.display = "none";
                                }
                              }}
                              tierBorderClass={tierBorderClass}
                              width="w-full"
                              playerName={m.FullName || m.TeamAtMoment || m.teamAtMoment || m.team || m.Team || "Unknown Player"}
                              setName={m.name || `Set ${m.setID}`}
                              seriesText={getTopShotSeriesShort(m.series)}
                              tierLabel={tierLabel}
                              tierColor={tierTextColor}
                              serialInline={!(m.isSubedition && m.subeditionID != null) && (m.existing_supply || m.momentCount) ? `/ ${(m.existing_supply || m.momentCount).toLocaleString()}` : null}
                              metadataSlot={
                                (m.isSubedition && m.subeditionID != null) ? (
                                  <div className="flex items-center gap-1 text-[11px] text-brand-text/60 leading-tight truncate tabular-nums">
                                    <img
                                      src={getParallelIconUrl(m.subeditionID)}
                                      alt={SUBEDITIONS[m.subeditionID]?.name || `Parallel ${m.subeditionID}`}
                                      title={SUBEDITIONS[m.subeditionID]?.name || `Parallel ${m.subeditionID}`}
                                      className="w-3 h-3 object-contain flex-shrink-0"
                                    />
                                    {(m.existing_supply || m.momentCount) ? `/ ${(m.existing_supply || m.momentCount).toLocaleString()}` : ""}
                                  </div>
                                ) : null
                              }
                            />
                            {hasSupply && (
                              <Tooltip content={
                                <div className="text-[10px]">
                                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-yellow-400/80 inline-block" /> Listed: {listed.toLocaleString()}</div>
                                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-blue-400/70 inline-block" /> Locked: {locked.toLocaleString()}</div>
                                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400/70 inline-block" /> Held: {held.toLocaleString()}</div>
                                  {burned > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-400/70 inline-block" /> Burned: {burned.toLocaleString()}</div>}
                                  <div className="mt-0.5 text-brand-text/50">Supply: {supply.toLocaleString()}{m.mint_count && m.mint_count !== supply ? ` / ${m.mint_count.toLocaleString()} minted` : ""}</div>
                                </div>
                              }>
                                <div className="flex items-center gap-1.5 mt-1 w-full">
                                  <span className="text-[10px] text-brand-text/40 flex-shrink-0">{supply.toLocaleString()}</span>
                                  <div className="h-[5px] rounded-full overflow-hidden flex flex-1 bg-white/[0.06]">
                                    {listedPct > 0 && <div className="h-full bg-yellow-400/80" style={{ width: `${listedPct}%` }} />}
                                    {lockedPct > 0 && <div className="h-full bg-blue-400/70" style={{ width: `${lockedPct}%` }} />}
                                    {heldPct > 0 && <div className="h-full bg-emerald-400/70" style={{ width: `${heldPct}%` }} />}
                                    {burnedPct > 0 && <div className="h-full bg-red-400/70" style={{ width: `${burnedPct}%` }} />}
                                  </div>
                                </div>
                              </Tooltip>
                            )}
                          </td>
                        );
                      })()}
                      {isColumnVisible("onchain_ids") && (
                        <td className="px-2 py-1" style={{ minWidth: '110px', width: '110px' }}>
                          <div className="flex flex-col gap-0 text-[10px] font-mono text-brand-text/60 leading-tight">
                            <span>Set: {m.setID ?? "—"} / Play: {m.playID ?? "—"}</span>
                            {m.editionID && <span>Ed: {m.editionID}</span>}
                            {m.subeditionID != null && m.subeditionID !== 0 && <span>Sub: {m.subeditionID}</span>}
                            {m.JerseyNumber && <span>#{m.JerseyNumber}</span>}
                          </div>
                        </td>
                      )}
                      {isColumnVisible("floor_price") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.floor_price != null && m.floor_price > 0 ? `$${Number(m.floor_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("highest_edition_offer") && (
                        <td className="px-2 py-1" style={{ minWidth: '88px', width: '88px' }}>
                          <span className="text-xs text-brand-text">
                            {m.highest_edition_offer != null && m.highest_edition_offer > 0 ? `$${Number(m.highest_edition_offer).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("liquidity_spread_pct") && (
                        <td className="px-2 py-1" style={{ minWidth: '76px', width: '76px' }}>
                          <span className={`text-xs ${
                            m.liquidity_spread_pct != null && m.liquidity_spread_pct < 10 ? 'text-green-400' :
                            m.liquidity_spread_pct != null && m.liquidity_spread_pct <= 25 ? 'text-yellow-400' :
                            m.liquidity_spread_pct != null && m.liquidity_spread_pct > 25 ? 'text-red-400' :
                            'text-brand-text'
                          }`}>
                            {m.liquidity_spread_pct != null ? `${Number(m.liquidity_spread_pct).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("last_sale_price") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.last_sale_price != null && m.last_sale_price > 0 ? `$${Number(m.last_sale_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("estimated_value") && (
                        <td className="px-2 py-1" style={{ minWidth: '88px', width: '88px' }}>
                          <div className="flex flex-col">
                            <span className="text-xs text-brand-text">
                              {(() => {
                                if (m.estimated_value == null || m.estimated_value <= 0) return "—";
                                let estValue = m.estimated_value;
                                if (m.floor_price != null && m.floor_price > 0) {
                                  const maxEstValue = m.floor_price * 10;
                                  if (estValue > maxEstValue) {
                                    estValue = maxEstValue;
                                  }
                                }
                                return `$${Number(estValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })()}
                            </span>
                          </div>
                        </td>
                      )}
                      {isColumnVisible("ask_ev_ratio") && (
                        <td className="px-2 py-1" style={{ minWidth: '68px', width: '68px' }}>
                          {(() => {
                            const fp = m.floor_price, ev = m.estimated_value;
                            if (!fp || !ev || fp <= 0 || ev <= 0) return <span className="text-xs text-brand-text/30">—</span>;
                            const ratio = fp / ev;
                            const color = ratio <= 0.9 ? "text-green-400" : ratio <= 1.1 ? "text-yellow-400" : "text-red-400";
                            return <span className={`text-xs font-medium ${color}`}>{ratio.toFixed(2)}x</span>;
                          })()}
                        </td>
                      )}
                      {isColumnVisible("asp_180d") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.asp_180d != null && m.asp_180d > 0 ? `$${Number(m.asp_180d).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("market_cap") && (
                        <td className="px-2 py-1" style={{ minWidth: '90px', width: '90px' }}>
                          <span className="text-xs text-brand-text">
                            {m.market_cap != null && m.market_cap > 0 ? `$${Number(m.market_cap).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("existing_supply") && (
                        <td className="px-2 py-1 text-xs text-brand-text" style={{ minWidth: '72px', width: '72px' }}>
                          {m.existing_supply != null ? m.existing_supply.toLocaleString() : "—"}
                        </td>
                      )}
                      {isColumnVisible("total_listings") && (
                        <td className="px-2 py-1 text-xs text-brand-text" style={{ minWidth: '68px', width: '68px' }}>
                          {m.total_listings != null ? m.total_listings.toLocaleString() : "—"}
                        </td>
                      )}
                      {isColumnVisible("locked_count") && (
                        <td className="px-2 py-1 text-xs text-brand-text" style={{ minWidth: '68px', width: '68px' }}>
                          {m.locked_count != null ? m.locked_count.toLocaleString() : "—"}
                        </td>
                      )}
                      {isColumnVisible("held_count") && (
                        <td className="px-2 py-1 text-xs text-brand-text" style={{ minWidth: '68px', width: '68px' }}>
                          {m.held_count != null ? m.held_count.toLocaleString() : "—"}
                        </td>
                      )}
                      {isColumnVisible("burn_count") && (
                        <td className="px-2 py-1 text-xs text-brand-text" style={{ minWidth: '68px', width: '68px' }}>
                          {m.burn_count != null && m.burn_count > 0 ? m.burn_count.toLocaleString() : "—"}
                        </td>
                      )}
                      {isColumnVisible("floating_supply_pct") && (
                        <td className="px-2 py-1" style={{ minWidth: '76px', width: '76px' }}>
                          <span className="text-xs text-brand-text">
                            {m.floating_supply_pct != null ? `${Number(m.floating_supply_pct).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("listings_at_floor") && (
                        <td className="px-2 py-1" style={{ minWidth: '78px', width: '78px' }}>
                          <span className="text-xs text-brand-text">
                            {m.listings_at_floor != null ? m.listings_at_floor.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("total_edition_offer_volume") && (
                        <td className="px-2 py-1" style={{ minWidth: '100px', width: '100px' }}>
                          <div className="flex flex-col gap-0">
                            <span className="text-xs text-brand-text">
                              {m.total_edition_offer_volume != null && m.total_edition_offer_volume > 0 ? `$${Number(m.total_edition_offer_volume).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                            </span>
                            {m.edition_offer_count != null && m.edition_offer_count > 0 && (
                              <span className="text-[10px] text-brand-text/60 leading-tight">
                                {m.edition_offer_count.toLocaleString()} offers · Avg: ${m.avg_edition_offer != null && m.avg_edition_offer > 0 ? Number(m.avg_edition_offer).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {isColumnVisible("unique_edition_bidders") && (
                        <td className="px-2 py-1" style={{ minWidth: '76px', width: '76px' }}>
                          <span className="text-xs text-brand-text">
                            {m.unique_edition_bidders != null && m.unique_edition_bidders > 0 ? `${m.unique_edition_bidders.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("total_sales_7d") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.total_sales_7d != null ? m.total_sales_7d.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("total_sales_30d") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.total_sales_30d != null ? m.total_sales_30d.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("total_sales_180d") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className="text-xs text-brand-text">
                            {m.total_sales_180d != null ? m.total_sales_180d.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("days_since_last_sale") && (
                        <td className="px-2 py-1" style={{ minWidth: '100px', width: '100px' }}>
                          <span className="text-xs text-brand-text">
                            {(() => {
                              if (m.days_since_last_sale == null) return "—";
                              const days = m.days_since_last_sale;
                              if (days >= 365) {
                                const years = Math.floor(days / 365);
                                const remainingDays = days % 365;
                                if (remainingDays === 0) {
                                  return `${years}${years === 1 ? ' year' : ' years'}`;
                                }
                                return `${years}${years === 1 ? ' year' : ' years'}, ${remainingDays}${remainingDays === 1 ? ' day' : ' days'}`;
                              } else if (days >= 30) {
                                const months = Math.floor(days / 30);
                                const remainingDays = days % 30;
                                if (remainingDays === 0) {
                                  return `${months}${months === 1 ? ' month' : ' months'}`;
                                }
                                return `${months}${months === 1 ? ' month' : ' months'}, ${remainingDays}${remainingDays === 1 ? ' day' : ' days'}`;
                              }
                              return `${days}${days === 1 ? ' day' : ' days'}`;
                            })()}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("sales_momentum_score") && (
                        <td className="px-2 py-1" style={{ minWidth: '82px', width: '82px' }}>
                          <span className={`text-xs ${
                            m.sales_momentum_score != null && m.sales_momentum_score > 0 ? 'text-green-400' :
                            m.sales_momentum_score != null && m.sales_momentum_score < 0 ? 'text-red-400' :
                            'text-brand-text'
                          }`}>
                            {m.sales_momentum_score != null ? m.sales_momentum_score.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("price_trend") && (
                        <td className="px-2 py-1" style={{ minWidth: '100px', width: '100px' }}>
                          <div className="flex flex-col gap-0">
                            <span className={`text-xs leading-tight ${
                              m.price_trend_7d_vs_30d != null && m.price_trend_7d_vs_30d > 0 ? 'text-green-400' :
                              m.price_trend_7d_vs_30d != null && m.price_trend_7d_vs_30d < 0 ? 'text-red-400' :
                              'text-brand-text/50'
                            }`}>
                              7d: {m.price_trend_7d_vs_30d != null ? `${m.price_trend_7d_vs_30d > 0 ? '+' : ''}${Number(m.price_trend_7d_vs_30d).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"}
                            </span>
                            <span className={`text-xs leading-tight ${
                              m.price_trend_30d_vs_180d != null && m.price_trend_30d_vs_180d > 0 ? 'text-green-400' :
                              m.price_trend_30d_vs_180d != null && m.price_trend_30d_vs_180d < 0 ? 'text-red-400' :
                              'text-brand-text/50'
                            }`}>
                              30d: {m.price_trend_30d_vs_180d != null ? `${m.price_trend_30d_vs_180d > 0 ? '+' : ''}${Number(m.price_trend_30d_vs_180d).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"}
                            </span>
                          </div>
                        </td>
                      )}
                      {isColumnVisible("liquidity_score") && (
                        <td className="px-2 py-1" style={{ minWidth: '72px', width: '72px' }}>
                          <span className="text-xs text-brand-text">
                            {m.liquidity_score != null ? m.liquidity_score.toLocaleString() : "—"}
                          </span>
                        </td>
                      )}
                      {isColumnVisible("sell_through_rate") && (
                        <td className="px-2 py-1" style={{ minWidth: '78px', width: '78px' }}>
                          <span className="text-xs text-brand-text">
                            {m.sell_through_rate != null ? `${Number(m.sell_through_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          {/* Pagination controls */}
          {expandedFiltered.length > 0 && (() => {
            const totalPages = Math.ceil(expandedFiltered.length / rowsPerPage);
            const startRow = (currentPage - 1) * rowsPerPage + 1;
            const endRow = Math.min(currentPage * rowsPerPage, expandedFiltered.length);

            return (
              <div className="flex items-center justify-between mt-4 pb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2 text-xs text-brand-text/70">
                  <span>Showing {startRow}–{endRow} of {expandedFiltered.length.toLocaleString()}</span>
                  <span className="text-brand-text/40">|</span>
                  <label className="flex items-center gap-1">
                    Rows:
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-brand-secondary text-brand-text border border-brand-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-opolis"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 text-xs rounded transition-all ${
                      currentPage === 1
                        ? "bg-brand-secondary/50 text-brand-text/30 cursor-not-allowed"
                        : "bg-brand-secondary text-brand-text/70 hover:text-brand-text"
                    }`}
                  >
                    Prev
                  </button>
                  <span className="text-xs text-brand-text/70">
                    Page {currentPage} of {totalPages.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 text-xs rounded transition-all ${
                      currentPage === totalPages
                        ? "bg-brand-secondary/50 text-brand-text/30 cursor-not-allowed"
                        : "bg-brand-secondary text-brand-text/70 hover:text-brand-text"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
    </div>
  );
}
