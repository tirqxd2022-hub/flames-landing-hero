# Plan: Flames Gourmet Hero Landing Page

Build the hero section for the Flames Gourmet restaurant landing page at `/`, replacing the placeholder. Scope is the hero section only — no navigation, no footer, no full menu.

## What to build

A full-viewport hero section that establishes the restaurant's brand and immediately drives two actions: view the menu or book a table.

Content and structure:

- Brand wordmark: "Flames Gourmet".
- Headline: emphasize fire-grilled cooking and premium ingredients.
- Subheadline: one concise line about the experience or cuisine.
- Two CTAs: primary "Reserve a Table" and secondary "View Menu".
- Hero image: a high-quality grilled dish or restaurant ambience photo, positioned to the right on desktop and stacked on mobile.
- Decorative flame/grill texture or subtle gradient overlay to reinforce the brand name without being literal.
- Trust cues: one short line about awards, location, or cuisine style.

## Design direction

Warm, sophisticated, flame-lit mood. The palette will shift from the current cool slate defaults to a warm-neutral system with amber and deep charcoal. Typography stays clean and modern, with a slightly larger, tighter display headline.

Semantic tokens to add:

- `--hero-background`: deep charcoal/ink base
- `--hero-foreground`: warm off-white
- `--hero-accent`: amber/orange flame tone
- `--hero-accent-foreground`: near-black for text on accent
- `--hero-muted`: warm gray for secondary text

All colors will be added in `src/styles.css` using `oklch` and registered in the `@theme inline` block so Tailwind utilities are available. No hardcoded hex classes in components.

## Technical approach

- Update `src/routes/index.tsx` to render the hero section and add a `head()` with a unique title, description, og title, og description, og type, and twitter card.
- Add a generated or Unsplash hero image with proper `alt` text and lazy loading for the background.
- Keep the section responsive using Tailwind v4 utilities and the existing `useIsMobile` hook if needed.
- No new dependencies. The current stack (React 19, TanStack Router, Tailwind v4) is sufficient.
- No backend or database needed for this static hero section.

## Files to change

- `src/styles.css` — add warm semantic tokens and register them in `@theme inline`.
- `src/routes/index.tsx` — replace the placeholder with the hero component and SEO head metadata.

## Acceptance criteria

- `/` no longer shows the Lovable placeholder.
- Hero renders brand name, headline, subheadline, two CTAs, and a hero image.
- Text and CTAs are readable and responsive on mobile and desktop.
- Page title, meta description, and Open Graph tags are present and unique to this route.
- Colors come from semantic tokens only; no hardcoded `text-white` or `bg-[#...]` classes.
- Build passes after changes.
