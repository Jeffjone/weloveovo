from pathlib import Path
import csv, json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "drizzy.csv"
TARGET = ROOT / "js" / "data.js"

COLUMN_MAP = {
    "#": "rank", "Song": "song", "Artist": "artist", "BPM": "bpm", "Camelot": "camelot",
    "Energy": "energy", "Added At": "addedAt", "Duration": "duration", "Popularity": "popularity",
    "Genres": "genres", "Parent Genres": "parentGenres", "Album": "album", "Album Date": "albumDate",
    "Dance": "dance", "Acoustic": "acoustic", "Instrumental": "instrumental", "Valence": "valence",
    "Speech": "speech", "Live": "live", "Loud (Db)": "loudDb", "Key": "key",
    "Time Signature": "timeSignature", "Spotify Track Id": "spotifyTrackId", "Label": "label",
    "ISRC": "isrc", "Explicit": "explicit"
}
NUMERIC = {"rank", "bpm", "energy", "popularity", "dance", "acoustic", "instrumental", "valence", "speech", "live", "loudDb", "timeSignature"}

with SOURCE.open(newline="", encoding="utf-8-sig") as fh:
    reader = csv.DictReader(fh)
    rows = []
    for raw in reader:
        raw = {str(k).strip(): v for k, v in raw.items()}
        item = {}
        for source, target in COLUMN_MAP.items():
            value = raw.get(source, "")
            if target in NUMERIC and value != "":
                value = int(float(value))
            item[target] = value
        rows.append(item)

TARGET.write_text(
    "// Auto-generated from data/drizzy.csv. Run scripts/build-data.py after replacing the CSV.\n"
    + "window.DRAKE_SONGS = "
    + json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(f"Built {TARGET.relative_to(ROOT)} from {len(rows)} CSV rows.")
