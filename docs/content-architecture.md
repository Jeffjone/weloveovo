# Content architecture

## Published data and source snapshots

Next.js pages and read APIs share the PostgreSQL query layer in `src/lib/catalog.ts` and `src/lib/editorial.ts`. Production requires a database connection. Bundled catalogs remain deterministic development fixtures and import inputs, never a silent production fallback.

The Genius worker discovers Drake's artist catalog and rechecks linked song IDs. It stores metadata snapshots, material-change hashes, review decisions, proposals, item checkpoints, and run history in PostgreSQL. It does not fetch or store lyrics. Provider failures and rate limits stop the worker at its saved checkpoint; they never clear published data. Only an explicit source 404 proposes source unavailability, and the recording stays in the collection.

Daily scheduling is an intent, not an exact delivery time. The studio displays actual start/completion times. Interrupted runs resume their saved discovery page and unfinished items; completed runs start a fresh discovery pass. A renewable database lease prevents overlapping workers, and catalog mutations are transactional. GitHub Actions also serializes workflow runs. The studio can dispatch the workflow when configured or perform bounded resumable batches using its server-side Genius connection.

## Publishing boundaries

| Information                                                                        | Publication rule                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Source snapshots and source-check timestamps                                       | Refresh independently of published metadata                                    |
| Linked Genius URLs and source-managed artwork                                      | Refresh only with automation enabled, validated hosts, and no curator override |
| New songs, titles, dates, credits, release assignments, playback IDs, availability | Explicit review approval; stale proposals fail safely                          |
| Possible matches to existing songs                                                 | Explicit identity confirmation; no title-only automatic merge                  |
| Previously rejected entries                                                        | Remain closed until material source metadata changes                           |
| Missing upstream values                                                            | Never erase published values                                                   |
| Vault membership                                                                   | Curator editorial action only; never automated                                 |

Stable track IDs remain the route and favorites keys even when approved playback identifiers change. Newly approved catalog entries become available to search, games, and related content through the same query layer. Imported popularity and audio features are snapshots; Genius refreshes do not invent measurements.

## Editorial content

`stories`, `song_notes`, and `homepage_features` hold the published homepage, Legacy, song context, and room artwork selections. `era_releases` gives each era an explicit ordered record shelf, independent of the Records featured flag. `vault_entries` classifies curator-selected tracks without importing any entries by default.

Drafts live separately in `editorial_drafts`. Publication writes the public row and an immutable `content_revisions` snapshot in one transaction. Restoring a historical revision creates another revision rather than deleting history. Existing published content remains visible while a replacement draft is edited. Song notes require an HTTPS source reference; factual templates remain available when no note is published.

Every curator API request is authorized server-side. New editorial and sync tables have RLS enabled and deny direct anonymous/authenticated access. Privileged operations and worker credentials stay on the server. Public favorites and learning progress remain browser-local.

## Rollout and recovery

Migrations are versioned and tracked in `schema_migrations`. Apply additive schema and editorial tooling before enabling automated publication. The automation gate requires a completed review-only run; proposals can then be inspected before source-link/artwork automation is enabled. Pausing automation preserves snapshot checks and proposal generation.

Rejected proposals and source snapshots preserve review context. Curator changes create field overrides; automatically managed artwork never replaces an overridden cover. Failures can be retried from the studio or worker without replaying completed items. The bundled import audit seeds historical exclusions and decisions once; subsequent decisions are database-owned.

Tests cover import idempotence, source matching, rejection persistence, interruptions, rate limits, field ownership, draft isolation, restoration, authorization, era membership, and an empty Vault. Browser checks cover public routes, history, games, player persistence, and mobile navigation.
