# hemocytocount v0.1

A mobile-friendly web app for calculating cells per mL and % viability from Neubauer haemocytometer counts using the dye exclusion principle (e.g. trypan blue).

**Live app:** https://e-yut.github.io/hemocytocount/

## Features

- Haemocytometer grid with a **live** and a **dead** count box for each of the five large squares (four corners and the centre)
- Calculations adjust to the number of squares actually counted (a square left blank is ignored; an entered 0 is included)
- Virtual tally clicker with an audible click (can be muted) and undo buttons
- Live cells/mL, dead cells/mL, total cells/mL and % viability, in scientific or standard notation
- Total cell number from the resuspension volume (mL)
- Editable dilution factor (default 2, for a 1:1 mix with dye)
- Collapsible calculator for the volume of suspension needed for a given number of live cells
- Instructions pop-up with brief theory, counting rules and sample preparation
- Reset button, light/dark mode, and counts saved in the browser between visits

## Calculation

Each large square is 1 mm x 1 mm x 0.1 mm deep = 0.1 uL, so:

```
cells/mL    = (cells counted / squares counted) x dilution factor x 10^4
viability % = live / (live + dead) x 100
total cells = cells/mL x resuspension volume (mL)
volume (mL) = cells required / live cells per mL
```

## Run locally

No build step or dependencies. Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
```

## Licence

MIT. Developed by [Eylan Yutuc](https://github.com/e-yut/hemocytocount).
