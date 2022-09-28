export default `
<h1 if.bind="level == '1'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h1>
<h2 if.bind="level == '2'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h2>
<h3 if.bind="level == '3'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h3>
<h4 if.bind="level == '4'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h4>
<h5 if.bind="level == '5'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h5>
<h6 if.bind="level == '6'" part="heading h\${level} \${size} \${color} \${overflow} \${truncate ? 'truncate' : ''}" class="\${color} \${overflow} \${truncate ? 'truncate' : ''}">
    <slot></slot>
</h6>`;