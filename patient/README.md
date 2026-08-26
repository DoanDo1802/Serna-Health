# Wolverine Worldwide - Next.js Enterprise Architecture

A high-performance, modular Next.js (App Router, TypeScript, TailwindCSS, Zustand, Zod) project replicating the official [Wolverine Worldwide](https://wolverineworldwide.com/) homepage.

---

## 📁 Project Structure

```
.
├── .husky/                 # Pre-commit hooks for type checking & linting
│   └── pre-commit
├── public/                 # Static assets (fonts, sprite.svg, robots.txt, favicon)
│   ├── fonts/              # ABCDiatype custom fonts
│   ├── sprite.svg          # Vector SVG symbols
│   └── robots.txt
├── src/
│   ├── assets/             # Static build assets
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx      # Root layout with metadata & providers
│   │   ├── page.tsx        # Homepage composition
│   │   └── globals.css     # Global styling & Tailwind directives
│   ├── components/
│   │   ├── base/           # Atomic reusable UI components (BaseButton, BaseIcon, BaseCard, BaseBadge, BaseImage)
│   │   └── features/       # Business feature components
│   │       ├── header/     # Sticky navigation, mega dropdown, mobile drawer
│   │       ├── hero/       # Hero video background & typography
│   │       ├── brand-story/# Brand story & mission
│   │       ├── brand-galaxy/# Interactive particle physics brand showcase
│   │       ├── annual-report/# 2025 Annual report card
│   │       ├── culture-stats/# Employee culture metrics
│   │       ├── market-snapshot/# NYSE WWW ticker widget
│   │       ├── news-carousel/# Interactive news slider
│   │       ├── career-push/# Careers CTA banner
│   │       └── footer/     # Footer & brand directory
│   ├── lib/                # Library setups (Axios client, cn utility)
│   ├── hooks/              # Custom React hooks (useMediaQuery, useScrollPosition)
│   ├── store/              # Zustand global stores (useAppStore, useMarketStore)
│   ├── types/              # TypeScript definitions (navigation, brand, news, market)
│   ├── index.css           # Global entry CSS
│   ├── providers/          # React context providers (AppProvider)
│   ├── schemas/            # Zod validation schemas
│   ├── services/           # API services (marketService)
│   ├── utils/              # Helper utilities (formatters, dom)
│   └── constants/          # Constants (navigation, brands, news, stats, theme)
├── eslint.config.mjs       # Strict ESLint configuration
├── .prettierrc             # Prettier code formatting standards
├── tailwind.config.ts      # Tailwind configuration with custom theme
├── tsconfig.json           # Strict TypeScript configuration
├── package.json            # Scripts & dependencies
├── Dockerfile              # Multi-stage production Docker build
├── .dockerignore
├── docker-compose.yml      # Docker Compose setup
├── sentry.client.config.ts # Sentry monitoring client config
├── sentry.server.config.ts # Sentry monitoring server config
├── .gitignore
└── .env                    # Environment variables
```

---

## 🚀 Getting Started

### 1. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Type Check
```bash
npm run type-check
```

### 3. Production Build & Start
```bash
npm run build
npm run start
```

### 4. Docker Deployment
```bash
docker compose up --build -d
```
