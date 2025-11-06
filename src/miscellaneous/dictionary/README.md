
# Regex & Dictionary Lab — CSI-aware

A lightweight, dependency-free HTML/JS tool to curate *regex patterns* and *domain dictionaries* per CSI category.
Runs locally or on GitHub Pages. Lets you **load/edit/save JSON**, and **live-test** regexes with named groups -> field maps.

## Features
- Per-CSI **categories** with keywords, synonyms, UOM hints, and dimension presets.
- Named-group **regex patterns** with a **field map** (`field:groupName`) for structured extraction.
- **Live Regex Tester**: paste spec/submittal snippets and see matches + captured fields.
- **Import/Export JSON** (download) + **File System Access API** open/save (Chrome/Edge).
- JSON source pane for power users: paste JSON and click *Apply* to hydrate the editor.

## Use
1. Open `index.html` locally or serve via GitHub Pages.
2. Click **Load JSON** to import `dictionaries.json` or your own.
3. Edit categories, add patterns, and test against your text.
4. **Download JSON** to save; commit it to your repo as needed.

## JSON Schema (informal)
```jsonc
{
  "version": "0.1.0",
  "globals": { "uoms": ["LF","SF","EA","HR","FT","GAL","LB"] },
  "categories": [{
    "code": "08 30 00",
    "name": "HVAC — VRF Copper Piping",
    "keywords": ["VRF","refrigerant","copper","Type L","piping","pipe"],
    "synonyms": { "cu": "copper", "Ø": "diameter" },
    "uom_hints": ["LF","EA"],
    "dimensions": ["1/4\"","3/8\"","..."],
    "patterns": [{
      "name": "dim_mat_uom_line",
      "desc": "Capture dim, material, UOM from line",
      "regex": "(?<dim>...) ... (?<uom>LF|EA)",
      "flags": "gim",
      "fields": "dimension:dim, material:mat, uom:uom"
    }]
  }]
}
```

## Notes
- Named capture groups (`(?<name>...)`) are required to route to fields.
- The **fields map** is a comma-separated `field:group` list.
- Keep regex portable to JS (ECMAScript) when testing here.
- For Python ingestion, you can compile these patterns in `re` with `(?P<name>...)` substitution if needed.
