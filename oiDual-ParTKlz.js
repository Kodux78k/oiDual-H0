// modules/particles.module.metapulso.js
// KOBLLUX ∴ TRINITY — Particles + Metapulso palette loader + Solar sync
// Exports: di_initParticles, di_destroyParticles, di_reinitParticles, di_setPaletteByCombo, di_applyRandomMetapulso
// Usage: import { di_initParticles } from './modules/particles.module.metapulso.js';

const DI_STYLE_ID = 'di-particles-styles';
const DI_SCRIPT_ID = 'di-particles-lib';
let DI_CURRENT_TARGET = null;

// Default CSS injected (keeps canvas behind UI)
const DI_CSS = `
/* di particles module injected style */
#particles-js {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
  pointer-events: none !important;
}
`;

// sensible color name → hex defaults (can be overridden via options or .palette nodes)
const DI_COLOR_NAME_MAP = {
  Azul: ['#00FFFF','#0078FF'],
  Vermelho: ['#FF4D4F','#D32F2F'],
  Verde: ['#4CAF50','#00C853'],
  Amarelo: ['#FFD54F','#FFEB3B'],
  Roxo: ['#8A2BE2','#7C4DFF'],
  Laranja: ['#FF8C00','#FF7043'],
  Dourado: ['#DAA520','#FFC107'],
  Prata: ['#C0C0C0','#B0BEC5'],
  Preto: ['#000000','#222222'],
  Branco: ['#FFFFFF','#ECEFF1'],
  // fallback neon vibes
  neon: ['#0ff','#f0f']
};

// Default particles config baseline
const DI_DEFAULT_CONFIG = {
  particles: {
    number: { value: 40 },
    color: { value: DI_COLOR_NAME_MAP.neon.slice() },
    shape: { type: 'circle' },
    opacity: { value: 0.4 },
    size: { value: 2.4 },
    line_linked: {
      enable: true,
      distance: 150,
      color: '#ffffff',
      opacity: 0.2,
      width: 1
    },
    move: { enable: true, speed: 1.5 }
  },
  retina_detect: true
};

