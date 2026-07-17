# Liquid-Glass Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dual-theme glassmorphism frontend with a fixed minimal aesthetic (dark sidebar, light content pane, painted-texture auth background) featuring a real SVG-refraction "liquid glass" effect on the chat input bar, modal, and citation cards, with document upload folded into the chat input instead of a dedicated documents panel.

**Architecture:** Frontend-only rework. All existing API/data logic (`api/*.ts`, `AuthContext`) is reused unchanged. New: a `LiquidGlass` wrapper component built on vanilla SVG `feDisplacementMap` filters with a CSS-blur fallback, a `SplashScreen` component, and a merged `AuthPage`. Removed: `ThemeContext`, the documents side-panel, separate `LoginPage`/`SignupPage`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + jsdom (unit tests), Playwright (browser verification) — no new dependencies.

## Global Constraints

- No backend/API changes — every task only touches `frontend/`.
- No new npm dependencies.
- No dark/light theme toggle — one fixed visual style.
- `LiquidGlass` effect applies only to: the chat input bar, the new-space modal, and citation/source cards — not the sidebar (full-height panels exceed the ~800px-per-side practical limit for real refraction, per the reference technique's own performance guidance).
- Every browser must render a working UI — Safari/Firefox get a `backdrop-filter: blur()` fallback where Chromium gets real refraction; never an unstyled/broken state.
- The exact painted-texture auth background image is a pending asset from the user. Until provided, use a CSS gradient approximation in `.auth-page`; swapping in the real image later is a one-line change (see Task 1, Step 3 note).

---

### Task 1: CSS token layer and base styles

**Files:**
- Create: `frontend/src/index.css` (full replacement of the existing file)

**Interfaces:**
- Produces: CSS custom properties (`--sidebar-bg`, `--content-bg`, `--content-text`, `--content-text-muted`, `--content-border`, `--danger`, `--danger-subtle`, `--success`, `--warning`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`, `--glass-blur-fallback`, `--transition`) and classes (`.app-shell`, `.sidebar`, `.sidebar-header`, `.wordmark`, `.wordmark--small`, `.space-list`, `.space-item`, `.space-item-name`, `.space-item-delete`, `.new-space-btn`, `.logout-btn`, `.main-content`, `.auth-page`, `.splash`, `.splash-wordmark`, `.splash-progress`, `.splash-progress-bar`, `.auth-form-card`, `.auth-wordmark`, `.auth-footer`, `.auth-link`, `.form-group`, `.form-label`, `.form-input`, `.btn-primary`, `.btn-secondary`, `.alert.error`, `.modal-overlay`, `.modal`, `.modal-title`, `.modal-actions`, `.empty-state`, `.empty-state-title`, `.empty-state-desc`, `.chat-panel`, `.chat-messages`, `.chat-empty`, `.chat-empty-text`, `.chat-empty-hint`, `.message-row`, `.message-content`, `.message-bubble`, `.ai-bubble`, `.user-bubble`, `.upload-bubble`, `.upload-filename`, `.upload-status-text`, `.status-dot` (+ `.uploading`/`.processing`/`.ready`/`.failed` modifiers), `.message-time`, `.sources-list`, `.source-chip`, `.source-chip-label`, `.typing-indicator`, `.typing-dot`, `.chat-input-bar`, `.attachment-btn`, `.chat-textarea`, `.chat-send-btn`, `.liquid-glass`, `.liquid-glass--refract`, `.liquid-glass--fallback`) — every later task's JSX references these class names exactly.
- Consumes: nothing (pure CSS, no imports).

- [ ] **Step 1: Replace `frontend/src/index.css` entirely**

```css
/* ============================================================
   MindSpace — Minimal design system
   ============================================================ */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --sidebar-bg: #1a1a1a;
  --sidebar-text: #e8e8e8;
  --sidebar-text-muted: #8a8a8a;
  --sidebar-border: #2c2c2c;
  --sidebar-active-bg: #262626;

  --content-bg: #fafafa;
  --content-text: #1a1a1a;
  --content-text-muted: #6b6b6b;
  --content-border: #e5e5e5;

  --danger: #c0392b;
  --danger-subtle: rgba(192, 57, 43, 0.08);
  --success: #2e7d32;
  --warning: #b8860b;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  --glass-blur-fallback: blur(18px);
  --glass-tint: rgba(255, 255, 255, 0.55);
  --glass-border: rgba(0, 0, 0, 0.08);

  --transition: 0.2s ease;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

html, body, #root {
  height: 100%;
}

body {
  font-family: var(--font);
  color: var(--content-text);
  background: var(--content-bg);
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

input, textarea {
  font-family: inherit;
}

/* ── Layout: App Shell ── */
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
}

.sidebar-header {
  margin-bottom: 32px;
}

.wordmark {
  color: var(--sidebar-text-muted);
  font-weight: 300;
  letter-spacing: 0.35em;
  text-decoration: none;
  font-size: 15px;
}

.wordmark--small {
  font-size: 13px;
}

.space-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.space-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 10px;
  border-bottom: 1px dotted var(--sidebar-border);
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: 14px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}

