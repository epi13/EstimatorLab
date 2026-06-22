# Shed Estimator Current App Flow

- **Input controls:** `shedestimator.html` owns the static form controls. JavaScript currently reads values by ID in `js/state.js` (`readStateFromUI`) and writes reset defaults through `applyStateToUI`.
- **State shape:** The legacy runtime state is grouped as `geom`, `walls`, `interior`, `openings`, `roof`, `foundation`, `logistics`, and `labor`. `js/state.js` now also exposes a normalized `defaultShedState` plus adapters so new UI features can subscribe to one current state without replacing the legacy calculators.
- **Render/update cycle:** `js/app.js` loads JSON material/freight/labor data, creates the Three.js scene, attaches form listeners, then calls `computeAndRender()` after input changes.
- **Estimate output cycle:** `computeAndRender()` builds takeoff rows with `js/calc/takeoff.js`, applies freight/handling in `js/calc/costing.js`, calculates labor in `js/calc/labor.js`, builds cut sheets, and renders summary outputs/tables in `js/app.js`.
- **3D render cycle:** `three/scene.js` creates the WebGL renderer, camera, lights, grid, orbit controls, raycaster, selectable meshes, and rebuilds the shed model from state on each calculation.
- **Visual modes:** The legacy `#visualMode` select controls the scene mode. The visible mode rail updates that select and triggers the same render path.
- **Selection:** `three/scene.js` raycasts selectable meshes and dispatches `shed-element-selected`; `js/app.js` listens and synchronizes the Assembly Inspector and estimate rows.
