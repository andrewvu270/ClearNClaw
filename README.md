# Clear & Claw

Task management for brains that don't do boring.

Clear & Claw is a gamified task manager built for people with ADHD. Drop in a big task, an AI agent breaks it into small actionable steps, and you earn coins for completing them. Spend coins on a claw machine mini-game to collect toys. It's dopamine-driven productivity with a retro arcade vibe.

## Features

- **AI Task Breakdown** — Type or speak a big task, a DigitalOcean AI agent splits it into manageable sub-tasks with a representative emoji
- **Visual Progress** — Each task gets a circular progress ring around its emoji that fills as you check off sub-tasks
- **Coin Rewards** — Complete all sub-tasks of a big task to earn a coin
- **Claw Machine** — Spend coins to play an interactive claw machine and win collectible pixel toys
- **Toy Collection** — Profile page shows your stats (tasks done, coins) and a gallery of all collected toys with rarity indicators
- **Voice Input** — Use the mic button to dictate tasks via Web Speech API
- **Active/Done Tabs** — Filter between in-progress and completed tasks
- **Editable Tasks** — Rename, delete, or add sub-tasks on the fly
- **Magic Link Auth** — Passwordless email sign-in via Supabase
- **Mobile Responsive** — Designed mobile-first, works from 320px to 1440px+
- **Interactive Backgrounds** — GSAP-powered dot grid with inertia physics, Three.js floating shapes, and aurora effects

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, React Router v6 |
| Styling | Tailwind CSS, custom pixel font, neon/cyberpunk theme |
| Animation | Framer Motion, GSAP (InertiaPlugin, SplitText, ScrollTrigger) |
| 3D | Three.js via React Three Fiber + Drei |
| Backend | Supabase (Auth, PostgreSQL, Row Level Security, RPC) |
| Storage | Cloudflare R2 (toy sprite assets) |
| AI | DigitalOcean AI Agent |
| Testing | Vitest, fast-check (property-based testing) |
| Build | Vite |
