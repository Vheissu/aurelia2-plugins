const template = `
<template>
  <style>
    au-aurafall {
      display: block;
    }

    .au-aurafall-content {
      position: relative;
      width: 100%;
      min-height: 1px;
    }

    .au-aurafall-item {
      position: absolute;
      box-sizing: border-box;
      content-visibility: auto;
      contain: layout paint;
    }

    .au-aurafall-fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      background: #e5e7eb;
      border-radius: 10px;
      color: #374151;
      font-size: 0.875rem;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>

  <div class="au-aurafall-content" ref="content" style.bind="contentStyle">
    <div
      class="au-aurafall-item"
      repeat.for="space of itemRenderList; key.bind: getSpaceKey(space)"
      style.bind="itemStyle(space)"
      data-index.bind="space.index"
    >
      <au-slot name="item" expose.bind="{ item: space.item, index: space.index }">
        <div class="au-aurafall-fallback">Item \${space.index + 1}</div>
      </au-slot>
    </div>
  </div>
</template>
`;

export default template;
