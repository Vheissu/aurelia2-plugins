export default `:host {
    --select-padding: .375rem 1.75rem .375rem .75rem;
}

.select {
    appearance: none;
    background-color: var(--color-white);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
    background-position: right .75rem center;
    background-repeat: no-repeat;
    background-size: 16px 12px;
    border: 1px solid var(--color-lightGrey);
    box-sizing: border-box;
    color: var(--color-mediumGrey);
    display: block;
    font-size: 1rem;
    height: calc(1.5em + .75rem + 2px);
    line-height: 1.5;
    margin: 0;
    padding: var(--select-padding);
}

.select[multiple],
.select[size]:not([size="1"]) {
    height: auto;
    padding-right: .75rem;
    background-image: none;
}

.select:focus {
    border-color: var(--color-skyBlue);
    outline: 0;
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, .25);
}

.small {
    height: calc(1.5em + .5rem + 2px);
    padding-top: .25rem;
    padding-bottom: .25rem;
    padding-left: .5rem;
    font-size: .875rem;
}

.large {
    height: calc(1.5em + 1rem + 2px);
    padding-top: .5rem;
    padding-bottom: .5rem;
    padding-left: 1rem;
    font-size: 1.25rem;
}`;