.space-item:hover {
  background: var(--sidebar-active-bg);
}

.space-item.active {
  background: var(--sidebar-active-bg);
  font-weight: 600;
}

.space-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-item-delete {
  color: var(--sidebar-text-muted);
  font-size: 12px;
  opacity: 0;
  transition: opacity var(--transition);
}

.space-item:hover .space-item-delete {
  opacity: 1;
}

.new-space-btn {
  margin-top: 12px;
  padding: 10px;
  border: 1px dashed var(--sidebar-border);
  border-radius: var(--radius-sm);
  color: var(--sidebar-text-muted);
  font-size: 13px;
  transition: border-color var(--transition), color var(--transition);
}

.new-space-btn:hover {
  border-color: var(--sidebar-text-muted);
  color: var(--sidebar-text);
}

.logout-btn {
  margin-top: 16px;
  padding: 10px;
  border-radius: var(--radius-full);
  background: var(--sidebar-active-bg);
  color: var(--sidebar-text);
  font-size: 13px;
  text-align: center;
}

.logout-btn:hover {
  background: var(--sidebar-border);
}

.main-content {
  flex: 1;
  background: var(--content-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  color: var(--content-text-muted);
}

.empty-state-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.empty-state-title {
  font-size: 20px;
  font-weight: 500;
  color: var(--content-text);
  margin-bottom: 8px;
}

.empty-state-desc {
  max-width: 360px;
  font-size: 14px;
  line-height: 1.5;
}

/* ── Auth page ── */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background-image: linear-gradient(
    to bottom,
    #2b2b2b 0%, #2b2b2b 38%, #f5f5f0 42%, #f5f5f0 100%
  );
  background-size: cover;
  background-position: center;
}

.splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.splash--fading {
  opacity: 0;
}

.splash-wordmark {
  color: #9a9a9a;
  font-weight: 300;
  letter-spacing: 0.4em;
  font-size: 28px;
}

.splash-progress {
  width: 180px;
  height: 2px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.splash-progress-bar {
  height: 100%;
  width: 40%;
  background: #6b6b6b;
  border-radius: var(--radius-full);
  animation: splash-progress-fill 1.8s ease forwards;
}

@keyframes splash-progress-fill {
  from { width: 5%; }
  to { width: 100%; }
}

.auth-form-card {
  width: 360px;
  padding: 40px 32px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: auth-card-in 0.4s ease;
}

@keyframes auth-card-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.auth-wordmark {
  color: var(--content-text-muted);
  font-weight: 300;
  letter-spacing: 0.35em;
  font-size: 15px;
  text-align: center;
}

.auth-footer {
  text-align: center;
  font-size: 13px;
  color: var(--content-text-muted);
}

.auth-link {
  color: var(--content-text);
  text-decoration: underline;
  font-size: 13px;
}

/* ── Forms / buttons / alerts ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.form-label {
  font-size: 12px;
  color: var(--content-text-muted);
}

.form-input {
  padding: 10px 12px;
  border: 1px solid var(--content-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: #fff;
}

.form-input:focus {
  outline: 2px solid var(--content-text-muted);
  outline-offset: 1px;
}

.btn-primary {
  width: 100%;
  padding: 11px;
  border-radius: var(--radius-sm);
  background: var(--content-text);
  color: #fff;
  font-size: 14px;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 11px 16px;
  border-radius: var(--radius-sm);
  background: var(--content-border);
  color: var(--content-text);
  font-size: 14px;
}

.alert.error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-subtle);
  color: var(--danger);
  font-size: 13px;
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 360px;
  padding: 28px;
  border-radius: var(--radius-lg);
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 18px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

/* ── Chat panel ── */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px 120px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--content-text-muted);
}

