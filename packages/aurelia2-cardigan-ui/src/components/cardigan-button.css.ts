export default `:host {
    --button-color: #333;
    --button-font-family: Arial, Helvetica, sans-serif;
    --button-font-size: 1rem;
    --button-text-transform: none;
    --button-primary-background: var(--color-primary);
    --button-primary-color: var(--color-white);
    --button-secondary-background: var(--color-secondary);
    --button-secondary-color: var(--color-white);
    --button-bright-background: var(--color-bright);
    --button-bright-color: var(--color-white);
    --button-purple-background: var(--color-purple);
    --button-purple-color: var(--color-white);
    --button-success-background: var(--color-success);
    --button-success-color: var(--color-white);
    --button-error-background: var(--color-error);
    --button-error-color: var(--color-white);
    --button-info-background: var(--color-info);
    --button-info-color: var(--color-white);
    --button-light-background: var(--color-light);
    --button-light-color: var(--color-dark);
    --button-dark-background: var(--color-dark);
    --button-dark-color: var(--color-white);
    --button-small-padding: 0.5rem 0.7rem;
    --button-medium-padding: 0.8rem 1rem;
    --button-large-padding: 1rem 1.2rem;
    --button-xlarge-padding: 1.6rem 1.6rem;
}

.button {
    background: none;
    border: none;
    color: var(--button-color);
    display: inline-flex;
    font-family: var(--button-font-family);
    font-size: 1rem;
    margin: 0;
    outline: none;
    text-decoration: none;
    text-transform: none;
}

.button:hover {
    cursor: pointer;
}

.primary {
    background: var(--button-primary-background);
    color: var(--button-primary-color);
}

.primary:hover {
    background: var(--button-primary-background-hover, var(--color-blue-alt));
}

.secondary {
    background: var(--button-secondary-background);
    color: var(--button-secondary-color);
}

.secondary:hover {
    background: var(--button-secondary-background-hover, var(--button-secondary-background));
}

.success {
    background: var(--button-success-background);
    color: var(--button-success-color);
}

.success:hover {
    background: var(--button-success-background-hover, var(--button-success-background));
}

.error {
    background: var(--button-error-background);
    color: var(--button-error-color);
}

.error:hover {
    background: var(--button-error-background-hover, var(--button-error-background));
}

.info {
    background: var(--button-info-background);
    color: var(--button-info-color);
}

.info:hover {
    background: var(--button-info-background-hover, var(--button-info-background));
}

.light {
    background: var(--button-light-background);
    color: var(--button-light-color);
}

.info:hover {
    background: var(--button-light-background-hover, var(--button-light-background));
}

.dark {
    background: var(--button-dark-background);
    color: var(--button-dark-color);
}

.dark:hover {
    background: var(--button-dark-background-hover, var(--button-dark-background));
}

.small {
    padding: var(--button-small-padding);
}

.medium {
    padding: var(--button-medium-padding);
}

.large {
    padding: var(--button-large-padding);
}

.xlarge {
    padding: var(--button-xlarge-padding);
}`;