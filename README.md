# THE MERIDIAN — cinematic single-property site

A self-contained static website (no build step, no dependencies) for a fictional
$12.5M penthouse on the 60th floor in Tel Aviv, featuring a scroll-scrubbed
cinematic video tour.

## Run locally

```sh
node serve.mjs
# → http://localhost:4173
```

Any static server works **as long as it supports HTTP Range requests** — browsers
refuse to seek (and therefore to scrub) video served without them, which rules out
`python3 -m http.server`. `serve.mjs` is a dependency-free range-capable server.

## Deploy

Pure static site rooted at this directory — import the repo into Vercel (or
Netlify / GitHub Pages) as-is; no framework, no build command, output = root.

## How the tour works

`media/tour.mp4` / `media/tour.webm` is one continuous 38s video assembled from four
Seedance 2.0 clips (The Approach → The Arrival → The Flow → The Terrace). The clips
were chained at generation time: each clip's final frame is the exact start frame of
the next (shared `end_image`/`start_image` keyframes), so the cut points are invisible.

The video is re-encoded with a keyframe every 6 frames (0.25s) so the browser can
seek to arbitrary times instantly. `app.js` maps scroll progress inside the `.tour`
section to a playhead target and chases it with a critically-damped rAF loop —
scrolling scrubs the camera through the home. `media/tour.json` carries the real
chapter boundaries for the fixed progress rail.

## Media

All imagery is AI-generated (Higgsfield: Nano Banana Pro stills, Seedance 2.0 video,
Soul portrait). `media-sources.txt` lists the original CDN URLs. The `media-raw`
branch holds the original generation-quality sources (1080p MP4s, 2K PNGs) for
future re-editing.
