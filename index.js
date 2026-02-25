const navigationData = [
      {
        title: 'Quick Access',
        icon: 'sparkles',
        startOpen: true,
        calculators: [
          { label: 'Home', href: 'src/REPLCalc/estimator-repl.html', keywords: 'repl calculator' },
          { label: 'JSON Search', href: 'src/search/fuzzy_search.html', keywords: 'data fuzzy finder' },
          { label: 'Unit Conversion', href: 'src/miscellaneous/unitConvert/units.html', keywords: 'measurements conversions' },
          { label: 'Scaler', href: 'src/miscellaneous/high-level-scaler/high-level-scaler.html', keywords: 'high level scaler' },
          { label: 'Pricebook', href: 'src/pricebook/pricebook_editor.html', keywords: 'pricebook editor' },    
          { label: 'PDF Extractor', href: 'src/pdf/extractor/extract.html', keywords: 'export data' }
           
          
        ]
      },
          {
        title: 'Utilities',
        icon: 'clipboard',
        calculators: [
           { label: 'XLSX to LLM', href: 'src/miscellaneous/xlsx-to-llm/xlsx-to-llm.html', keywords: 'llm token saver' },   
           { label: 'Dictionary', href: 'src/miscellaneous/dictionary/index.html', keywords: 'dictionary' },
           { label: 'Cost Engine', href: 'src/ancfe/index.html', keywords: 'cost engine' },
           { label: 'Plan Diff', href: 'src/plandiff/index.html', keywords: 'plan diff' },   
           { label: 'MarkDown Editor', href: 'src/miscellaneous/MarkDownEditor/markdown.html', keywords: 'markdown editor' }
        ]
      },
      {
        title: 'Take-off',
        icon: 'clipboard',
        calculators: [
          { label: 'Take Off', href: 'src/take_off/takeOff/takeOff.html', keywords: 'quantity estimator' },
          { label: 'Tables', href: 'src/take_off/gridTO/gridTO.html', keywords: 'grid reference' }
        ]
      },
      {
        title: 'Volume',
        icon: 'cube',
        calculators: [
          { label: 'Volume from SF', href: 'src/volume/vFromSF/vFromSF.html', keywords: 'square footage depth' },
          { label: 'Volume from L×W×H', href: 'src/volume/wireframe-box/wireframe-box.html', keywords: 'length width height' },
          { label: 'Trench Excavation Calculator', href: 'src/volume/trenchV/trenchV.html', keywords: 'excavation earthwork' },
          { label: 'Concrete Filled Decking', href: 'src/volume/pan_concrete/pan_concrete.html', keywords: 'pan decking slab' },
          { label: 'Composite Volume', href: 'src/volume/composite-volume/composite-volume.html', keywords: 'composite volume' }
        ]
      },
      {
        title: 'Area',
        icon: 'ruler',
        calculators: [
          { label: 'Area of Triangle', href: 'src/area/triangle/triangle_area.html', keywords: 'geometry surface' }
        ]
      },
      {
        title: 'Weight',
        icon: 'scale',
        calculators: [
          { label: 'Dry Weight Calculator', href: 'src/weight/fill_weight/fill_weight.html', keywords: 'fill soil' },
          { label: 'Metal Weight Calculator', href: 'src/weight/metal_weight/metal_weight.html', keywords: 'metals density' },
          { label: 'Rebar Calculator', href: 'src/weight/rebar_weight/rebar_weight.html', keywords: 'reinforcement steel' },
          { label: 'Machine Weight', href: 'src/weight/machine_weight/machine_weight.html', keywords: 'equipment load' }
        ]
      },
      {
        title: 'Structural',
        icon: 'beam',
        calculators: [
          { label: 'Welding', href: 'src/structural/welding/welding.html', keywords: 'joinery fabrication' }
        ]
      },
      {
        title: 'Finishes',
        icon: 'palette',
        calculators: [
          { label: 'Paint and Coatings', href: 'src/finishes/coatings/coatings.html', keywords: 'paint finish' },
          { label: 'Flooring', href: 'src/finishes/flooring/flooring.html', keywords: 'floor coverings' }
        ]
      },
      {
        title: 'Electrical',
        icon: 'bolt',
        calculators: [
          { label: 'Electrical Calculator', href: 'src/electrical/electrical_calculator/electrical_calculator.html', keywords: 'power circuits' },
          { label: 'Network Devices', href: 'src/electrical/telecom/telecom.html', keywords: 'telecom communications' },
          { label: 'Panelboard Pricing', href: 'src/electrical/panelboard/panelboard.html', keywords: 'panel schedules' },
          { label: 'Service Calculator', href: 'src/electrical/service/service.html', keywords: 'distribution load' },
          { label: 'Lighting Fixtures', href: 'src/electrical/lighting/index.html', keywords: 'lighting fixtures' }
        ]
      },
      {
        title: 'Mechanical',
        icon: 'fan',
        calculators: [
          { label: 'Boilers', href: 'src/mechanical/boiler/boiler.html', keywords: 'heating systems' },
          { label: 'DDC', href: 'src/mechanical/ddc/ddc.html', keywords: 'controls automation' },
          { label: 'Fuel Systems', href: 'src/mechanical/fuel/fuel.html', keywords: 'storage piping' },
          { label: 'Gas Systems', href: 'src/mechanical/gas/gas.html', keywords: 'gas piping' },
          { label: 'Medical Gas', href: 'src/mechanical/medical_gas/medical_gas.html', keywords: 'medical gas systems' },
          { label: 'Septic System', href: 'src/mechanical/septic/septic.html', keywords: 'wastewater treatment' },
          { label: 'Steam Systems', href: 'src/mechanical/steam/steam.html', keywords: 'steam heating systems' }
        ]
      },
      {
        title: 'Ventilation',
        icon: 'wind',
        calculators: [
          { label: 'Vents and Diffuser', href: 'src/ventilation/diffuser/diffuser.html', keywords: 'air distribution' },
          { label: 'Ducting', href: 'src/ventilation/ducting/ducting.html', keywords: 'airflow ductwork' }
                 ]
      },
      {
        title: 'Fire',
        icon: 'flame',
        calculators: [
          { label: 'Fire Alarm', href: 'src/fire/alarm/alarm.html', keywords: 'life safety' },
          { label: 'Fire Suppression', href: 'src/fire/suppression/suppression.html', keywords: 'sprinkler' }
        ]
      },
      {
        title: 'Assemblies',
        icon: 'layers',
        calculators: [
          { label: 'Shed Estimator', href: 'src/assemblies/shedest/shedestimator.html', keywords: 'simple model estimator' },
          { label: 'Door Calculator', href: 'src/assemblies/doors/doors.html', keywords: 'openings hardware' },
          { label: 'Insulation', href: 'src/assemblies/insulation/insulation.html', keywords: 'thermal envelope' },
          { label: 'OC Linear Ft', href: 'src/assemblies/OC_linear_ft/OC_linear_ft.html', keywords: 'on center spacing' }
        ]
      },
      {
        title: 'Logistics',
        icon: 'route',
        calculators: [
          { label: 'Freight', href: 'src/logistics/freight/index.html', keywords: 'shipping transport' },
          { label: 'Labor', href: 'src/logistics/perDiem/labor.html', keywords: 'workforce staffing' }
        ]
      },
      {
        title: 'Hazmat',
        icon: 'alert-triangle',
        calculators: [
          { label: 'Asbestos', href: 'src/hazmat/asbestos/asbestos.html', keywords: 'asbestos abatement removal' },
          { label: 'Lead', href: 'src/hazmat/lead/lead.html', keywords: 'lead paint removal abatement' },
          { label: 'PCB', href: 'src/hazmat/pcb/pcb.html', keywords: 'polychlorinated biphenyl cleanup' },
          { label: 'Fuel Remediation', href: 'src/hazmat/fuel/fuel_remediation.html', keywords: 'fuel contamination cleanup' }
        ]
      }
    ];

    const iconPaths = {
      sparkles: 'M12 2a1 1 0 0 1 .894.553l1.618 3.342l3.695.537a1 1 0 0 1 .554 1.71l-2.671 2.605l.63 3.672a1 1 0 0 1-1.451 1.054L12 13.861l-3.268 1.72a1 1 0 0 1-1.451-1.054l.63-3.672L5.24 8.142a1 1 0 0 1 .554-1.71l3.695-.537l1.618-3.342A1 1 0 0 1 12 2Z',
      clipboard: 'M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9Zm1 2h4v1h-4V4Z',
      document: 'M7 2h7l5 5v11a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Zm7 2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9h-3a2 2 0 0 1-2-2V4Z',
      cube: 'M11.447 1.276a1 1 0 0 1 1.106 0l8 5.2A1 1 0 0 1 21 7.333v9.334a1 1 0 0 1-.447.857l-8 5.2a1 1 0 0 1-1.106 0l-8-5.2A1 1 0 0 1 3 16.667V7.333a1 1 0 0 1 .447-.857l8-5.2ZM5 8.28v7.053l6 3.9V12.18L5 8.28Zm14 0-6 3.9v7.053l6-3.9V8.28ZM12 3.086L6.197 7L12 10.914L17.803 7L12 3.086Z',
      ruler: 'M20 3a1 1 0 0 1 1 1v13.5a2.5 2.5 0 0 1-3.984 2.005L3.28 12.88a2.5 2.5 0 0 1 0-3.535L15.35 2.273A1 1 0 0 1 16 2h4Zm-2 2h-1v1a1 1 0 0 1-2 0V5h-1v1a1 1 0 0 1-2 0V5H9v1a1 1 0 0 1-2 0V5H6.414L4 7.414L16.586 20H17a.5.5 0 0 0 .5-.5V5Z',
      scale: 'M12 2a1 1 0 0 1 1 1v1.126a4 4 0 0 1 2.5 3.718V12h1.382a3.5 3.5 0 1 1-3.381 4.5H10.5A3.5 3.5 0 1 1 7.118 12H8.5V7.844A4 4 0 0 1 11 4.126V3a1 1 0 0 1 1-1Zm3.5 12H19a1.5 1.5 0 1 0-1.5 1.5V14Zm-10 0A1.5 1.5 0 1 0 6 15.5V14h-.5Z',
      beam: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 1 1 0 4h-1v8a2 2 0 1 1-4 0V8h-2v8a2 2 0 1 1-4 0V8H6a2 2 0 0 1-2-2Z',
      palette: 'M13.5 2a8.5 8.5 0 0 1 8.347 10.073a3.874 3.874 0 0 1-4.136 3.13L17 15.12a1.5 1.5 0 0 0-2 1.42a2.46 2.46 0 0 1-2.452 2.46H12a8.5 8.5 0 0 1 1.5-16.997ZM8.5 7a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 8.5 7Zm7-1A1.25 1.25 0 1 0 15.5 3 1.25 1.25 0 0 0 15.5 6Zm-9 5A1.25 1.25 0 1 0 5.5 9 1.25 1.25 0 0 0 6.5 11Zm10 1a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z',
      bolt: 'M12.516 2.11A1 1 0 0 1 13.5 3v6h4a1 1 0 0 1 .78 1.625l-7 9a1 1 0 0 1-1.78-.625V13H5a1 1 0 0 1-.78-1.625l7-9a1 1 0 0 1 1.296-.265Z',
      fan: 'M13.732 2.084a1 1 0 0 1 1.241.647l1.286 3.857l3.858 1.286a1 1 0 0 1 .282 1.796l-3.27 2.36l.405 4.062a1 1 0 0 1-1.45.97l-3.784-1.89l-3.784 1.89a1 1 0 0 1-1.45-.97l.405-4.062l-3.27-2.36a1 1 0 0 1 .282-1.796l3.858-1.286l1.286-3.857a1 1 0 0 1 1.241-.647L12 2.5l1.732-.416Z',
      flame: 'M11.445 2.105a1 1 0 0 1 1.11 0C15.23 4.01 19 8.086 19 12.5a7 7 0 0 1-14 0c0-4.414 3.77-8.49 6.445-10.395ZM12 6.382C10.432 7.83 9 10.07 9 12.5a3 3 0 0 0 6 0c0-2.43-1.432-4.67-3-6.118Z',
      'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9l1.89 3.89a1 1 0 0 1-.89 1.11h-2a1 1 0 0 1-.89-1.11L12 9Z',
      wind: 'M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2',
      layers: 'M12 2a1 1 0 0 1 .447.105l8 4a1 1 0 0 1 0 1.79L12.447 12.895a1 1 0 0 1-.894 0L3.553 7.895a1 1 0 0 1 0-1.79l8-4A1 1 0 0 1 12 2Zm0 9.618L18.764 9L12 5.382L5.236 9L12 11.618Zm8.447 3.277a1 1 0 0 1-.447 1.342l-8 4a1 1 0 0 1-.894 0l-8-4a1 1 0 1 1 .894-1.788L12 18.618l7.447-3.17a1 1 0 0 1 1.342.447Z',
      route: 'M7 4a3 3 0 1 1 2.995 3.225l-2.94 9.8A3 3 0 1 1 5 16a2.99 2.99 0 0 1 1.005-2.225l2.94-9.8A3 3 0 0 1 7 4Zm10 6a3 3 0 1 1-.005 6A3 3 0 0 1 17 10Z',
      chart: 'M6 11a1 1 0 0 1 1 1v6h2V9a1 1 0 0 1 2 0v9h2v-6a1 1 0 1 1 2 0v6h2v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a1 1 0 0 1 1-1h1Zm11-9a1 1 0 0 1 .78 1.625l-4 5a1 1 0 0 1-1.424.144L10.4 7.2l-3.4 3.4a1 1 0 1 1-1.414-1.414l4-4a1 1 0 0 1 1.327-.077l1.91 1.432l3.37-4.212A1 1 0 0 1 17 2Z'
    };

    const navContainer = document.querySelector('[data-nav]');
    const collapseButton = document.querySelector('[data-collapse]');
    const collapseLabel = document.querySelector('[data-collapse-label]');
    const searchInput = document.getElementById('navSearch');
    const emptyState = document.querySelector('[data-empty]');
    const categoryLabel = document.querySelector('[data-selected-category]');
    const titleLabel = document.querySelector('[data-selected-title]');
    const refreshButton = document.querySelector('[data-refresh]');
    const calculatorFrame = document.querySelector('.calculator-frame');

    const navLinkElements = [];
    const hrefToLink = new Map();
    const STORAGE_KEY = 'calculator_hub_state_v1';
    let lastFilterQuery = '';
    let currentHref = '';

    const normalizeHref = (href) => {
      if (!href) return '';
      try {
        return new URL(href, window.location.href).href;
      } catch (error) {
        console.warn('Could not normalize href', href, error);
        return href;
      }
    };

    const loadPersistedState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        console.warn('Could not load persisted state', error);
        return {};
      }
    };

    const persistState = () => {
      try {
        const state = {
          lastHref: currentHref,
          navQuery: searchInput.value || '',
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Could not persist state', error);
      }
    };

    const sr = (text) => {
      const span = document.createElement('span');
      span.className = 'sr-only';
      span.textContent = text;
      return span;
    };

    const createIcon = (name) => {
      if (!name || !iconPaths[name]) return null;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', iconPaths[name]);
      svg.appendChild(path);
      return svg;
    };

    const fragment = document.createDocumentFragment();
    navigationData.forEach((section) => {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'nav-section';
      sectionEl.dataset.sectionTitle = section.title;
      if (section.startOpen) {
        sectionEl.dataset.open = 'true';
      }

      const header = document.createElement('header');
      header.className = 'nav-section__header';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-section__toggle';
      toggle.setAttribute('aria-expanded', section.startOpen ? 'true' : 'false');
      toggle.appendChild(sr(section.startOpen ? `Collapse ${section.title}` : `Expand ${section.title}`));

      const toggleContent = document.createElement('div');
      toggleContent.className = 'nav-section__label';
      const icon = createIcon(section.icon);
      if (icon) {
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'nav-section__icon';
        iconWrapper.appendChild(icon);
        toggleContent.appendChild(iconWrapper);
      }
      const title = document.createElement('span');
      title.textContent = section.title;
      toggleContent.appendChild(title);
      toggle.appendChild(toggleContent);

      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.setAttribute('focusable', 'false');
      chevron.classList.add('nav-section__chevron');
      const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      chevronPath.setAttribute('d', 'M7.293 9.293a1 1 0 0 1 1.414 0L12 12.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z');
      chevron.appendChild(chevronPath);
      toggle.appendChild(chevron);

      header.appendChild(toggle);
      sectionEl.appendChild(header);

      const list = document.createElement('ul');
      list.className = 'nav-section__list';
      section.calculators.forEach((calc) => {
        const item = document.createElement('li');
        item.className = 'nav-section__item';
        item.dataset.search = `${section.title} ${calc.label} ${calc.keywords || ''}`.toLowerCase();

        const link = document.createElement('a');
        link.className = 'nav-section__link';
        link.href = calc.href;
        link.textContent = calc.label;
        link.dataset.sectionTitle = section.title;
        link.dataset.calculator = calc.label;

        item.appendChild(link);
        list.appendChild(item);

        navLinkElements.push(link);
        hrefToLink.set(calc.href, link);
        hrefToLink.set(new URL(calc.href, window.location.href).href, link);
      });

      sectionEl.appendChild(list);
      fragment.appendChild(sectionEl);
    });

    navContainer.appendChild(fragment);
    collapseButton.dataset.state = 'expanded';

    const getSections = () => Array.from(navContainer.querySelectorAll('.nav-section'));

    const getActiveFrame = () => calculatorFrame;

    const setActiveLink = (link) => {
      navLinkElements.forEach((item) => {
        item.removeAttribute('aria-current');
        item.parentElement.classList.remove('is-active');
      });

      link.setAttribute('aria-current', 'page');
      link.parentElement.classList.add('is-active');
      categoryLabel.textContent = link.dataset.sectionTitle;
      collapseButton.dataset.state = 'expanded';
      collapseLabel.textContent = 'Collapse all';
    };

    const handleFrameLoad = (event) => {
      const frame = event.target;
      const attributeSrc = frame.getAttribute('src');
      const propertySrc = frame.src;
      const normalized = normalizeHref(attributeSrc || propertySrc || '');
      const activeLink =
        hrefToLink.get(attributeSrc || '') ||
        hrefToLink.get(propertySrc || '') ||
        hrefToLink.get(normalized || '');
      if (activeLink) {
        setActiveLink(activeLink);
        const sectionEl = activeLink.closest('.nav-section');
        if (sectionEl) {
          setSectionOpen(sectionEl, true);
        }
      }
      currentHref = normalized;
      persistState();
    };

    const showFrame = (href) => {
      const normalized = normalizeHref(href);
      if (!href || normalized === currentHref) return;

      calculatorFrame.setAttribute('src', href);
      currentHref = normalized;

      const matchingLink = hrefToLink.get(href) || hrefToLink.get(normalized);
      if (matchingLink) {
        setActiveLink(matchingLink);
        const sectionEl = matchingLink.closest('.nav-section');
        if (sectionEl) {
          setSectionOpen(sectionEl, true);
        }
      }

      persistState();
    };

    const setSectionOpen = (sectionEl, open) => {
      const toggle = sectionEl.querySelector('.nav-section__toggle');
      if (!toggle) return;
      const isOpen = sectionEl.dataset.open === 'true';
      if (isOpen === open) return;
      if (open) {
        sectionEl.dataset.open = 'true';
        toggle.setAttribute('aria-expanded', 'true');
        toggle.querySelector('.sr-only').textContent = `Collapse ${sectionEl.dataset.sectionTitle}`;
      } else {
        sectionEl.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.querySelector('.sr-only').textContent = `Expand ${sectionEl.dataset.sectionTitle}`;
      }
    };

    navContainer.addEventListener('click', (event) => {
      const toggle = event.target.closest('.nav-section__toggle');
      if (toggle) {
        const sectionEl = toggle.closest('.nav-section');
        if (sectionEl) {
          const isOpen = sectionEl.dataset.open === 'true';
          setSectionOpen(sectionEl, !isOpen);
        }
        return;
      }

      const link = event.target.closest('.nav-section__link');
      if (!link) return;

      const isModifiedClick = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0;
      if (isModifiedClick) {
        return;
      }

      event.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        showFrame(href);
      }
    });

    const applyFilter = (value) => {
      const query = value.trim().toLowerCase();
      if (query === lastFilterQuery) return;
      lastFilterQuery = query;
      let hasMatches = false;

      getSections().forEach((sectionEl) => {
        const items = Array.from(sectionEl.querySelectorAll('.nav-section__item'));
        let visibleCount = 0;

        items.forEach((item) => {
          const searchText = item.dataset.search || '';
          const match = !query || searchText.includes(query);
          item.hidden = !match;
          if (match) {
            visibleCount += 1;
          }
        });

        const shouldHideSection = visibleCount === 0;
        sectionEl.hidden = shouldHideSection;

        if (!shouldHideSection) {
          setSectionOpen(sectionEl, true);
          hasMatches = true;
        }
      });

      emptyState.hidden = hasMatches;
      if (hasMatches) {
        collapseButton.dataset.state = 'expanded';
        collapseLabel.textContent = 'Collapse all';
      }

      persistState();
    };

    searchInput.addEventListener('input', (event) => {
      applyFilter(event.target.value);
    });

    collapseButton.addEventListener('click', () => {
      const shouldCollapse = collapseButton.dataset.state !== 'collapsed';
      getSections().forEach((sectionEl) => setSectionOpen(sectionEl, !shouldCollapse));
      collapseButton.dataset.state = shouldCollapse ? 'collapsed' : 'expanded';
      collapseLabel.textContent = shouldCollapse ? 'Expand all' : 'Collapse all';
    });

    refreshButton.addEventListener('click', () => {
      getActiveFrame().contentWindow?.location.reload();
    });

    calculatorFrame.addEventListener('load', handleFrameLoad);

    const persisted = loadPersistedState();
    if (persisted.navQuery) {
      searchInput.value = persisted.navQuery;
      applyFilter(persisted.navQuery);
    }

    const defaultLink = navContainer.querySelector('.nav-section__link');
    const initialHref =
      (persisted.lastHref && (hrefToLink.get(persisted.lastHref) || hrefToLink.get(normalizeHref(persisted.lastHref))))
        ? persisted.lastHref
        : defaultLink?.getAttribute('href');

    const initialKey = normalizeHref(calculatorFrame.getAttribute('src'));
    currentHref = initialKey;

    if (initialHref) {
      showFrame(initialHref);
    } else if (defaultLink) {
      setActiveLink(defaultLink);
      const defaultSection = defaultLink.closest('.nav-section');
      if (defaultSection) {
        setSectionOpen(defaultSection, true);
      }
    }
