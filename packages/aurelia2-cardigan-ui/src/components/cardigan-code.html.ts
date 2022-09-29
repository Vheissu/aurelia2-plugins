export default `
    <pre class="pre" part="pre" if.bind="type == 'pre'">
        <code class="code" part="code">
            <slot></slot>
        </code>
    </pre>
    <code else class="code" part="code">
        <slot></slot>
    </code>
`;