# Shed Estimator

## Run locally

Use a static server from the repository root so ES modules and JSON data load correctly:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/src/assemblies/shedest/shedestimator.html
```

## Main files

- `shedestimator.html` — static app shell, preserved input IDs, config accordions, viewport, Assembly Inspector, and estimate drawer.
- `styles.css` — dark glass/blueprint interface, responsive app shell, mode rail, inspector, warnings, and drawer styling.
- `js/app.js` — app bootstrap, estimate render cycle, UI synchronization, warnings, assembly/estimate inspector, and model-to-estimate linking.
- `js/state.js` — legacy calculator state readers/writers plus normalized project state helpers for new UI features.
- `js/warnings.js` — advisory warning rules for dimensions, openings, roof/foundation choices, Alaska freight/labor defaults, and finish consistency.
- `three/scene.js` — Three.js scene, lighting, geometry, visual modes, raycaster selection/hover, object metadata, and camera presets.

## State model summary

The legacy calculators still use the existing `geom`, `walls`, `interior`, `openings`, `roof`, `foundation`, `logistics`, and `labor` state shape. `js/state.js` adds a normalized `defaultShedState` and subscription helpers (`readStateFromInputs`, `writeStateToInputs`, `updateState`, `subscribeToState`, `getCurrentState`) so newer UI and trace features can evolve without breaking existing formulas.

## Visual modes

The mode rail now exposes Finished, Framing, Foundation, Roof, Exploded, Blueprint, Impact, X-Ray, and Skeleton modes. The original `#visualMode` select remains for compatibility and is synchronized by the mode buttons.

## Model / estimate trace metadata

Selectable Three.js objects receive `userData` fields such as `objectId`, `assemblyId`, `assemblyType`, `phase`, `estimateItemIds`, and `label`. Estimate rows are enriched at render time with stable IDs, assembly grouping, linked object IDs, quantity basis text, cost split, assumptions, and lightweight trace objects.

## Known limitations

- The first pass maps estimate rows to major assemblies by item naming. It is intentionally conservative and should be refined into calculator-native item IDs over time.
- Labor cost is allocated across detailed estimate rows by material-cost share for trace display; aggregate labor calculation remains unchanged.
- Dimension labels are Three.js sprite overlays and can become dense on very small screens.
- The estimate table is still rendered from existing takeoff rows; deeper grouping/export enhancements can be added without heavy dependencies.

## Recommended next improvements

1. Move metadata IDs into each calculator module so rows are born with stable assembly IDs instead of inferred from names.
2. Add true grouped estimate table sections in the drawer with CSV/JSON/copy exports.
3. Add optional camera easing with reduced-motion safeguards.
4. Add per-assembly material isolation/outline rendering for stronger selected states.
5. Add automated browser smoke tests for all visual modes and representative shed scenarios.
