# Skins + Widgets Overhaul — Working Document

## CURRENT STATE SUMMARY

**Baseline audit complete.** ~4,348 lines across 6 page files. Backend has full CRUD, ratings, comments, tags, screenshots. Frontend is functional but has classic rapid-prototype patterns: no loading states, minimal feedback, inline editing, no owned-vs-visitor distinction.

### Key Pain Points (Priority Order)
1. No loading states anywhere — grid renders blank during fetch
2. Trending section auto-hides if <2 items (empty state problem)
3. Cards are functional but not premium — hover text tiny, no strong visual hierarchy
4. Dashboard feels like a settings page, not a control center
5. No owned-vs-not-owned distinction on detail pages
6. Comment/rating feedback is minimal (no optimistic updates)
7. Widget iframe previews (24 per page) are slow
8. No keyboard navigation
9. Upload flow is buried and technical

## COMPLETED THIS CYCLE (Cycle 1)
- Full frontend audit (6 pages, ~4,348 lines)
- Full backend audit (all API endpoints, schemas, validators)
- Working document created
- TODO list created
- **Skins gallery redesign shipped:**
  - Replaced "Trending" with "Featured" section (always visible, graceful empty state with CTA)
  - Added skeleton loaders (shimmer animation) for both featured and grid sections
  - Redesigned empty state with mini-terminal visual (intentional design, not error-like)
  - Improved filter bar layout (search + sort on same row, tags below)
  - Simplified hero (single-word title "Skins", cleaner desc)
  - Improved card hover text sizes (0.85rem author, 0.8rem body)
  - Better spacing throughout (14px grid gap, 28px filter margin)
  - Filter top stacks vertically on mobile

## NEXT PRIORITIES (Cycle 2)
1. **Widgets gallery** — match skins redesign pattern
2. **Dashboard overhaul** — control center feel, not settings page
3. **Detail page: owned vs not-owned states**

## OPEN QUESTIONS / BLOCKERS
- How many skins/widgets currently exist in the community? (affects empty state strategy)
- Are there featured/curated skins to highlight? Or is it all community-submitted?

## TODO LIST

### P0 — Ship This Week
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Skins gallery: replace trending with featured section | COMPLETE | Shipped — always visible, graceful empty |
| 2 | Skins gallery: skeleton loaders during fetch | COMPLETE | Shimmer cards on initial + subsequent loads |
| 3 | Skins gallery: improved card hover/hierarchy | COMPLETE | Larger text, better spacing |
| 4 | Skins gallery: better empty state | COMPLETE | Mini-terminal visual with blinking cursor |
| 5 | Dashboard: full visual overhaul | NOT STARTED | Control center feel, not settings page |
| 6 | Detail page: owned vs not-owned states | NOT STARTED | Edit button for owner, install for visitor |

### P1 — Next Phase
| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Widget gallery: parity with skins redesign | NOT STARTED | Match new card/layout pattern |
| 8 | Detail page: loading states + optimistic updates | NOT STARTED | Ratings, comments, downloads |
| 9 | Color filtering: visual dot picker | NOT STARTED | Simple, not dropdown |
| 10 | Tag system: improved UI (pills, multi-select) | NOT STARTED | Better visual affordance |

### P2 — Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | Author page: richer profile | NOT STARTED | Bio, stats, follow |
| 12 | Upload flow: drag-and-drop redesign | NOT STARTED | Less technical, more guided |
| 13 | Comment markdown support | NOT STARTED | Basic formatting |
| 14 | Keyboard navigation | NOT STARTED | Arrow keys, enter, escape |
