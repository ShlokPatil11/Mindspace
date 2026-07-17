# MindSpace Frontend Redesign: Minimal Liquid-Glass UI

## Overview

Replace the current dual-theme glassmorphism frontend with a fixed, minimal
aesthetic matching a set of Figma mockups: a splash-screen auth page over a
painted-texture background, and a two-pane main app (dark sidebar + light
chat panel) where document upload happens through the chat input itself
instead of a dedicated documents panel. A subset of UI elements use a real
"liquid glass" refraction effect (SVG `feDisplacementMap`-based), not just a
CSS blur.

This is a frontend-only visual and interaction rework. No backend, API, or
data-model changes.

## Goals

- Match the provided Figma mockups: painted-texture splash/auth background,
  wide-letter-spaced "MINDSPACE" wordmark, dark sidebar + light content pane,
  a floating glass input bar with an attachment icon.
- Implement genuine liquid-glass refraction (not a fake/blur-only version) on
  a scoped set of small elements, with automatic graceful fallback on
  non-Chromium browsers.
- Collapse the app down to two logical pages: an auth page, and the main
  app (sidebar + space content).
- Remove the dedicated documents panel; folding upload into the chat input.
- Reuse all existing data/state logic (auth, spaces, documents, Q&A) as-is —
  this is a view-layer rework, not a re-architecture.

## Non-Goals

- No backend/API changes.
- No mobile-specific responsive redesign (out of scope unless raised later).
- No new npm dependencies — the liquid-glass effect is vanilla SVG/canvas/CSS.
- No dark/light theme toggle — this redesign replaces it with one fixed look.

## Asset Dependency

The exact painted-texture background image (and any other Figma-exported
assets) will be provided by the user as a file, to be placed at
`frontend/src/assets/auth-background.png` (or similar) before/during
implementation. If unavailable at implementation time, fall back to a
CSS-gradient/noise approximation of the same dark-to-light painted-edge look
as a placeholder, swappable later without code changes beyond the image path.

## Pages & Routes

Two route groups:

1. **`/login`** (and unauthenticated catch-all) → `AuthPage`. Handles both
   login and signup via a local toggle (not separate routes), so the splash
   only plays once per page load regardless of which form the user ends up
   on.
2. **`/spaces`** and **`/spaces/:spaceId`** → existing `AppShell` (restyled)
   wrapping either an empty-state or `SpaceDetailPage` (restructured).

## AuthPage

- Full-bleed, fixed background image covering the viewport.
- **Splash phase** (on mount, once per page load): centered "MINDSPACE"
  wordmark (wide letter-spacing, light gray, uppercase, light font weight)
  with a thin animated progress bar beneath it. Fixed duration (~1.5-2s),
  then fades out.
