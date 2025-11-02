// Simple universal command stack with undo/redo
export function createCommandStack({ onChange } = {}) {
  const stack = [];
  const redo = [];
  const notify = () => { if (typeof onChange === 'function') onChange(); };
  return {
    exec(cmd) {
      if (cmd && typeof cmd.do === 'function') cmd.do();
      stack.push(cmd || {});
      redo.length = 0;
      notify();
    },
    undo() {
      const c = stack.pop();
      if (c && typeof c.undo === 'function') c.undo();
      if (c) redo.push(c);
      notify();
    },
    redo() {
      const c = redo.pop();
      if (c && typeof c.do === 'function') c.do();
      if (c) stack.push(c);
      notify();
    },
    clear() { stack.length = 0; redo.length = 0; notify(); },
    canUndo() { return stack.length > 0; },
    canRedo() { return redo.length > 0; },
  };
}
