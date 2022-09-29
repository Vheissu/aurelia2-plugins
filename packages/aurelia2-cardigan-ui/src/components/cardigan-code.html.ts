export default `<template if.bind="type == 'pre'">

    <pre class="pre" part="pre">
        <code class="code" part="code">
            <slot></slot>
        </code>
    </pre>

</template>

<template else>
    <code class="code" part="code">
        <slot></slot>
    </code>
</template>`;