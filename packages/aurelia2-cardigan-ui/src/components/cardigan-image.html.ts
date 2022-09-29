export default `<div class="image" if.bind="fit == 'none'">
    <img class="img" src.bind="src" loading.bind="loading" importance.bind="importance" alt.bind="alt" error.trigger="handleOnError()" load.trigger="handleOnLoad()" sizes.bind="sizes" srcset.bind="srcSet" part="img">
    <slot></slot>
</div>
<div class="scaled-img \${fit}" aria-label.bind="alt" style="background-color: \${color}; background-image: url('\${src}'); padding-bottom: \${(naturalHeight / naturalWidth) * 100}%;" part="scaled-img" role="img" else>
    <slot></slot>
</div>`;