.chat-empty-text {
  font-size: 16px;
  margin-bottom: 6px;
}

.chat-empty-hint {
  font-size: 13px;
}

.message-row {
  display: flex;
  width: 100%;
}

.message-row.user {
  justify-content: flex-end;
}

.message-content {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-bubble {
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
}

.ai-bubble {
  background: #fff;
  border: 1px solid var(--content-border);
  color: var(--content-text);
}

.user-bubble {
  background: var(--content-text);
  color: #fff;
}

.upload-bubble {
  background: #fff;
  border: 1px solid var(--content-border);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.upload-filename {
  font-weight: 500;
}

.upload-status-text {
  color: var(--content-text-muted);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-dot.uploading, .status-dot.processing {
  background: var(--warning);
}

.status-dot.ready {
  background: var(--success);
}

.status-dot.failed {
  background: var(--danger);
}

.message-time {
  font-size: 11px;
  color: var(--content-text-muted);
  padding: 0 4px;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
}

.source-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.source-chip-label {
  font-weight: 600;
  color: var(--content-text-muted);
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--content-text-muted);
  animation: typing-bounce 1s infinite ease-in-out;
}

.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-4px); opacity: 1; }
}

/* ── Floating chat input bar ── */
.chat-input-bar {
  position: absolute;
  left: 40px;
  right: 40px;
  bottom: 24px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-full);
}

.attachment-btn {
  font-size: 18px;
  padding: 6px;
  flex-shrink: 0;
}

.chat-textarea {
  flex: 1;
  resize: none;
  border: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  max-height: 160px;
  padding: 6px 0;
}

.chat-textarea:focus {
  outline: none;
}

.chat-send-btn {
  font-size: 16px;
  padding: 6px 10px;
  flex-shrink: 0;
  color: var(--content-text);
}

.chat-send-btn:disabled {
  color: var(--content-text-muted);
  cursor: not-allowed;
}

/* ── Liquid glass ── */
.liquid-glass {
  position: relative;
}

.liquid-glass--fallback {
  backdrop-filter: var(--glass-blur-fallback);
  -webkit-backdrop-filter: var(--glass-blur-fallback);
  background: var(--glass-tint);
  border: 1px solid var(--glass-border);
}

.liquid-glass--refract {
  background: var(--glass-tint);
  border: 1px solid var(--glass-border);
}
```

- [ ] **Step 2: Verify the build picks up the new file**

Run: `cd frontend && npm run build`
Expected: build succeeds (no CSS is type-checked, but this confirms Vite processes the file without syntax errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: replace dual-theme glassmorphism CSS with minimal fixed design tokens"
```

Note for later (not part of this task): once the user provides the real painted-texture image, replace `.auth-page`'s `background-image` gradient with `background-image: url('../assets/auth-background.png')` (place the file at `frontend/src/assets/auth-background.png`).

---

### Task 2: Liquid-glass filter helpers (pure logic)

**Files:**
- Create: `frontend/src/lib/liquidGlass.ts`
- Test: `frontend/src/lib/liquidGlass.test.ts`

**Interfaces:**
- Produces: `supportsLiquidGlassRefraction(): boolean`, `buildLiquidGlassFilterMarkup(filterId: string, width: number, height: number, mapDataUrl: string): string`, `generateDisplacementMapDataUrl(width: number, height: number): string` — consumed by Task 3's `LiquidGlass` component.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/lib/liquidGlass.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLiquidGlassFilterMarkup, supportsLiquidGlassRefraction } from './liquidGlass'

describe('supportsLiquidGlassRefraction', () => {
  const originalSupports = CSS.supports

  afterEach(() => {
    CSS.supports = originalSupports
  })

  it('returns true when the browser supports backdrop-filter: url()', () => {
    CSS.supports = vi.fn().mockReturnValue(true)
    expect(supportsLiquidGlassRefraction()).toBe(true)
  })
})

