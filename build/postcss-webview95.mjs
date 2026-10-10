import postcss from 'postcss';

// Translate independent transform properties into the older combined transform syntax.
const parts = ['translate', 'rotate', 'scale', 'transform'];
const expression = parts.map(part => `var(--folia-compat-${part}, )`).join(' ');
export default function webview95Transforms() {
  return {
    postcssPlugin: 'folia-webview95-transforms',
    OnceExit(root) {
      const defaults = postcss.rule({ selector: '*,::before,::after' });
      for (const part of parts) defaults.append({ prop: `--folia-compat-${part}`, value: ' ' });
      root.prepend(defaults);
      root.walkRules(rule => {
        if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
        const declarations = rule.nodes.filter(node => node.type === 'decl' && parts.includes(node.prop));
        if (!declarations.some(node => node.prop !== 'transform')) return;
        for (const declaration of declarations) {
          const part = declaration.prop;
          const value = declaration.value;
          let legacy = value === 'none' ? ' ' : value;
          if (value !== 'none' && part !== 'transform') {
            const values = postcss.list.space(value);
            if (part === 'translate' || part === 'scale') {
              legacy = `${part}${values.length === 3 ? '3d' : ''}(${values.join(', ')})`;
            } else if (values.length === 2 && /^[xyz]$/.test(values[0])) {
              legacy = `rotate${values[0].toUpperCase()}(${values[1]})`;
            } else {
              legacy = `rotate(${value})`;
            }
          }
          declaration.prop = `--folia-compat-${part}`;
          declaration.value = legacy;
        }
        rule.append({ prop: 'transform', value: expression, important: declarations.some(node => node.important) });
      });
    },
  };
}
