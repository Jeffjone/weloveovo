# Moonlight Archive: presentation redesign

## Preservation map

The redesign is restricted to presentation components and styles. PostgreSQL queries, source synchronization, editorial publication, authentication, storage, and API contracts remain unchanged.

| Surface                     | Behaviors to preserve                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lobby and shared shell      | Database introductions/artwork/counts; all room links; Home; Connections; random song; effects setting; persistent Spotify tray     |
| Records and release details | Featured/all toggle; stable URLs; track pagination; source links; connection actions                                                |
| Eras and era details        | Ordered database membership; sourced narratives; featured track; listening filter and graph links                                   |
| Listening and song details  | Search debounce and shortcut; all filters/sorts; pagination; card/list view; favorites; playback; downloads; notes; recommendations |
| Legacy                      | Published story, references, milestones, anchors and era links                                                                      |
| Games                       | All quiz modes, answers, retry, browser learning progress; timed/untimed naming and fan levels                                      |
| Connections                 | Graph/list equivalence; expansion, keyboard access, zoom/reset and detail links                                                     |
| Vault                       | Empty state, query filters and published-only entries                                                                               |
| Curator                     | Login, editing, drafts/preview/restoration, review queue, sync, uploads and publication                                             |
| System states               | Loading, errors/retry, not found, Back/Forward, deep links and refresh                                                              |

## Visual concept

A moonlit music archive: oversized identity typography, silver-blue notation, sleeve-like record composition, restrained orbital geometry, and the warm moon in the existing Toronto photograph. Room pages retain their individual functions within one typographic and spatial system.

The lobby stays a compact selector. Longer editorial pages carry the scroll choreography: the Records sleeve archive, the Eras chronology, and the Legacy city/story sequence. Scrolling remains native. Reduced motion and the effects toggle expose static, fully readable content.

Reusable motion patterns cover route arrival, scroll progress, image depth, section reveals, menu entrance/exit, sleeve hover, directional links, pressed/favorite feedback, and player arrival. Expensive motion simplifies on touch/mobile devices and pauses when hidden.

## Acceptance audit

The presentation uses shared tokens, scoped CSS Modules, `ScrollScene`, and the existing persistent experience provider. No backend, database, authentication, API, or catalog rules were changed.

| Requirement                        | Implementation and evidence                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinctive hero                   | Oversized weloveovo wordmark, five sleeve entrances, Toronto moonlight, interactive Connections orbit and retained Games entrance                                          |
| Three substantial scroll sequences | Records sleeve stack and sticky index; six chronological Era compositions; Legacy panorama, sticky story and milestone progression                                         |
| Reusable microinteractions         | Sleeve lift/specular sweep; image reveal; directional arrows; link underline; pressed buttons; favorite feedback; selected navigation; loading shimmer                     |
| Navigation and overlays            | Six-room animated disclosure with keyboard dismissal/focus return; CSS route arrival; persistent Spotify tray entrance/exit                                                |
| Responsive and accessible          | Public routes checked at 1440/1024/768/390; curator forms checked at the same widths; no primary-content overflow; automated axe WCAG 2.2 AA rules pass on tested surfaces |
| Motion preferences                 | Reduced motion, effects disabled and mobile simplification tested; native scrolling retained; ambient motion pauses when hidden                                            |
| Functional regression              | Backend, UI and browser suites cover catalog, navigation/history, games, favorites, graph/list, player, authorization and editorial behavior                               |
| Assets                             | Existing identity/photography retained; ten local font weights compressed from 916,224 to 302,328 bytes; unavailable covers retain an accessible fallback                  |

Validation: production build and TypeScript checks pass; 42 backend tests, 16 UI tests and 24 browser tests pass. Browser checks include room and detail routes, mobile layouts, keyboard navigation, reduced motion, effects toggling and no uncaught application errors. Curator layout checks use local fixtures; no production editorial mutations or audio uploads were performed for this presentation audit. Automated accessibility checks supplement keyboard and visual review; they are not a claim of complete WCAG certification.

### Production performance sample

The repeatable `scripts/verify/presentation.mjs` harness measured eight routes at 1440 and 390 pixels against a local production build using the published catalog. Each route used a fresh browser context, 60 ms network latency, 10 Mbps download and 2 Mbps upload. Mobile additionally used 4× CPU slowdown.

| Metric                               | Desktop      | Mobile                                    |
| ------------------------------------ | ------------ | ----------------------------------------- |
| Largest contentful paint             | 220–1,172 ms | 232–1,664 ms                              |
| Maximum layout shift score           | 0.0753       | 0.0580                                    |
| Maximum sampled interaction duration | 128 ms       | 72 ms                                     |
| Median animation frame interval      | 16.7 ms      | 16.7 ms                                   |
| 95th-percentile frame interval       | 16.7–16.8 ms | 16.7–16.8 ms, except Connections at 50 ms |

All sampled routes meet the practical loading and layout-shift targets. Interaction durations measure menu, Escape and effects controls using Event Timing; they are a lab proxy, **not field INP**. The mobile graph has occasional slower frames under CPU throttling; its catalog navigation remains functional and decorative scroll effects are disabled on mobile. Real user devices, third-party artwork, network conditions and hosted server latency can differ from this sample. No new runtime animation dependency was added.
