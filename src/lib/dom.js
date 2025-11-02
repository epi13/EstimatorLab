export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
export function on(el, type, handler, opts) { if (!el) return () => {}; el.addEventListener(type, handler, opts); return () => el.removeEventListener(type, handler, opts); }
export function cls(el, name, on) { if (!el) return; if (on === undefined) el.classList.toggle(name); else el.classList.toggle(name, !!on); }
export function attr(el, name, value) { if (!el) return; if (value === undefined) return el.getAttribute(name); el.setAttribute(name, value); }
