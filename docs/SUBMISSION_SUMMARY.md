# Vaultopolis — PL Genesis Submission

## Tracks

- **Flow: The Future of Finance** (sponsor bounty — Consumer DeFi)
- **Crypto** (track prize — novel economic systems)
- **Existing Code** (category — live system with major new work)
- **Community Vote** (bonus — tweet engagement)

## Elevator Pitch

Vaultopolis is the Bloomberg Terminal for digital collectibles on Flow — real-time analytics across 21,000+ editions, 80+ metrics per edition, and a browser extension that overlays market intelligence directly onto marketplace pages. Built for collectors, powered by 611 million indexed blockchain events.

## Summary (for submission form)

### What It Is

Vaultopolis is a production analytics platform on Flow that gives collectors something the ecosystem has never had: comprehensive, unified market intelligence across all major collections.

**The Problem**: Flow hosts some of the largest digital collectibles communities in the world — NBA Top Shot, NFL All Day, Disney Pinnacle — with millions of users. But market data is fragmented across Dapper Marketplace, Flowty, OpenSea, and peer-to-peer channels. Collectors can't answer basic questions: What's my portfolio worth? Which editions are undervalued? Where is the market moving? There's no unified analytics layer for Flow's collectibles economy.

**Our Solution**:

**1. Analytics Engine** — We continuously index the Flow blockchain, capturing every sale, transfer, mint, and burn. Our pipeline has processed 611 million+ events and delivers 80+ metrics per edition: floor price, median listing, average sale price across multiple timeframes (7d/30d/180d/lifetime), supply breakdowns (minted/burned/locked/held/listed), liquidity scores, deal detection, sales momentum, market freshness, estimated value, and ask/EV ratios. All refreshed every 6 hours across 21,400+ editions spanning three major collections.

**2. Portfolio Intelligence** — Collectors connect their Flow wallet and instantly see their entire portfolio valuation across all collections. We optimized this from 267 individual Cadence queries down to a single server call — portfolios with hundreds of moments load in seconds, not minutes.

**3. Browser Extension** — A Chrome extension that detects collectible cards on marketplace pages (NBA Top Shot, NFL All Day, Disney Pinnacle) and overlays real-time analytics via hover tooltips — floor price, supply, volume, tier. Market intelligence meets collectors where they already shop, without leaving the page.

**What makes this Consumer Finance**: No jargon, no complex interfaces. Collectors connect their wallet and get institutional-grade market data presented in a way anyone can understand — color-coded buy/sell signals, visual supply bars, trend charts. We brought Bloomberg Terminal depth to a consumer product.

## Key Metrics

| Metric | Value |
|--------|-------|
| Blockchain events processed | 611,000,000+ |
| Edition coverage | 21,400+ across 3 collections |
| Metrics per edition | 80+ |
| Running continuously since | April 2025 |
| Weekly marketplace events tracked | 9,100+ |
| Collections | NBA Top Shot (13,800+), NFL All Day (5,800+), Disney Pinnacle (1,800+) |
| Portfolio query optimization | 267 calls reduced to 1 |

## Development During Hacking Period (Feb 10 - Mar 31, 2026)

### Analytics Revamp (Major)
- **Multi-collection expansion**: Added NFL All Day (5,800+ editions) and Disney Pinnacle (1,800+ editions) with full analytics parity to Top Shot
- **80+ metrics per edition**: Floor, median listing, ASP (7d/30d/180d/lifetime), supply breakdowns (mint/burn/existing/locked/held), liquidity scores, sales momentum, market freshness, estimated value, ask/EV ratio, value confidence
- **Player/Character Rankings**: Cross-platform rankings sortable by market cap, floor, sales count with team filtering and pagination
- **Edition Detail Pages**: Supply bar visualization, stat cards with buy/sell signals, price history charts, sales volume trends, offer analytics
- **Market Overview**: Cross-collection snapshot with top movers, most valuable editions, area charts with time range selectors
- **Real-time event feeds**: Live sales, mints, transfers, and burns across all three collections with serial number tracking and type filtering