describe('buildLiquidGlassFilterMarkup', () => {
  it('embeds the given filter id, width, and height', () => {
    const markup = buildLiquidGlassFilterMarkup('my-filter', 200, 80, 'data:image/png;base64,AAA')
    expect(markup).toContain('id="my-filter"')
    expect(markup).toContain('width="200"')
    expect(markup).toContain('height="80"')
    expect(markup).toContain('data:image/png;base64,AAA')
  })

  it('includes three feDisplacementMap passes at staggered scales', () => {
    const markup = buildLiquidGlassFilterMarkup('f2', 100, 100, 'data:x')
    const matches = markup.match(/feDisplacementMap/g)
    expect(matches?.length).toBe(3)
    expect(markup).toContain('scale="18"')
    expect(markup).toContain('scale="12"')
    expect(markup).toContain('scale="6"')
  })

  it('recombines channels with feBlend mode="screen"', () => {
    const markup = buildLiquidGlassFilterMarkup('f3', 100, 100, 'data:x')
    const matches = markup.match(/feBlend[^>]*mode="screen"/g)
    expect(matches?.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- liquidGlass`
Expected: FAIL with "Failed to resolve import './liquidGlass'" (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/lib/liquidGlass.ts

let cachedSupport: boolean | null = null

export function supportsLiquidGlassRefraction(): boolean {
  if (cachedSupport !== null) return cachedSupport
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    cachedSupport = false
    return false
  }
  cachedSupport = CSS.supports('backdrop-filter', 'url(#a)')
  return cachedSupport
}

export function buildLiquidGlassFilterMarkup(
  filterId: string,
  width: number,
  height: number,
  mapDataUrl: string,
): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return `<svg width="0" height="0" style="position:absolute;overflow:hidden">
    <filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feImage href="${mapDataUrl}" x="0" y="0" width="${w}" height="${h}" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="B" result="disp1" />
      <feColorMatrix in="disp1" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="12" xChannelSelector="R" yChannelSelector="B" result="disp2" />
      <feColorMatrix in="disp2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="6" xChannelSelector="R" yChannelSelector="B" result="disp3" />
      <feColorMatrix in="disp3" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB" />
      <feBlend in="dispR" in2="dispG" mode="screen" result="blend1" />
      <feBlend in="blend1" in2="dispB" mode="screen" />
    </filter>
  </svg>`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function generateDisplacementMapDataUrl(width: number, height: number): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = 'rgb(128, 128, 128)'
  ctx.fillRect(0, 0, w, h)

  const inset = Math.min(w, h) * 0.12
  const radius = Math.min(w, h) * 0.18
  ctx.filter = 'blur(6px)'
  roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, radius)
  ctx.fill()
  ctx.filter = 'none'

  return canvas.toDataURL('image/png')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- liquidGlass`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/liquidGlass.ts frontend/src/lib/liquidGlass.test.ts
git commit -m "feat: add liquid-glass SVG filter chain generation helpers"
```

---

### Task 3: `LiquidGlass` component

**Files:**
- Create: `frontend/src/components/LiquidGlass.tsx`

**Interfaces:**
- Consumes: `supportsLiquidGlassRefraction`, `buildLiquidGlassFilterMarkup`, `generateDisplacementMapDataUrl` from `../lib/liquidGlass` (Task 2).
- Produces: `<LiquidGlass className?: string>{children}</LiquidGlass>` React component — consumed by Task 6 (modal) and Task 7 (chat input bar, citation cards).

- [ ] **Step 1: Write the implementation**

No unit test for this step — it's DOM/ResizeObserver-driven browser behavior with no meaningful jsdom equivalent (canvas is unavailable in jsdom); it's verified via Playwright once it's actually used in the UI (Task 6/7's verification steps, and the final pass in Task 8).

```tsx
// frontend/src/components/LiquidGlass.tsx
import { ReactNode, useEffect, useRef, useState } from 'react'
import {
  buildLiquidGlassFilterMarkup,
  generateDisplacementMapDataUrl,
  supportsLiquidGlassRefraction,
} from '../lib/liquidGlass'

let filterCounter = 0

interface LiquidGlassProps {
  children: ReactNode
  className?: string
}

export function LiquidGlass({ children, className = '' }: LiquidGlassProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [filterId] = useState(() => `liquid-glass-filter-${filterCounter++}`)
  const [filterMarkup, setFilterMarkup] = useState('')
  const refractionSupported = supportsLiquidGlassRefraction()

  useEffect(() => {
    if (!refractionSupported) return
    const el = wrapperRef.current
    if (!el) return

    function regenerate() {
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const mapDataUrl = generateDisplacementMapDataUrl(width, height)
      setFilterMarkup(buildLiquidGlassFilterMarkup(filterId, width, height, mapDataUrl))
    }

    regenerate()
    const observer = new ResizeObserver(regenerate)
    observer.observe(el)
    return () => observer.disconnect()
  }, [filterId, refractionSupported])

  return (
    <div
      ref={wrapperRef}
      className={`liquid-glass ${refractionSupported ? 'liquid-glass--refract' : 'liquid-glass--fallback'} ${className}`}
      style={refractionSupported ? { backdropFilter: `url(#${filterId})`, WebkitBackdropFilter: `url(#${filterId})` } : undefined}
    >
      {refractionSupported && filterMarkup && <div dangerouslySetInnerHTML={{ __html: filterMarkup }} />}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LiquidGlass.tsx
git commit -m "feat: add LiquidGlass component with SVG refraction and blur fallback"
```

---

### Task 4: `SplashScreen` component

**Files:**
- Create: `frontend/src/components/SplashScreen.tsx`
- Test: `frontend/src/components/SplashScreen.test.tsx`

**Interfaces:**
- Produces: `<SplashScreen onDone: () => void />`, `SPLASH_DURATION_MS` (exported constant) — consumed by Task 5's `AuthPage`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/SplashScreen.test.tsx
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplashScreen, SPLASH_DURATION_MS } from './SplashScreen'

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call onDone before the splash duration elapses', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)

    act(() => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('calls onDone once the splash duration plus fade-out elapses', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)

    act(() => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS + 300)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- SplashScreen`
Expected: FAIL with "Failed to resolve import './SplashScreen'".

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/components/SplashScreen.tsx
import { useEffect, useState } from 'react'

export const SPLASH_DURATION_MS = 1800

interface SplashScreenProps {
  onDone: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS)
    const doneTimer = setTimeout(onDone, SPLASH_DURATION_MS + 300)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div className={`splash ${fadingOut ? 'splash--fading' : ''}`}>
      <span className="splash-wordmark">MINDSPACE</span>
      <div className="splash-progress">
        <div className="splash-progress-bar" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- SplashScreen`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SplashScreen.tsx frontend/src/components/SplashScreen.test.tsx
git commit -m "feat: add SplashScreen component with fixed-duration fade-out"
```

---

### Task 5: Merge login/signup into `AuthPage`, remove old auth pages

**Files:**
- Create: `frontend/src/pages/AuthPage.tsx`
- Delete: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/SignupPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`login`, `signup`) from `../context/AuthContext` (unchanged), `SplashScreen` from `../components/SplashScreen` (Task 4).
- Produces: `<AuthPage />` mounted at both `/login` and `/signup`.

- [ ] **Step 1: Create `frontend/src/pages/AuthPage.tsx`**

```tsx
import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SplashScreen } from '../components/SplashScreen'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(true)
  const [mode, setMode] = useState<Mode>(location.pathname === '/signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      navigate('/spaces')
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === 'login' ? 'Login' : 'Signup'} failed`)
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <div className="auth-page">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!showSplash && (
        <div className="auth-form-card">
          <span className="auth-wordmark">MINDSPACE</span>

          {error && (
            <div className="alert error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="form-input"
                type="password"
                placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="auth-footer">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the old auth pages**

```bash
rm frontend/src/pages/LoginPage.tsx frontend/src/pages/SignupPage.tsx
```

- [ ] **Step 3: Update `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { AppShell } from './components/AppShell'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/spaces" element={
                <div className="empty-state">
                  <div className="empty-state-icon">🧠</div>
                  <h2 className="empty-state-title">Welcome to MindSpace</h2>
                  <p className="empty-state-desc">
                    Select a space from the sidebar, or create a new one to start uploading documents and asking AI-powered questions.
                  </p>
                </div>
              } />
              <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npm run build`
Expected: build succeeds. (`ThemeProvider`/`ThemeContext` references are gone from this file already — Task 6 removes the file itself.)

- [ ] **Step 5: Verify in a real browser**

Run the app (`docker compose up --build -d` from repo root, or `npm run dev` in `frontend/` against a running backend) and check:
- Visiting `/login` shows the splash, then fades into the login form.
- Clicking "Create one" switches to the signup form without replaying the splash.
- Signing up with a new email redirects to `/spaces`.
- Visiting `/signup` directly starts in signup mode.
- An invalid login shows the inline error message.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AuthPage.tsx frontend/src/App.tsx
git rm frontend/src/pages/LoginPage.tsx frontend/src/pages/SignupPage.tsx
git commit -m "feat: merge login/signup into a single splash-screen AuthPage"
```

---

### Task 6: Restyle `AppShell`, remove theme toggle, glass-wrap the modal

**Files:**
- Modify: `frontend/src/components/AppShell.tsx`
- Delete: `frontend/src/context/ThemeContext.tsx`

**Interfaces:**
- Consumes: `LiquidGlass` from `./LiquidGlass` (Task 3), `useAuth` (unchanged), `listSpaces`/`createSpace`/`deleteSpace` from `../api/spaces` (unchanged).
- Produces: restyled `<AppShell />` — no `useTheme`/theme-toggle references anywhere in the codebase after this task.

- [ ] **Step 1: Rewrite `frontend/src/components/AppShell.tsx`**

```tsx
import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { createSpace, deleteSpace, listSpaces } from '../api/spaces'
import { useAuth } from '../context/AuthContext'
import { LiquidGlass } from './LiquidGlass'
import type { Space } from '../types'

export function AppShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { spaceId } = useParams<{ spaceId?: string }>()

  const [spaces, setSpaces] = useState<Space[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    try {
      setSpaces(await listSpaces())
    } catch {}
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (showNewModal) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showNewModal])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const space = await createSpace(newName.trim())
      setNewName('')
      setShowNewModal(false)
      await refresh()
      navigate(`/spaces/${space.id}`)
    } catch {
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this space and all its documents?')) return
    try {
      await deleteSpace(id)
      if (spaceId === id) navigate('/spaces')
      refresh()
    } catch {}
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/spaces" className="wordmark wordmark--small">MINDSPACE</Link>
        </div>

        <nav className="space-list">
          {spaces.map(space => (
            <Link
              key={space.id}
              to={`/spaces/${space.id}`}
              className={`space-item ${spaceId === space.id ? 'active' : ''}`}
            >
              <span className="space-item-name">{space.name}</span>
              <button
                className="space-item-delete"
                onClick={(e) => handleDelete(space.id, e)}
                title="Delete space"
              >
                ✕
              </button>
            </Link>
          ))}
        </nav>

        <button className="new-space-btn" onClick={() => setShowNewModal(true)}>
          + New Space
        </button>

        <button className="logout-btn" onClick={() => logout()}>
          Logout
        </button>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <LiquidGlass className="modal">
            <div onClick={e => e.stopPropagation()}>
              <h2 className="modal-title">Create New Space</h2>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-space-name">Space name</label>
                  <input
                    id="new-space-name"
                    ref={inputRef}
                    className="form-input"
                    type="text"
                    placeholder="e.g. Research Papers, Q3 Reports…"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowNewModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={creating || !newName.trim()}
                    style={{ flex: 1 }}
                  >
                    {creating ? 'Creating…' : 'Create Space'}
                  </button>
                </div>
              </form>
            </div>
          </LiquidGlass>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the theme context**

```bash
rm frontend/src/context/ThemeContext.tsx
```

- [ ] **Step 3: Confirm nothing else references it**

Run: `cd frontend && grep -rn "ThemeContext\|useTheme\|ThemeProvider" src/`
Expected: no output.

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Verify in a real browser**

- Sidebar renders with no theme-toggle button anywhere.
- Clicking "+ New Space" opens the modal; its background is visibly translucent/blurred (glass effect or fallback blur applied).
- Creating a space navigates into it and it appears in the sidebar list.
- "Logout" signs out and redirects to `/login`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AppShell.tsx
git rm frontend/src/context/ThemeContext.tsx
git commit -m "feat: restyle AppShell sidebar, remove theme toggle, glass-wrap the new-space modal"
```

---

### Task 7: Restructure `SpaceDetailPage` — chat-driven upload, floating glass input bar

**Files:**
- Modify: `frontend/src/pages/SpaceDetailPage.tsx`

**Interfaces:**
- Consumes: `listDocuments`/`uploadDocument` from `../api/documents` (unchanged), `askQuestion` from `../api/qa` (unchanged), `LiquidGlass` from `../components/LiquidGlass` (Task 3), `Document`/`AskResponse` types (unchanged).
- Produces: restyled `<SpaceDetailPage />` with no documents side-panel.

- [ ] **Step 1: Rewrite `frontend/src/pages/SpaceDetailPage.tsx`**

```tsx
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDocuments, uploadDocument } from '../api/documents'
import { askQuestion } from '../api/qa'
import { LiquidGlass } from '../components/LiquidGlass'
import type { AskResponse, Document } from '../types'

interface TextMessage {
  id: string
  kind: 'text'
  role: 'user' | 'ai'
  text: string
  sources?: AskResponse['sources']
  timestamp: Date
  error?: boolean
}

interface UploadMessage {
  id: string
  kind: 'upload'
  documentId: string
  filename: string
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  summary?: string | null
  errorMessage?: string | null
  timestamp: Date
}

type ChatMessage = TextMessage | UploadMessage

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [readyDocCount, setReadyDocCount] = useState(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!spaceId) return
    listDocuments(spaceId)
      .then(docs => setReadyDocCount(docs.filter(d => d.status === 'ready').length))
      .catch(() => {})
  }, [spaceId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function updateUploadMessage(id: string, patch: Partial<UploadMessage>) {
    setMessages(prev => prev.map(m => (m.kind === 'upload' && m.id === id ? { ...m, ...patch } : m)))
  }

  function pollUntilDone(spaceIdArg: string, messageId: string, documentId: string) {
    const iv = setInterval(async () => {
      try {
        const docs = await listDocuments(spaceIdArg)
        const doc = docs.find(d => d.id === documentId)
        if (!doc || doc.status === 'processing') return
        clearInterval(iv)
        updateUploadMessage(messageId, {
          status: doc.status,
          summary: doc.summary,
          errorMessage: doc.error_message,
        })
        if (doc.status === 'ready') setReadyDocCount(c => c + 1)
      } catch {
        clearInterval(iv)
      }
    }, 3000)
  }

  async function handleUpload(file: File) {
    if (!spaceId) return
    const messageId = uid()
    const uploadMsg: UploadMessage = {
      id: messageId,
      kind: 'upload',
      documentId: '',
      filename: file.name,
      status: 'uploading',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, uploadMsg])

    try {
      const doc: Document = await uploadDocument(spaceId, file)
      updateUploadMessage(messageId, { documentId: doc.id, status: doc.status })
      if (doc.status === 'processing') pollUntilDone(spaceId, messageId, doc.id)
    } catch (err) {
      updateUploadMessage(messageId, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  async function handleAsk() {
    const q = question.trim()
    if (!q || !spaceId || asking) return

    const userMsg: TextMessage = { id: uid(), kind: 'text', role: 'user', text: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setQuestion('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setAsking(true)

    try {
      const res = await askQuestion(spaceId, q)
      const aiMsg: TextMessage = {
        id: uid(),
        kind: 'text',
        role: 'ai',
        text: res.answer,
        sources: res.sources,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      const errMsg: TextMessage = {
        id: uid(),
        kind: 'text',
        role: 'ai',
        text: err instanceof Error ? err.message : 'Failed to get an answer. Please try again.',
        timestamp: new Date(),
        error: true,
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setAsking(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-text">Ask anything about your documents</p>
            <p className="chat-empty-hint">
              {readyDocCount > 0
                ? `${readyDocCount} document${readyDocCount !== 1 ? 's' : ''} ready · Ask a question below`
                : 'Attach a document below to get started'}
            </p>
          </div>
        ) : (
          messages.map(msg => {
            if (msg.kind === 'upload') {
              return (
                <div key={msg.id} className="message-row ai">
                  <div className="message-content">
                    <div className="message-bubble upload-bubble">
                      <span className={`status-dot ${msg.status}`} />
                      <span className="upload-filename">📎 {msg.filename}</span>
                      <span className="upload-status-text">
                        {msg.status === 'uploading' && 'Uploading…'}
                        {msg.status === 'processing' && 'Processing…'}
                        {msg.status === 'ready' && 'Ready'}
                        {msg.status === 'failed' && (msg.errorMessage || 'Failed')}
                      </span>
                    </div>
                    {msg.status === 'ready' && msg.summary && (
                      <div className="message-bubble ai-bubble">{msg.summary}</div>
                    )}
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className="message-content">
                  <div
                    className={`message-bubble ${msg.role === 'ai' ? 'ai-bubble' : 'user-bubble'}`}
                    style={msg.error ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : undefined}
                  >
                    {msg.error && <span style={{ color: 'var(--danger)' }}>⚠️ </span>}
                    {msg.text}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <LiquidGlass className="sources-list">
                      {msg.sources.map((src, i) => (
                        <div key={i} className="source-chip">
                          <span className="source-chip-label">📄 {src.filename}</span>
                          <span>{src.snippet}</span>
                        </div>
                      ))}
                    </LiquidGlass>
                  )}
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            )
          })
        )}

        {asking && (
          <div className="message-row ai">
            <div className="message-content">
              <div className="message-bubble ai-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <LiquidGlass className="chat-input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="attachment-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach a document"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask Something"
          value={question}
          onChange={e => { setQuestion(e.target.value); autoResize() }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={asking}
        />
        <button
          className="chat-send-btn"
          onClick={handleAsk}
          disabled={!question.trim() || asking}
          title="Send"
        >
          ➤
        </button>
      </LiquidGlass>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Verify in a real browser**

- Open a space; confirm there's no documents side-panel, just the chat area and the floating input bar.
- Click the 📎 button, pick a `.txt`/`.md` file; confirm an upload message appears immediately with an "Uploading…" status.
- Wait for it to reach "Ready"; confirm a follow-up assistant message shows the document's summary.
- Ask a question; confirm the answer renders with citation chips inside a visibly glassy/translucent card.
- Scroll the message list; confirm messages visibly scroll underneath the floating input bar (not below it).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SpaceDetailPage.tsx
git commit -m "feat: fold document upload into the chat input, remove documents side-panel"
```

---

### Task 8: Full walkthrough and cleanup

**Files:**
- None (verification only, plus incidental fixes found during the walkthrough).

**Interfaces:**
- None — this task validates the integration of Tasks 1-7.

- [ ] **Step 1: Run the full test suite**

Run: `cd frontend && npm test`
Expected: all tests pass (`liquidGlass.test.ts`, `SplashScreen.test.tsx`, `AuthContext.test.tsx`).

- [ ] **Step 2: Run the build**

Run: `cd frontend && npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Rebuild and restart the app**

```bash
docker compose build frontend
docker compose up -d frontend
```

- [ ] **Step 4: Full browser walkthrough**

Using Playwright (or manually), verify end-to-end:
1. Visit `/login` → splash plays → fades into login form.
2. Toggle to signup, create an account → lands on `/spaces` (empty state, sidebar visible, no theme toggle anywhere).
3. Create a space via the glass-wrapped modal → navigates into it.
4. Attach a `.md` file via the 📎 button → upload message appears → reaches "Ready" → summary message follows.
5. Ask a question about the uploaded content → answer appears with citation chips in a glass card.
6. Confirm message text visibly scrolls behind the floating input bar.
7. Click "Logout" → redirected to `/login`; confirm navigating back to `/spaces` afterward redirects to `/login` (session actually cleared).
8. Check the browser console throughout for errors — expect none.

- [ ] **Step 5: Fix anything broken found in Step 4, re-verify, then commit**

```bash
git add -A frontend/
git commit -m "fix: address issues found in full liquid-glass redesign walkthrough"
```

(Skip this commit if nothing needed fixing.)

- [ ] **Step 6: Final commit marking the redesign complete**

```bash
git log --oneline -10
```

Confirm all of Tasks 1-7's commits are present, then report completion.