// --- helpers ---
function di_injectStyles(css = DI_CSS) {
  if (document.getElementById(DI_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DI_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function di_loadParticlesLib(src = 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js') {
  return new Promise((resolve, reject) => {
    if (window.particlesJS) return resolve(window.particlesJS);
    if (document.getElementById(DI_SCRIPT_ID)) {
      const existing = document.getElementById(DI_SCRIPT_ID);
      existing.addEventListener('load', () => resolve(window.particlesJS));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = DI_SCRIPT_ID;
    s.src = src;
    s.async = true;
    s.onload = () => resolve(window.particlesJS);
    s.onerror = (e) => reject(new Error('Failed to load particles lib'));
    document.head.appendChild(s);
  });
}

function di_isMobileLike() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch (e) { return false; }
}

function di_destroyByTarget(targetId = 'particles-js') {
  if (!window.pJSDom || !Array.isArray(window.pJSDom)) return;
  for (let i = window.pJSDom.length - 1; i >= 0; i--) {
    const p = window.pJSDom[i];
    try {
      const el = p?.pJS?.canvas?.el;
      if (!el) continue;
      const parent = el.parentNode;
      if (parent && parent.id === targetId) {
        if (p.pJS && p.pJS.fn && p.pJS.fn.vendors && typeof p.pJS.fn.vendors.destroypJS === 'function') {
          p.pJS.fn.vendors.destroypJS();
        }
        window.pJSDom.splice(i, 1);
      }
    } catch (e) {}
  }
}

// read palette nodes (.palette) - expects element with data-combo (matching metapulso key) or data-name & data-colors
function di_readPaletteNodes(selector = '.palette') {
  const nodes = Array.from(document.querySelectorAll(selector));
  if (!nodes.length) return { byCombo: {}, byName: {} };
  const byCombo = {}, byName = {};
  nodes.forEach(n => {
    const combo = n.dataset.combo?.trim();
    const name = n.dataset.name?.trim();
    const colorsAttr = n.dataset.colors || n.getAttribute('data-colors');
    let colors = null;
    if (colorsAttr) {
      colors = colorsAttr.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      // try CSS var on node: --particles-colors
      const cs = getComputedStyle(n).getPropertyValue('--particles-colors');
      if (cs && cs.trim()) colors = cs.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (combo && colors) byCombo[combo] = colors;
    if (name && colors) byName[name] = colors;
  });
  return { byCombo, byName };
}

// build colors array for a metapulso key; fallback to name mapping
function di_paletteFromMetapulsoKey(key, metapulsoObj = {}, paletteNodes = {byCombo:{},byName:{}} , nameMap = DI_COLOR_NAME_MAP) {
  // key e.g. "Azul|Silêncio|Água"
  if (!key) return DI_DEFAULT_CONFIG.particles.color.value.slice();
  if (paletteNodes.byCombo[key]) return paletteNodes.byCombo[key].slice();
  // try first token (color name)
  const first = key.split('|')[0]?.trim();
  if (nameMap[first]) return nameMap[first].slice();
  if (paletteNodes.byName[first]) return paletteNodes.byName[first].slice();
  // fallback: try to look into metapulsoObj entry to see if it's present (no colors there by default)
  if (metapulsoObj && metapulsoObj[key]) {
    // no colors included, pick map fallback:
    return nameMap[first] ? nameMap[first].slice() : DI_DEFAULT_CONFIG.particles.color.value.slice();
  }
  return DI_DEFAULT_CONFIG.particles.color.value.slice();
}

// select palette variations for solar mode: day -> brighter, night -> muted
function di_adjustForSolar(colors, solarMode='night') {
  // simple strategy: if night => desaturate / use darker variant when possible (choose second color if exists)
  if (!Array.isArray(colors) || colors.length === 0) return colors;
  if (solarMode === 'day') return colors; // keep as-is
  if (solarMode === 'sunset') {
    // pick slightly warmer; try swap to second color if present
    return colors.length > 1 ? [colors[0], colors[1]] : colors;
  }
  // night -> prefer darker or single muted
  return [colors[0]]; // keep minimal in night
}

// fetch metapulso JSON (relative path)
async function di_fetchMetapulso(path = './metapulso_70_combinacoes.json') {
  try {
    const res = await fetch(path, {cache: 'no-cache'});
    if (!res.ok) throw new Error('metapulso fetch fail');
    return await res.json();
  } catch (e) {
    console.warn('[di_particles] metapulso load failed:', e.message);
    return null;
  }
}

// --- core init logic ---
export async function di_initParticles({
  di_target = 'particles-js',
  di_config = {},
  di_autoInjectContainer = true,
  di_autoInjectStyles = true,
  di_libSrc = 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js',
  di_metapulsoPath = './metapulso_70_combinacoes.json',
  di_paletteSelector = '.palette',
  di_colorNameMap = {},
  di_waitForInteraction = false,
  di_watchSolar = true,
  di_solarLocalStorageKey = 'di_solarMode'
} = {}) {

  DI_CURRENT_TARGET = di_target;

  if (di_autoInjectStyles) di_injectStyles();

  // ensure container exists
  let container = document.getElementById(di_target);
  if (!container && di_autoInjectContainer) {
    container = document.createElement('div');
    container.id = di_target;
    document.body.insertBefore(container, document.body.firstChild);
  }
  if (!container) {
    console.warn('[di_particles] Container not found and auto-inject disabled.');
    return;
  }

  // merge name map
  const nameMap = { ...DI_COLOR_NAME_MAP, ...(di_colorNameMap || {}) };

  // read any .palette nodes
  const paletteNodes = di_readPaletteNodes(di_paletteSelector);

  // load metapulso json (best-effort)
  const metapulsoObj = await di_fetchMetapulso(di_metapulsoPath) || {};

  // build a function that (given an optional combo key) computes merged config
  const buildConfig = (comboKey = null, solarMode = (localStorage.getItem(di_solarLocalStorageKey) || 'night')) => {
    const merged = JSON.parse(JSON.stringify(DI_DEFAULT_CONFIG));
    // base colors: prefer data-colors on container, else metapulso mapping, else node palette byName, else defaults
    // 1) container data-colors
    const contColorsAttr = container.dataset.colors;
    let colors = null;
    if (contColorsAttr) colors = contColorsAttr.split(',').map(s=>s.trim()).filter(Boolean);
    // 2) if comboKey specified, try build
    if (!colors && comboKey) colors = di_paletteFromMetapulsoKey(comboKey, metapulsoObj, paletteNodes, nameMap);
    // 3) try palette nodes byName matching body class or data-attr (optional)
    if (!colors && paletteNodes.byName) {
      const bodyName = document.body.dataset.paletteName;
      if (bodyName && paletteNodes.byName[bodyName]) colors = paletteNodes.byName[bodyName];
    }
    // 4) container CSS var
    if (!colors) {
      const cs = getComputedStyle(container).getPropertyValue('--particles-colors') ||
                 getComputedStyle(document.documentElement).getPropertyValue('--particles-colors');
      if (cs && cs.trim()) colors = cs.split(',').map(s=>s.trim()).filter(Boolean);
    }
    // final fallback: default
    if (!colors) colors = merged.particles.color.value.slice();

    // adjust for solar mode
    colors = di_adjustForSolar(colors, solarMode);

    // apply palette (single or array)
    merged.particles.color.value = (colors.length === 1) ? colors[0] : colors.slice();

    // shallow merge di_config.particles
    if (di_config && di_config.particles) {
      merged.particles = { ...merged.particles, ...di_config.particles };
      if (di_config.particles.color) merged.particles.color = di_config.particles.color;
    }

    // mobile adjustments
    if (di_isMobileLike()) {
      merged.particles.number.value = merged.particles.number?.value ? Math.min(merged.particles.number.value, 30) : 30;
      if (merged.particles.line_linked) merged.particles.line_linked.enable = false;
      if (merged.particles.move) merged.particles.move.speed = Math.min(merged.particles.move.speed || 1.5, 1.2);
    }

    return merged;
  };

  // init runner
  const doInit = async (opts = {}) => {
    const comboKey = opts.comboKey || null;
    const solarMode = opts.solarMode || (localStorage.getItem(di_solarLocalStorageKey) || 'night');

    try {
      await di_loadParticlesLib(di_libSrc);
      // destroy previous
      try { di_destroyByTarget(di_target); } catch(e){}
      const conf = buildConfig(comboKey, solarMode);

      if (typeof window.particlesJS === 'function') {
        window.particlesJS(di_target, conf);
      } else {
        window.pJSDom = window.pJSDom || [];
        window.particlesJS(di_target, conf);
      }
      // save metadata
      container.dataset.diConfig = JSON.stringify(conf);
      container.dataset.diAppliedCombo = comboKey || '';
      container.dataset.diSolar = solarMode;
    } catch (e) {
      console.error('[di_particles] init error', e);
    }
  };

  // if wait for interaction, init on first pointerdown/keydown
  if (di_waitForInteraction) {
    const onFirst = () => {
      document.removeEventListener('pointerdown', onFirst);
      document.removeEventListener('keydown', onFirst);
      doInit();
    };
    document.addEventListener('pointerdown', onFirst, { once: true });
    document.addEventListener('keydown', onFirst, { once: true });
  } else {
    await doInit();
  }

  // watch solar mode changes - storage event or custom event
  if (di_watchSolar) {
    const storageHandler = (e) => {
      if (e.key === di_solarLocalStorageKey) {
        const newMode = e.newValue || localStorage.getItem(di_solarLocalStorageKey) || 'night';
        // reinit with same combo if any
        const appliedCombo = container.dataset.diAppliedCombo || null;
        doInit({ comboKey: appliedCombo, solarMode: newMode });
      }
    };
    window.addEventListener('storage', storageHandler);
    // also listen for custom event 'di:solar-change' with detail.mode
    const customHandler = (ev) => {
      const newMode = ev?.detail?.mode || localStorage.getItem(di_solarLocalStorageKey) || 'night';
      const appliedCombo = container.dataset.diAppliedCombo || null;
      doInit({ comboKey: appliedCombo, solarMode: newMode });
    };
    document.addEventListener('di:solar-change', customHandler);

    // store handlers for potential cleanup
    container._di_storageHandler = storageHandler;
    container._di_customHandler = customHandler;
  }

  // expose some utilities on container for debug (optional)
  container.di_applyCombo = async (comboKey) => {
    await doInit({ comboKey });
  };

  container.di_applyRandomMetapulso = async () => {
    const keys = Object.keys(metapulsoObj || {});
    if (!keys.length) return;
    const pick = keys[Math.floor(Math.random() * keys.length)];
    await doInit({ comboKey: pick });
    return pick;
  };

  // return API-like object
  return {
    target: container,
    metapulso: metapulsoObj,
    paletteNodes,
    applyCombo: container.di_applyCombo,
    applyRandom: container.di_applyRandomMetapulso,
    destroy: () => di_destroyParticles(di_target)
  };
}

// PUBLIC - destroy
export function di_destroyParticles(di_target = DI_CURRENT_TARGET || 'particles-js') {
  di_destroyByTarget(di_target);
  const el = document.getElementById(di_target);
  if (!el) return;
  const canv = el.querySelectorAll('canvas');
  canv.forEach(c => c.remove());
  delete el.dataset.diConfig;
  delete el.dataset.diAppliedCombo;
  delete el.dataset.diSolar;
  // remove listeners if present
  if (el._di_storageHandler) { window.removeEventListener('storage', el._di_storageHandler); delete el._di_storageHandler; }
  if (el._di_customHandler) { document.removeEventListener('di:solar-change', el._di_customHandler); delete el._di_customHandler; }
}

// PUBLIC - reinit
export async function di_reinitParticles(opts = {}) {
  di_destroyParticles(opts.di_target);
  return di_initParticles(opts);
}

// convenience: set palette by combo key (string matching metapulso JSON key)
export async function di_setPaletteByCombo(comboKey, opts = {}) {
  const target = opts.di_target || DI_CURRENT_TARGET || 'particles-js';
  const solarMode = opts.solarMode || localStorage.getItem(opts.di_solarLocalStorageKey || 'di_solarMode') || 'night';
  // will init and apply combo
  await di_initParticles({ ...opts, di_target: target, di_waitForInteraction: false, di_metapulsoPath: opts.di_metapulsoPath || './metapulso_70_combinacoes.json' });
  // attempt to call container apply
  const container = document.getElementById(target);
  if (container && typeof container.di_applyCombo === 'function') {
    await container.di_applyCombo(comboKey);
  } else {
    // fallback: reinit passing comboKey
    await di_reinitParticles({ ...opts, di_target: target, di_config: opts.di_config || {}, di_waitForInteraction: false, di_metapulsoPath: opts.di_metapulsoPath || './metapulso_70_combinacoes.json', di_paletteSelector: opts.di_paletteSelector || '.palette' , di_colorNameMap: opts.di_colorNameMap || {} , di_watchSolar: opts.di_watchSolar !== false });
  }
}

// convenience: pick a random metapulso combination and apply
export async function di_applyRandomMetapulso(opts = {}) {
  const res = await di_initParticles({ ...opts });
  if (res && res.applyRandom) {
    return await res.applyRandom();
  }
  return null;
}