### Portfolio Optimization
- **267 Cadence calls reduced to 1**: Server-side portfolio summary replaces gas-limit-breaking batch queries
- **Progressive rendering**: Overview tab loads instantly, detailed data fills in asynchronously
- **Public portfolio sharing**: View any wallet's portfolio by address without connecting a wallet
- **Cross-collection valuations**: Top Shot + All Day + Pinnacle in a single unified view

### Browser Extension (New Product)
- Chrome Manifest V3 extension detecting collectible cards on marketplace pages
- Hover tooltips with floor price, supply, volume, tier data via Shadow DOM
- Supports all 3 collections (Top Shot, All Day, Pinnacle)
- Security hardened: Shadow DOM isolation, HTML escaping, no tracking, no remote code execution
- 4-tier intelligent caching (2min for sales data, 15min for market data, 1h for metadata, 24h for mappings)

### Infrastructure & Quality
- EVM bridge support for Flow-to-EVM bridged assets (OpenSea integration)
- Stale-while-revalidate caching across all API layers
- Playwright end-to-end test suite with visual regression testing
- Sentry error tracking for production monitoring

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Recharts, Framer Motion |
| Wallet | Flow Client Library (FCL) |
| API | Express.js (Heroku) |
| Database | PostgreSQL 16 + TimescaleDB (Hetzner EX44) |
| Indexer | Custom Node.js Flow event listener (systemd) |
| Extension | Chrome Manifest V3, esbuild, Shadow DOM |
| Testing | Playwright E2E, React Testing Library |
| Monitoring | Sentry |
| Backups | Automated borgmatic to Hetzner Storage Box |

## Architecture

```
Flow Blockchain
    |
    v
[Flow Event Listener]  -->  PostgreSQL + TimescaleDB
(continuous indexer)         611M+ events stored
(systemd service)            |
                             v
                    [Refresh Service]
                    (rebuilds 80+ metrics every 6h, ~50min/cycle)
                             |
                             v
                    [Flow API] (EX44, port 5200)
                             |
              +--------------+--------------+
              |                             |
              v                             v
    [Express Backend]              [Browser Extension]
    (Heroku proxy)                 (Chrome MV3)
              |                             |
              v                             v
    [React Frontend]               [Marketplace Pages]
    (vaultopolis.com)              (nbatopshot.com, etc.)
```

## Links

- **Live App**: https://vaultopolis.com
- **API**: https://api.vaultopolis.com
- **GitHub**: https://github.com/LibruaryNFT/vaultopolis

## Why This Fits "The Future of Finance"

Flow's challenge asks for Consumer DeFi that's accessible to everyday people. Vaultopolis delivers:

1. **Consumer-first design** — No jargon, color-coded signals, visual supply bars. Finance tools that anyone can use
2. **Real production scale** — 611M events, 21K+ editions, running continuously for a year. Not a prototype
3. **Meets users where they are** — Browser extension brings analytics directly to marketplace pages without leaving the shopping experience
4. **Institutional-grade analytics** — 80+ metrics per edition rivaling what traditional finance has for equities
5. **Flow-native** — Every component uses Flow infrastructure: Cadence, FCL, Flow events. Built for Flow, by Flow builders

## Judging Criteria Alignment

| Criteria | Evidence |
|----------|----------|
| **Technical Execution** | 611M events indexed, 80+ metrics engine, custom TimescaleDB pipeline, Chrome MV3 extension with Shadow DOM isolation |
| **Impact/Usefulness** | Only multi-collection analytics platform on Flow, used by real collectors daily |
| **Completeness/Functionality** | Live production app since April 2025, browser extension feature-complete |
| **Scalability/Future Potential** | Architecture handles billions of events, extensible to any Flow collection, extension model works for any marketplace |
