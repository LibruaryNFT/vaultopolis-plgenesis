# Vaultopolis — PL Genesis: Frontiers of Collaboration

> The Bloomberg Terminal for digital collectibles on Flow

**Live App:** [vaultopolis.com](https://vaultopolis.com)
**Tracks:** Flow: The Future of Finance | Crypto | Existing Code

---

## What It Is

Vaultopolis is a production analytics platform on Flow that gives collectors something the ecosystem has never had: comprehensive, unified market intelligence across all major collections.

Flow hosts some of the largest digital collectibles communities in the world — NBA Top Shot, NFL All Day, Disney Pinnacle — with millions of users. But market data is fragmented across Dapper Marketplace, Flowty, OpenSea, and peer-to-peer channels. Collectors can't answer basic questions: What's my portfolio worth? Which editions are undervalued? Where is the market moving?

Vaultopolis is the unified analytics layer for Flow's collectibles economy.

## Three Products, One Platform

### 1. Analytics Engine

We continuously index the Flow blockchain, capturing every sale, transfer, mint, and burn. Our pipeline has processed **611 million+ events** and delivers **80+ metrics per edition**:

- Floor price, median listing, average sale price across multiple timeframes (7d/30d/180d/lifetime)
- Supply breakdowns (minted/burned/locked/held/listed)
- Liquidity scores, deal detection, sales momentum, market freshness
- Estimated value and ask/EV ratios with color-coded buy/sell signals
- All refreshed every 6 hours across **21,400+ editions** spanning three major collections

### 2. Portfolio Intelligence

Collectors connect their Flow wallet and instantly see their entire portfolio valuation across all collections. We optimized portfolio loading from **267 individual Cadence queries down to a single server call** — portfolios with hundreds of moments load in seconds, not minutes.

- Cross-collection valuations (Top Shot + All Day + Pinnacle in one view)
- Progressive rendering (overview loads instantly, details fill in)
- Public portfolio sharing (view any wallet by address, no wallet connection required)

### 3. Browser Extension

A Chrome extension that detects collectible cards on marketplace pages and overlays real-time analytics via hover tooltips — floor price, supply, volume, tier. Market intelligence meets collectors where they already shop.

- Supports all 3 collections (Top Shot, All Day, Pinnacle)
- Shadow DOM isolation for security
- 4-tier intelligent caching (2min to 24h depending on data freshness needs)
- No tracking, no remote code execution, Manifest V3 compliant

## Key Metrics

| Metric | Value |
|--------|-------|
| Blockchain events processed | 611,000,000+ |
| Edition coverage | 21,400+ across 3 collections |
| Metrics per edition | 80+ |
| Running continuously since | April 2025 |
| Weekly marketplace events tracked | 9,100+ |
| Portfolio query optimization | 267 Cadence calls → 1 server call |

## Architecture

```
Flow Blockchain
    │
    ▼
┌─────────────────────┐
│ Flow Event Listener  │──▶  PostgreSQL + TimescaleDB
│ (continuous indexer) │     611M+ events stored
│ (systemd service)    │          │
└─────────────────────┘          ▼
                        ┌─────────────────┐
                        │ Refresh Service  │
                        │ (80+ metrics     │
                        │  every 6h)       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Flow API      │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │                         │
                    ▼                         ▼
           ┌──────────────┐          ┌──────────────┐
           │ React App    │          │ Browser Ext.  │
           │ vaultopolis  │          │ Chrome MV3    │
           │ .com         │          │               │
           └──────────────┘          └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Recharts, Framer Motion |
| Wallet | Flow Client Library (FCL) |
| API | Express.js |
| Database | PostgreSQL 16 + TimescaleDB |
| Indexer | Custom Node.js Flow event listener |
| Extension | Chrome Manifest V3, esbuild, Shadow DOM |
| Testing | Playwright E2E, React Testing Library |
| Monitoring | Sentry |

## Development During Hacking Period (Feb 10 – Mar 31, 2026)

### Analytics Revamp
- Multi-collection expansion: Added NFL All Day and Disney Pinnacle with full analytics parity
- 80+ metrics per edition with buy/sell signals and value confidence scores
- Cross-platform player/character rankings with sorting, filtering, pagination
- Edition detail pages with supply visualization, price charts, offer analytics
- Market overview with top movers, trend charts, time range selectors
- Real-time event feeds across all three collections

### Portfolio Optimization
- Server-side summary replacing 267 Cadence calls with 1 query
- Progressive rendering for large portfolios
- Public portfolio sharing by wallet address

### Browser Extension
- Built from scratch during hacking period
- Marketplace overlay for Top Shot, All Day, Pinnacle
- Security-first: Shadow DOM, HTML escaping, no tracking

### Infrastructure
- EVM bridge support (OpenSea integration)
- Stale-while-revalidate caching
- Playwright E2E test suite
- Sentry error tracking

## Why This Fits "The Future of Finance"

1. **Consumer-first design** — No jargon, color-coded signals, visual supply bars. Finance tools anyone can use
2. **Real production scale** — 611M events, 21K+ editions, running continuously for a year
3. **Meets users where they are** — Browser extension brings analytics to marketplace pages
4. **Institutional-grade analytics** — 80+ metrics per edition rivaling traditional finance
5. **Flow-native** — Cadence, FCL, Flow events. Built for Flow, by Flow builders

## Code Highlights

Selected components demonstrating the analytics architecture are included in the [`code-highlights/`](code-highlights/) directory:

- `EditionAnalytics.jsx` — 80+ metric edition analytics table with sorting, filtering, and supply visualization
- `MarketOverview.jsx` — Cross-collection market snapshot with trend charts
- `Rankings.jsx` — Player/character rankings with cross-platform aggregation
- `extension-tooltip.js` — Browser extension tooltip renderer with Shadow DOM isolation

## Links

- **Live App**: [vaultopolis.com](https://vaultopolis.com)
- **API**: [api.vaultopolis.com](https://api.vaultopolis.com)

## Team

Built by the Vaultopolis team for the Flow ecosystem.

## License

Proprietary. Selected code samples included for hackathon evaluation purposes.
