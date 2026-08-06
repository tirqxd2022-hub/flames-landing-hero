# Sound notification system

A configurable, event-driven sound notification system for staff screens, managed from a new **Notifications** tab in Admin → Settings.

## What the admin sees

A "Notifications" tab listing notification rules. Each rule row has:

- **Trigger** — the event that fires the sound. Each trigger can only be used by one rule; triggers already taken are disabled in the other rows.
- **Sound** — one of the built-in tones, with a Play button to preview it.
- A remove button, plus an "Add notification" button to create a new rule.

Triggers available:
- New order received
- Order marked preparing
- Order marked ready
- Order completed
- Order cancelled

Built-in tones (generated in the browser, no audio files): Chime, Double beep, Ding, Alert (triple), Soft pop, Rising trill.

Rules save together with everything else via the existing "Save all settings" button.

## How it behaves

On staff screens that poll orders (admin Orders, Current Orders), when a refresh reveals an event matching a configured rule, that rule's tone plays once. No mute switch and no volume control — one-shot sounds only.

Browsers block audio until the user has interacted with the page, so the audio engine unlocks on the first click or tap; before that, sounds are silently skipped.

## Technical notes

- `src/lib/notification-sounds.ts` — Web Audio tone library: a `TONES` registry (id, label, note/envelope recipe), `playTone(id)`, and a lazily created, click-unlocked `AudioContext`.
- `src/lib/notification-rules.ts` — trigger registry (`TRIGGERS`), JSON encode/decode for the stored value, and a `useNotificationRules()` hook reading from `useSiteSettings()`.
- Storage: a single site setting key `notification_rules` holding a JSON array of `{ trigger, tone }`. No schema change or migration — it rides the existing `/admin/settings` GET/PUT endpoints and the `SiteSettings` string record.
- `src/pages/admin/Settings.tsx` — add a `notifications` tab. The existing tabs are field-list driven, so this one renders a custom `NotificationsSection` component instead of `SectionGrid`.
- Event detection in `src/pages/admin/Orders.tsx` and `src/pages/CurrentOrders.tsx`: a shared helper diffs the previous order list against the freshly fetched one to detect new orders and status transitions, then plays the matching tone. The first load never fires sounds.