- **Form phase**: after the splash fades, a minimal centered form card fades
  in over the same background. Contains email/password fields, a submit
  button, and a small text toggle ("Don't have an account? Sign up" / "Have
  an account? Log in") that swaps which fields render — no route change, no
  modal.
- Existing `AuthContext.login` / `AuthContext.signup` calls are reused
  unchanged; only the JSX/CSS wrapper changes.
- Errors (invalid credentials, email already registered, etc.) render as a
  small inline message below the form — same mechanism as today
  (`useState<string | null>` + conditional render), restyled.

## Main App Page — Sidebar (`AppShell`)

- Solid, opaque dark background (no glass effect — full-height panels exceed
  the practical size limit for real refraction, and the mockup shows a solid
  panel anyway).
- "MINDSPACE" wordmark at top, smaller than the splash version, same font
  treatment.
- Space list: plain rows (name + subtle divider between rows, matching the
  mockup's "TITLE 1 / TITLE 2" list), active space highlighted. Delete
  affordance appears on hover, reusing existing `deleteSpace` call.
- "+ New Space" opens the existing create-space modal, rebuilt as a
  `LiquidGlass`-wrapped card. Same `createSpace` call and validation as
  today.
- "Logout" as a plain pill button with a text label (not an icon-only
  button — avoids the current build's emoji-rendering issue), calling the
  existing `AuthContext.logout`.
- Theme toggle button removed; `ThemeContext` and its usages removed.

## Main App Page — Chat Panel (`SpaceDetailPage`)

- The `docs-panel` sidebar (upload dropzone + document list) is removed.
  Chat becomes the sole content area, full width.
- Message list scrolls beneath a **floating, fixed-position `LiquidGlass`
  input bar** near the bottom of the viewport — this is where the real
  refraction effect lives, distorting message text as it scrolls behind the
  bar (matching the mockup).
- Input bar: attachment icon (📎, left) opens the file picker (same
  `.pdf,.docx,.txt,.md` validation as today); text field with an "Ask
  Something" placeholder; send button (right).
- **Upload flow, now entirely chat-driven:**
  1. Picking/dropping a file immediately appends a message bubble
     `📎 filename.ext` with a status indicator. The existing 3-second
     poll-while-processing logic (`refreshDocuments`) is retargeted to
     update that specific message's status in place
     (uploading → processing → ready/failed) instead of updating a sidebar
     list item.
  2. On reaching `ready`, the assistant posts a follow-up message containing
     `document.summary` (already returned by the existing API — no backend
     change).
  3. On `failed`, the assistant posts an error-styled message with
     `error_message`, matching the existing error-bubble treatment.
- Asking a question is unchanged functionally (`askQuestion` call, same
  response shape) — only the bubble/citation-chip styling changes.
- Empty state ("Ask anything about your documents") is retained, restyled.

## `LiquidGlass` Component

A reusable wrapper (`<LiquidGlass>{children}</LiquidGlass>`) used in exactly
three places: the chat input bar, the new-space modal, and message/citation
cards.

- On mount (and on resize only — not on every render or position change),
  generates a displacement map on an offscreen canvas: a blurred, inset,
  50%-gray rounded rect that neutralizes the interior and confines
  refraction to an edge band.
- Encodes the map into an SVG filter chain: three `feDisplacementMap` passes
  at staggered scales, each isolated to a color channel via
  `feColorMatrix`, recombined with `feBlend mode="screen"` for a
  chromatic-aberration edge effect.
- Applies via `backdrop-filter: url(#<generated-id>)` on the wrapped
  element.
- **Fallback**: feature-detects SVG-backdrop-filter support (Chromium-only
  for real refraction). Safari/Firefox receive a plain
  `backdrop-filter: blur()` frosted look instead — visually consistent,
  just without the chromatic distortion. No unstyled/broken state on any
  browser.
- Constrained to elements under ~800px per side per the technique's own
  performance guidance (map-generation cost scales with area) — satisfied
  by all three usage sites (input bar, modal, cards).
- No new npm dependency; implemented as a small standalone module using
  native Canvas/SVG/CSS APIs.

## Visual Design Tokens

Replaces the current dual-theme CSS variable set with one fixed palette:

- Sidebar: near-black (e.g. `#1a1a1a`), opaque.
- Content pane: off-white (e.g. `#fafafa`).
- Wordmark/label text: muted gray, light font weight, wide letter-spacing
  (`letter-spacing: 0.3em` or similar) for "MINDSPACE" branding text
  specifically.
- No accent-color gradients or glow effects from the current build — kept
  deliberately flat and minimal.

## File-Level Changes (indicative, refined during planning)

- **New**: `components/LiquidGlass.tsx` (+ its canvas/SVG filter helper
  module), `components/SplashScreen.tsx`, `pages/AuthPage.tsx`.
- **Removed**: `pages/LoginPage.tsx`, `pages/SignupPage.tsx`,
  `context/ThemeContext.tsx`, the `docs-panel` markup/styles in
  `SpaceDetailPage.tsx`.
- **Rewritten**: `index.css` (new token set, replaces glassmorphism styles),
  `AppShell.tsx` (sidebar restyle, theme toggle removed),
  `SpaceDetailPage.tsx` (chat-driven upload flow, floating glass input bar).
- **Unchanged**: `AuthContext.tsx`, all files under `api/` (`auth.ts`,
  `spaces.ts`, `documents.ts`, `qa.ts`, `client.ts`), `types.ts`,
  `ProtectedRoute.tsx` (routing logic only, restyled wrapper if needed).

## Error Handling

No new error-handling mechanisms — every existing error path (auth
failures, upload failures, ask failures, space create/delete failures) is
preserved exactly, only its visual presentation changes to match the new
minimal style.

## Testing / Verification

Matches this codebase's existing convention: no per-page Vitest suites exist
today (only `AuthContext.test.tsx`, which covers pure context logic and is
unaffected by this rework). Verification for the new flows happens via real
Playwright browser runs covering: splash timing and fade-through to the
login form, `LiquidGlass` rendering (and its Safari/Firefox fallback path if
testable), the chat-driven upload → processing → ready → summary flow, the
new-space modal, and sidebar space switching. If the displacement-map
generation logic ends up non-trivial enough to warrant it, it gets a
focused Vitest unit test.
