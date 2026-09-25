# DRAKE // 6IX FILES

A responsive, data-driven Drake discography site built from `data/drizzy.csv`.

## Structure

```text
index.html
css/
  styles.css
js/
  app.js
  data.js        # generated from the CSV
assets/
  favicon.svg
data/
  drizzy.csv     # original source data
scripts/
  build-data.py  # rebuilds js/data.js after CSV edits
```

## Run it

You can open `index.html` directly in a browser. For local development, a small local server is cleaner:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Update the songs

1. Replace or edit `data/drizzy.csv` while keeping the same column names.
2. Run:

```bash
python3 scripts/build-data.py
```

3. Refresh the page.

The site supports search, release/year filters, explicit-track filtering, multiple sorting modes, pagination, Spotify track links, random-track discovery, and track-level audio-feature views.

## Notes

This is an independent fan-built project. Artist names, song titles, album titles, labels, and Spotify identifiers remain the property of their respective owners. No album artwork or artist photography is bundled into the site.
