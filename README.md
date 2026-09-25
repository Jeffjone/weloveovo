# WE LOVE OVO

An independent, fan-made Drake listening room. A cinematic Toronto opening leads into six interactive eras, a record shelf, mood discovery, and a searchable 414-track collection of albums, mixtapes, and guest appearances.

## Run locally

From the repository root (where `index.html` lives):

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. The site also works by opening `index.html` directly. No framework, package installation, API key, or build step is required to browse it.

## Explore

- Select an era to discover its story and signature track, or browse its chapter.
- Browse the record shelf and select a cover to filter the library.
- Choose a mood: After hours (low energy and brightness), The long way home (danceable, moderate energy), or Headlines (high energy).
- Search songs, artists, and releases; filter by year, release, or explicit content; sort and paginate results.
- Open any track for its musical traits and Spotify / Apple Music links.
- Save favorites in this browser. They persist locally when browser storage is available; otherwise they last for the visit.
- Press `/` to search, use arrow keys within the era tabs, and press Escape to close track details. Reduced-motion preferences are respected.

The collection reflects the included library and does not claim to contain every recording or every version of a release. Cover cards show the number of tracks represented here. Playback opens in the linked music service.

## Maintain the collection

Edit `data/tracks.json`, then run:

```bash
python3 scripts/build-data.py
```

This regenerates `js/data.js`. The source retains the original music metadata. `js/artwork.js` maps releases to local cover artwork and official Apple Music links. Era narratives and shelf ordering live in `js/app.js`; presentation lives in `css/styles.css`.

## Credits and references

- [Drake on Apple Music](https://music.apple.com/us/artist/drake/271256): release information, artist context, and OVO Sound background.
- [Drake at the Recording Academy](https://www.grammy.com/artists/drake/12370/): the first Grammy win for *Take Care* in 2013.
- Release artwork is sourced from Apple's public music catalog and belongs to its respective rights holders. It is included for identification and editorial presentation.
- `assets/toronto-after-dark.jpg` is original AI-generated editorial artwork: an imagined Toronto nightscape, not a documentary photograph.
- Typography: Barlow Condensed, DM Sans, and IBM Plex Mono via Google Fonts, with system fallbacks.

This project is not affiliated with Drake, OVO, or the referenced music services.
