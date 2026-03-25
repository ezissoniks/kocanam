export const keys = {};
['keydown', 'keyup'].forEach(e => window.addEventListener(e, evt => {
  keys[evt.key.toLowerCase()] = e === 'keydown';
}));