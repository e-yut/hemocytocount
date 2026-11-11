# hemocytocount v0.2

A mobile-friendly web app for calculating cells per mL and % viability from Neubauer haemocytometer counts using the dye exclusion principle (e.g. trypan blue).

**Live app:** https://e-yut.github.io/hemocytocount/

## Features

- Haemocytometer grid with a **live** and a **dead** count box for each of the five large squares (four corners and the centre)
- Calculations adjust to the number of squares actually counted (a square left blank is ignored; an entered 0 is included)
- Virtual tally clicker with an audible click (can be muted), undo buttons and multi-touch support (Live and Dead can be pressed together), plus a Lock page button that disables scrolling while you count
- Live cells/mL, dead cells/mL, total cells/mL and % viability, in scientific or standard notation
- Editable results: type live, dead or total cells/mL counted elsewhere (e.g. `1.2e6`) and the rest follows; tap a value to highlight it, or use its copy button
- Total cell number from the resuspension volume (mL)
- Editable dilution factor (default 2, for a 1:1 mix with dye)
- Collapsible calculator for the volume of suspension needed for a given number of live cells
- Collapsible plate seeding planner: choose a plate, dish or flask (with suggested media volumes), the number of wells, the target live cells per well and a % excess, and get either the media and cell suspension volumes to add to each well, or the volumes for one diluted mix to dispense into every well
- Instructions pop-up with brief theory, counting rules and sample preparation
- Reset button, light/dark mode, and counts saved in the browser between visits

## Calculation

Each large square is 1 mm x 1 mm x 0.1 mm deep = 0.1 uL, so:

```
cells/mL    = (cells counted / squares counted) x dilution factor x 10^4
viability % = live / (live + dead) x 100
total cells = cells/mL x resuspension volume (mL)
volume (mL) = cells required / live cells per mL

Plate seeding, per well:
  cell suspension = target cells per well / live cells per mL
  media           = final volume per well - cell suspension
Plate seeding, diluted mix (dispense the final volume per well):
  total volume    = final volume per well x wells x (1 + excess % / 100)
  cell suspension = target cells per well x wells x (1 + excess % / 100) / live cells per mL
  media           = total volume - cell suspension
```

## Run locally

No build step or dependencies. Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
```

## Reference

Suggested media volumes and seeding densities for culture vessels are from Thermo Fisher, [Useful numbers for cell culture](https://www.thermofisher.com/uk/en/home/references/gibco-cell-culture-basics/cell-culture-protocols/cell-culture-useful-numbers.html).

## Licence

MIT. Developed by [Eylan Yutuc](https://github.com/e-yut/hemocytocount).
