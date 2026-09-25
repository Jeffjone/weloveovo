# weloveovo

A cinematic Drake discovery and learning app: five rooms over a persistent Toronto nightscape, connected by a branching timeline of eras, records, tracks, artists, and milestones. Explore song cards, open a random song, or learn the catalog through four quiz modes. The app preserves the original 414-track collection, 117 releases, 104 credited artists, and six career chapters.

[Visit weloveovo](https://www.weloveovo.com) · [Game Room](https://www.weloveovo.com/games) · [License](LICENSE)

**Proprietary project — all rights reserved.** The original code, design, and project content are not offered under an open-source license. Reuse requires the rights holder's written permission, subject to the exceptions in [LICENSE](LICENSE).

## The experience

- **Lobby `/`** — four main entrances plus a Game Room link; persistent room switcher, skyline, random-song button, and effects control.
- **Records `/records`** — featured projects or all releases, with `/records/[id]` detail pages.
- **Eras `/eras`** — six chapters with their own `/eras/[id]` stories and records.
- **Listening Room `/listening-room`** — server-side search, mood/release/era/explicit filters, sorting, pagination, and browser-local favorites. Press `/` to search.
- **Game Room `/games`** — ten-question learning rounds for song-to-release matching, album artwork, release years, and collaborators. Answers are checked on the server and explain the catalog connection. Replay missed questions; study counts stay in browser-local storage.
- **Tracks `/tracks/[spotifyId]`** — musical traits, related tracks with explanations, Spotify, and published MP3 downloads.
- **Legacy `/legacy`** — sourced stories and milestones.
- **Connections `/connections`** — an expandable chronological graph with an equivalent list view. Tab to a node and press Enter or Space to expand it.

Spotify loads only after Listen is selected. Its iframe remains mounted during room navigation and while the tray is collapsed; closing the tray removes it. Playback availability depends on Spotify and the visitor's account/browser. External Spotify and Apple Music links remain available. No audio is autoplayed or extracted from Spotify.

Favorites stay in your browser. If storage is blocked, they work for the current visit. Effects honor reduced motion, pause when the page is hidden, and can be disabled independently. There are no public accounts, comments, ratings, locked chapters, or progress gates.

The Listening Room defaults to clickable song cards, with a URL-backed Track list option. Every song file includes a reading section generated from its catalog metadata, performer credits, and release edition. The header's Random song button selects a track on the server, excludes the current song, and opens its page without autoplay. The Game Room is linked from the lobby and Rooms menu. Quizzes use this collection's release editions, not claims about a song's earliest release.

Learning progress records question totals and the songs you have studied. It stays in your browser, remains separate from favorites, and lasts only for the current visit when storage is blocked. Games are for personal practice, with no competitive scores or public account requirements.

## Content and credits

The collection reflects the supplied library, not a claim to contain every recording or every version.

- [Drake on Apple Music](https://music.apple.com/us/artist/drake/271256): release information, artist context, and OVO Sound background.
- [Recording Academy](https://www.grammy.com/artists/drake/12370/): the first Grammy win for _Take Care_ in 2013.
- Cover art is from Apple's music catalog and belongs to its respective rights holders.
- The Toronto nightscape is original AI-generated editorial artwork, an imagined view rather than a documentary photograph.

Independent fan-made project. Not affiliated with Drake, OVO, Spotify, or Apple Music.

## License and permissions

Copyright (c) 2026 Jeffjone. All rights reserved in the original, copyrightable project material owned by Jeffjone. See [LICENSE](LICENSE) for the governing terms.

Without prior written permission, you may not copy, modify, redistribute, sell, sublicense, or deploy that material as another website or product, except as permitted by applicable law or the license's express exceptions. Giving credit alone does not grant permission. Request permission from [Jeffjone on GitHub](https://github.com/Jeffjone); permission must be explicitly granted in writing.

This notice does not claim ownership of Drake's music, lyrics, album artwork, third-party trademarks, factual catalog data, or other third-party material. Dependencies and separately licensed assets retain their own terms. The AI-generated skyline is subject only to rights that actually exist under applicable law.

Visitors may use the deployed site through its intended interface. This license does not prevent copying technically or override rights granted under [GitHub's Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), including viewing and forking a public repository within GitHub. See [GitHub's licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
