# Hit Flow — Claude Code Context

## What this app is
Hit Flow is a high-intensity training (HIT) tracker and supplement logger. Users log workout sessions (exercise, weight, time-under-load) and track daily supplement intake. It's a personal fitness tool deployed at **https://hitflow.xyz**.

## Tech stack
- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** Vite 5, `tsc -b && vite build`
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Routing:** React Router v7
- **Charts:** Recharts
- **Deployment:** Netlify (auto-deploy from `main` branch)

## Commands
```bash
npm run dev       # local dev server (http://localhost:5173)
npm run build     # type-check + production build (what Netlify runs)
npm run lint      # ESLint
npm run preview   # preview production build locally
```

## Project structure
```
src/
  App.tsx                  # Root — routing, auth state, top-level layout
  main.tsx                 # Entry point
  index.css                # Global styles + Tailwind directives

  components/
    Auth.tsx               # Login page — uses @supabase/auth-ui-react with Google OAuth
    ExerciseTable.tsx      # Main workout tracker UI
    SessionTable.tsx       # Past sessions table per exercise
    SessionsGraph.tsx      # Per-exercise progress chart (Recharts)
    AllSessionsGraph.tsx   # Cross-exercise chart
    Timer.tsx              # Time-under-load timer during sets
    WeightInput.tsx        # Weight entry with lb/kg toggle
    SupplementTracker.tsx  # Full supplement management UI (large component)
    PhotoCaptureModal.tsx  # Camera capture for supplement label scanning
    ExtractionPreviewModal.tsx  # Preview AI-extracted supplement info
    ExtractionTracker.tsx  # Tracks Moondream API extraction jobs
    DemoTable.tsx          # Unauthenticated demo/preview
    ProfilePage.tsx        # User profile, weight unit preference, account deletion
    CompletionModal.tsx    # Post-session summary modal
    ConfirmationModal.tsx  # Generic confirm/cancel dialog
    InfoModal.tsx          # HIT methodology info
    SupplementInfoModal.tsx # Supplement detail modal
    ExerciseSelect.tsx     # Exercise picker dropdown
    TimeSettings.tsx       # Time-under-load settings
    PrivacyPolicy.tsx      # /privacy route
    Terms.tsx              # /terms route

  lib/
    supabase.ts            # Supabase client (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
    database.ts            # All exercise/session DB queries
    supplements.ts         # All supplement DB queries
    moondream.ts           # Moondream vision API — extracts supplement info from label photos
    analytics.ts           # Umami analytics helpers
    errorHandling.ts       # Shared error utilities

  types/
    Exercise.ts            # Exercise, Session types + DEFAULT_EXERCISES list
    Supplement.ts          # Supplement, UserSupplement, SupplementUsage, DsldProduct types

  contexts/
    WeightUnitContext.tsx  # Global lb/kg preference (persisted to Supabase profile)
```

## Supabase project
- **Project ref:** `qaujynofythxbnhnczda`
- **Region:** us-east-2
- **URL:** `https://qaujynofythxbnhnczda.supabase.co`

### Database tables
| Schema | Table | Purpose |
|--------|-------|---------|
| public | `exercises` | User's exercise list (name, user_id) |
| public | `sessions` | Workout logs (exercise_id, weight, time_under_load, timestamp) |
| public | `supplements` | Global supplement catalog (name, brand, dosage, imageUrl, thumbnailUrl) |
| public | `user_supplements` | User's personal supplement list (user_id, supplement_id, custom_dosage) |
| public | `supplement_usages` | Daily intake log (user_supplement_id, timestamp, dosage_mg) |
| public | `user_exercises` | (reserved, currently unpopulated) |
| storage | `supplement-thumbnails` | AI-extracted label thumbnails (public bucket) |

### Storage
Bucket `supplement-thumbnails` is **public**. Files are stored at the bucket root (no subdirectory), e.g. `supplement-thumbnails/1754947383028-supplement-label.jpg`.

## Environment variables
Stored in `.env` (gitignored). Set in Netlify dashboard for production.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://qaujynofythxbnhnczda.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for Supabase client |
| `VITE_NEYNAR_API_KEY` | Farcaster/Neynar integration |
| `VITE_APP_URL` | `https://hitflow.xyz` |
| `VITE_MOONDREAM_API_URL` | `https://api.moondream.ai/v1` |
| `VITE_MOONDREAM_API_KEY` | Moondream vision API key |
| `DSLD_API_KEY` | DSLD (Dietary Supplement Label Database) API key |

## Auth
- Google OAuth via Supabase Auth UI (`@supabase/auth-ui-react`)
- No `redirectTo` prop — relies on Supabase `site_url` setting (`https://hitflow.xyz`)
- Auth state managed in `App.tsx` via `supabase.auth.onAuthStateChange`

## External APIs
- **Moondream** — vision model, scans supplement label photos to extract name/brand/dosage
- **DSLD** — NIH Dietary Supplement Label Database, used for supplement autocomplete search
- **Umami** — privacy-friendly analytics

## TypeScript config notes
`tsconfig.json` has `noUnusedLocals: true` and `noUnusedParameters: true` (strict). Unused catch params must be prefixed with `_` (e.g. `.catch(_err => {})`). Use `ReturnType<typeof setTimeout>` / `ReturnType<typeof setInterval>` instead of `NodeJS.Timeout` — this is a browser app with no `@types/node`.

## Deployment
- Netlify auto-deploys on push to `main`
- Build command: `npm run build`
- Publish directory: `dist`
- No `netlify.toml` — configured via Netlify dashboard

## Known patterns
- All Supabase queries go through `src/lib/database.ts` (exercises) or `src/lib/supplements.ts` (supplements) — keep business logic out of components
- `WeightUnitContext` provides global `unit` (`'lbs' | 'kg'`) and `convertWeight()` — use this for all weight display
- Default exercises are seeded on first login via `initializeDefaultExercises()` in `database.ts`
- `SupplementTracker.tsx` is the largest component — if it grows further, consider splitting into sub-components
