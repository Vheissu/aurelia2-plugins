export default `:host {
    --heading-one-font-size: 36px;
    --heading-two-font-size: 28px;
    --heading-three-font-size: 20px;
    --heading-font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
}

h1,
h2,
h3,
h4,
h5,
h6 {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    color: var(--color-dark);
    font-family: var(--heading-font-family);
    margin-bottom: 0;
    margin-top: 0;
}

h1 {
    font-size: var(--heading-one-font-size);
}

h2 {
    font-size: var(--heading-two-font-size);
}

h3 {
    font-size: var(--heading-three-font-size);
}

.truncate {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.white {
    color: var(--color-white);
}

.light {
    color: var(--color-light);
}

.primary {
    color: var(--color-primary);
}

.secondary {
    color: var(--color-secondary);
}

.success {
    color: var(--color-success);
}

.info {
    color: var(--color-info);
}

.error {
    color: var(--color-error);
}

.bright {
    color: var(--color-bright);
}

.skyBlue {
    color: var(--color-skyBlue);
}

.purple {
    color: var(--color-purple);
}

.blueAlt {
    color: var(--color-blue-alt);
}`;