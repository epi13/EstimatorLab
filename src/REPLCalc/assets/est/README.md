# EST DSL Module Structure

This directory contains the organized EST DSL modules following the project architecture rules.

## Directory Structure

### `core/`
- `constants.est` - Core constants and unit definitions shared across systems

### `math/`
- `math-helpers.est` - Mathematical functions (sign, frac, lerp, smoothstep, rnd)

### `geometry/`
- `geometry-helpers.est` - Spatial calculations, collision detection, movement physics

### `traversal/`
- `map-traversal.est` - Map analysis, tile counting, coordinate utilities, flood fill

### `systems/`
- `player-system.est` - Player movement, input processing, collision resolution
- `combat-system.est` - Weapon mechanics, raycasting, damage calculation
- `monster-system.est` - Monster AI, movement behavior, proximity damage
- `metrics-system.est` - Level analysis, construction takeoffs, MEP calculations

### `textures/`
- `texture-helpers.est` - Procedural texture generation utilities
- `doom-textures.est` - Specific Doom texture implementations
- `rendering-helpers.est` - Camera setup, 3D/2D rendering, HUD display

## Architecture Principles

- **est files** contain logic, math, traversal, systems, rules, and data transforms
- **JavaScript files** handle rendering, I/O, DOM, engine hooks, and glue code
- Functions are small, composable, and engine-agnostic
- No deep nesting - organized by function, not feature
- Consistent naming and predictable structure

## Migration Summary

### Completed Refactoring:
- ✅ Mathematical functions moved to `est/math/`
- ✅ Geometry and collision logic moved to `est/geometry/`
- ✅ Player movement system extracted to `est/systems/player-system`
- ✅ Combat system extracted to `est/systems/combat-system`
- ✅ Monster AI system extracted to `est/systems/monster-system`
- ✅ Metrics calculation system extracted to `est/systems/metrics-system`
- ✅ Texture generation modularized into `est/textures/`
- ✅ Rendering helpers extracted to `est/textures/rendering-helpers`
- ✅ Map traversal utilities created in `est/traversal/`
- ✅ Core constants centralized in `est/core/`

### Code Organization:
- **systems/doom-demo.est**: Main game loop, now uses modular imports
- **textures/doom-proc-textures.est**: Simplified to use texture helper modules
- **JavaScript files**: Focus on orchestration, runtime, and rendering infrastructure

## File Locations

### Main Game Files:
- `systems/doom-demo.est` - Primary game loop and logic
- `textures/doom-proc-textures.est` - Texture generation interface

### Supporting Modules:
- `math/latent-mux-walker.est` - Latent space traversal utilities
- `math/math-helpers.est` - Mathematical functions
- `geometry/geometry-helpers.est` - Spatial calculations
- `traversal/map-traversal.est` - Map analysis utilities
- `systems/player-system.est` - Player movement and controls
- `systems/combat-system.est` - Weapon mechanics and combat
- `systems/monster-system.est` - Monster AI and behavior
- `systems/metrics-system.est` - Construction metrics and takeoffs
- `textures/texture-helpers.est` - Procedural texture utilities
- `textures/doom-textures.est` - Specific texture implementations
- `textures/rendering-helpers.est` - Camera and rendering functions
- `core/constants.est` - Shared constants and units

## Usage

Modules are loaded by JavaScript in dependency order:

1. **Core**: constants
2. **Math**: latent-mux-walker, math-helpers
3. **Geometry**: geometry-helpers
4. **Traversal**: map-traversal
5. **Systems**: player-system, combat-system, monster-system, metrics-system
6. **Textures**: texture-helpers, doom-textures, rendering-helpers, doom-proc-textures
7. **Main**: doom-demo (game loop)

The JavaScript loader in `repl-doom.js` handles all module loading using the `applyModuleSource` function, which processes EST DSL files and makes their functions available in the runtime environment.
