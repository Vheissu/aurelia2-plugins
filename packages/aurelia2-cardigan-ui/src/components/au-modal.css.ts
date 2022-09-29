export default `:host {
    --modal-backdrop-background: rgba(0, 0, 0, 0.4);
    --modal-wrapper-background: var(--color-white);
}

.container {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    height: 100%;
    justify-content: center;
    left: 0;
    position: fixed;
    top: 0;
    width: 100%;
}

.backdrop {
    cursor: zoom-out;
    background: var(--modal-backdrop-background);
    height: 100%;
    left: 0;
    opacity: 0.9;
    overflow-y: scroll;
    position: absolute;
    top: 0;
    width: 100%;
}

.wrapper {
    background-color: var(--modal-wrapper-background);
    border-radius: 32px;
    display: flex;
    margin-left: 16px;
    margin-right: 16px;
    max-height: calc(100vh - 32px);
    overflow: hidden;
    position: relative;
}

.wrapper:focus {
    outline: none;
}

.modal-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    position: relative;
    width: 100%;
}

.modal-content-inner {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow: auto;
}`;