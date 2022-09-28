export default `<div class="container" aria-label.bind="label" role.bind="role">
    <div class="backdrop" click.trigger="handleBackdropClick($event)" part="backdrop"></div>
    <div class="wrapper" tabIndex="-1" style="width: \${width};" part="wrapper">
        <div class="modal-content" part="content-wrapper">
            <template replaceable part="heading"></template>
            <div class="modal-content-inner" part="content">
                <slot></slot>
            </div>
        </div>
    </div>
</div>`;