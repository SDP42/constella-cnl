# Data sources — what's free, what's licensed, where it lives

Constella runs on **synthetic CNL data** for the hackathon. In production every synthetic table maps to a real source below. The map and twin features use **only free and open layers at runtime**. They are streamed tiles: nothing is bundled or redistributed.

## 1. Imagery and basemaps (used live in the Territory Twin and the landing globe)

| Layer | Provider | Licence | Commercial use | Attribution shown in app |
|---|---|---|---|---|
| True-colour satellite mosaic (10 m) | EOX **Sentinel-2 cloudless** (s2maps.eu), WMTS | CC BY-NC-SA 4.0 (2018+ releases); 2016 release CC BY 4.0 | Needs an EOX commercial licence (cloudless@eox.at) | "Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)" |
| Night lights (500 m) | **NASA GIBS** `VIIRS_Black_Marble`, `VIIRS_Night_Lights` | NASA open data policy, free, attribution requested | Yes | "Imagery: NASA GIBS / Black Marble" |
| Daily true colour | NASA GIBS `MODIS_Terra_CorrectedReflectance_TrueColor`, `BlueMarble_ShadedRelief_Bathymetry` | Same | Yes | "NASA GIBS" |
| Street basemap | **OpenFreeMap** / OpenStreetMap vector tiles | ODbL (data), free tiles | Yes | "© OpenStreetMap contributors" |
| Points of interest (schools, hospitals, offices, banks, malls) | **OSM Overpass API** | ODbL | Yes (share-alike on derived DBs) | "© OpenStreetMap contributors" |

The GIBS endpoint pattern is `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{date}/{TileMatrixSet}/{z}/{y}/{x}.{ext}`.

The backend proxies and caches Overpass for 24 h, so the public instance is not hammered. If Overpass is unreachable, it falls back to a deterministic synthetic POI set.

### Footage

The landing section "Solutions in the field" uses 132 frames (22 per clip, 1152 px JPEG, ~5.4 MB). They were extracted from six clips under the **Pexels License** (free for commercial use, attribution not required; credited here anyway):

| Shot | Pexels video | Creator |
|---|---|---|
| Distribution data | Man doing inventory at the warehouse on a tablet, #4292901 | Tiger Lily |
| Intelligence | Futuristic data visualisation dashboard, #34129037 | Chandresh Uike |
| Smart Classroom | Classroom instruction using interactive whiteboard, #33747500 | Gokuldham Nar |
| Smart City & Campus Security | High-tech control room with multiple CCTV monitors, #38779095 | Kiwi and Camera |
| Hybrid Meeting Room | Woman using a laptop at the office, #7224727 | MART PRODUCTION |
| Network + annuity | Blue coloured cables, #1085656 | Dima Krivoy |

The same six clips are the backgrounds of the story scenes in the pitch video (`deliverables/Constella_PS1_Pitch.mp4`).

### Pitch video voiceover

The female narration is synthesised locally with **Kokoro-82M** (voice `af_heart`) through `kokoro-onnx`; the model and its voices are released under the **Apache-2.0** licence. The live part of the video is a screen capture of the Constella prototype itself.

## 2. Indian open data (demand side: who could buy what, where)

| Dataset | Source | Licence | Use in Constella |
|---|---|---|---|
| State and district boundaries | DataMeet maps; ramSeraph/indian_admin_boundaries | CC BY 4.0 / CC0 | Territory polygons, rep coverage |
| Schools (≈14 lakh points) | UDISE+ via data.gov.in; DataMeet `udise_schools` | GODL-India (ODbL-compatible) | Smart-classroom whitespace. Coordinates are noisy, so we snap them to the district |
| Health facilities | HDX "India Health Facilities (OSM export)"; NHA/PMJAY lists | ODbL / GODL | Clinic-IT and surveillance bundles |
| Education facilities | HDX HOTOSM education export | ODbL | Same as schools |
| Smart Cities Mission projects | smartcities.gov.in, data.gov.in | GODL | Smart-city security pipeline (Infinova) |
| GeM tenders | gem.gov.in (public bid listings) | Public notices; scrape within ToS | Tender matching in the Operations hub |
| Census / PCA, district GDP | censusindia.gov.in, MoSPI | GODL | Normalising wallet by district potential |
| Night lights as an economic-activity proxy | NASA Black Marble (above) | Open | Prior for district demand where data is thin |

## 3. Data about Creative Newtech itself

| What | Where | Access |
|---|---|---|
| Revenue, segment mix, EBITDA, NWC days, brand wins | NSE/BSE filings, investor presentations, earnings-call transcripts (Q2 FY27) | Public |
| Company master, directors, charges | MCA21 | Public (paid for bulk) |
| Branch and warehouse addresses | GST registrations (one GSTIN per state), annual report | Public / GST portal |
| Partner ledger, invoices, credit limits | CNL ERP | **Internal, licensed** — the real feed for `Transaction`, `Account` |
| Partner GSTIN validation, e-invoice status | GSTN via a licensed **GSP** (GST Suvidha Provider) API | Licensed, per-call |
| Business credit bureau | CRIF / CIBIL Commercial | Licensed |
| Distributor sell-out / sell-in | Brand principal portals (Honeywell, Super Micro, etc.) | Under distributor agreement |
| Marketplace demand (WOZOYO) | Amazon/Blinkit/Swiggy seller dashboards | Internal |

## 4. Pretrained models

| Model | Purpose | Licence | Status |
|---|---|---|---|
| scikit-learn HistGradientBoosting + isotonic calibration | Buy-propensity scoring | BSD | Trained on startup and retrained on feedback / new orders |
| TF-IDF + truncated SVD (LSA) | RAG retrieval, semantic intent matching | BSD | Fitted on our own corpus, nothing downloaded |
| `sentence-transformers/all-MiniLM-L6-v2` (≈90 MB) | Optional dense embeddings for RAG | Apache-2.0 | **Optional**. Off unless installed; the app works without it |
| Claude (Anthropic API) | Copilot reasoning and pitch drafting | Commercial API | Used when `ANTHROPIC_API_KEY` is set; offline graph otherwise |

## 5. Compliance notes

- **ODbL** (OSM): if we ship a *derived database* (e.g. scored POIs), it must be offered under ODbL. Internal use and map display only need attribution.
- **EOX S2 cloudless** is non-commercial. A production deployment at CNL needs either the EOX commercial licence or a switch to NASA GIBS / Esri World Imagery under licence. The layer is a single config switch (`VITE_SAT_TILES`).
- No personal data goes to any tile or Overpass request. Queries contain only a bounding box.
- DPDP Act 2023: partner contacts stay inside CNL systems. See the Data trust screen.

## Sources

- NASA GIBS — https://www.earthdata.nasa.gov/gibs ; layer lists at https://wiki.earthdata.nasa.gov/display/GIBS
- EOX Sentinel-2 cloudless — https://s2maps.eu ; https://eox.at/2017/03/sentinel-2-cloudless/ ; https://eox.at/2024/08/sentinel-2-cloudless-2023/
- Open geospatial data from GoI — https://wiki.openstreetmap.org/wiki/Open_Geospatial_Data_from_Government_of_India
- India data sources (OSM wiki) — https://wiki.openstreetmap.org/wiki/India/Data_sources
- ramSeraph boundaries — https://github.com/ramSeraph/indian_admin_boundaries
- DataMeet UDISE discussion — https://groups.google.com/g/datameet/c/KUUEqHW4D20
- india-geodata bundle — https://github.com/yashveeeeeeer/india-geodata
- HDX India Health Facilities (OSM export) — https://data.humdata.org
