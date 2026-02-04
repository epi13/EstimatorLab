# 🧮 EstimatorLab

EstimatorLab is a collection of modular estimation tools designed for real-world construction and engineering workflows — built to streamline takeoffs, budgeting, and field calculations across all trades.

Created and maintained by **Poor Louis Labs**, this project aims to make estimating accessible, flexible, and transparent, using lightweight, browser-based calculators that can be hosted anywhere — from GitHub Pages to offline jobsite laptops...

---

## 📦 Overview

EstimatorLab provides a growing library of interactive HTML/JavaScript calculators for the major construction divisions:

| Division | Estimator |
|-----------|------------|
| 01 | General Requirements |
| 02 | Sitework / Utilities |
| 03 | Concrete |
| 04 | Exterior Closure |
| 05 | Roofing Systems |
| 06 | Interior Construction |
| 07 | Conveying Systems |
| 08 | Mechanical |
| 09 | Electrical |
| 10 | Equipment |
| 11 | Special Construction |

Each tool is designed to be:
- **Fast and offline-capable** – Runs locally in any modern browser.
- **Transparent** – All calculations visible and editable.
- **Customizable** – Inputs, rates, and assumptions can be tailored to regional or project-specific conditions.
- **Modular** – Each estimator is a standalone HTML file but shares a consistent layout, logic, and export format.

---

## 🧰 Features

- Material and labor breakdowns with adjustable unit rates  
- Auto-calculated total and per-unit pricing  
- Man-hour and crew productivity modeling  
- Optional toggles for abatement, demolition, or testing  
- CSV and JSON export for integration into estimating systems  
- Responsive design for desktop and mobile use  
- Simple versioning for field validation and audits  

---

## 🚀 Getting Started

### Run Locally
Clone the repository:

```bash
git clone https://github.com/epi13/EstimatorLab.git
cd EstimatorLab
```

Then simply open any estimator in your browser:

```bash
open 08_Mechanical.html
```

or drag the file directly into your browser window.

### REPLCalc (Estimator REPL)

EstimatorLab includes an interactive, browser-based REPL for unit-aware calculations, scripting, and graphics demos.

- Open: `src/REPLCalc/estimator-repl.html`
- In the REPL, run `:docs` for the built-in help page.
- Run `:doom` to launch the gfx loop demo.

Runtime notes:

- Some functions are side-effecting and are categorized by effect groups: `PURE`, `IO_GFX`, `STATE`, `RNG`, `TIME`.
- Disallowed effects throw errors prefixed with `ERR[E_EFFECT]`.
- Random sampling can be made deterministic for the session with `seed(n)`.
- Type/unit errors are prefixed with `ERR[E_TYPE]` and `ERR[E_DIM]`.

### Host Online
EstimatorLab can be hosted directly via **GitHub Pages** or any static web host.  
To enable Pages:

1. Go to your repository’s **Settings → Pages**  
2. Set source to `main` branch → `/ (root)`  
3. Access your tools via `https://yourusername.github.io/EstimatorLab/`

---

## 🧩 Repository Structure

```
EstimatorLab/
├── 01_General_Requirements.html
├── 02_Sitework.html
├── 03_Concrete.html
├── ...
├── assets/
│   ├── css/
│   ├── js/
│   └── data/
├── docs/
│   ├── changelog.md
│   ├── contributing.md
│   └── roadmap.md
└── index.html  ← Main dashboard / navigation hub
```

---

## 🧠 Future Plans

- Unified **dashboard interface** for selecting and managing estimators  
- **Analytics panel** to summarize material/labor distribution across trades  
- Integration with **XLSX/CSV import/export** for bid packages  
- **Offline mode (PWA)** for field deployment  
- **Versioned cost data sets** (regional, remote, and rural Alaska factors)  

---

## 🛠️ Development Notes

EstimatorLab tools are built using:
- **HTML5** for structure  
- **Vanilla JavaScript** for logic  
- **CSS3 / Tailwind** (optional) for styling  

Each estimator follows a consistent data schema:

```json
{
  "division": "08 - Mechanical",
  "section": "083 - HVAC",
  "items": [
    {
      "name": "Install rooftop unit",
      "unit": "EA",
      "quantity": 1,
      "material_rate": 3500,
      "labor_rate": 1200
    }
  ]
}
```

---

## 🤝 Contributing

Contributions are welcome — whether it’s new estimators, data improvements, or UI tweaks.

1. Fork the repo  
2. Create a new branch (`feature/your-estimator`)  
3. Submit a pull request with clear notes  

For larger feature requests, please open an issue to discuss before starting work.

---

## 📜 License

MIT License © 2025 [Poor Louis Labs](https://www.poorlouislabs.com)  
Created and maintained by Alexander Collamore

---

## 🌲 About Poor Louis Labs

**Poor Louis Labs** is the R&D branch of [Poor Louis Farms](https://www.poorlouisfarms.com), dedicated to engineering and software projects that combine practical craftsmanship, data transparency, and Alaskan resilience.

EstimatorLab is part of our ongoing initiative to modernize construction workflows and make field-ready digital tools open and accessible.

---
