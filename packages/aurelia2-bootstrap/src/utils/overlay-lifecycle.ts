type Transition = "show" | "hide";

/** Bootstrap restores document state in hide(), after its transitions complete. */
export class OverlayLifecycle {
  private readonly pending: Partial<Record<Transition, Event>> = {};
  private open = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly kind: "modal" | "offcanvas",
  ) {}

  begin(transition: Transition, event: Event): void {
    this.pending[transition] = event;
  }

  complete(transition: Transition): void {
    delete this.pending[transition];
    this.open = transition === "show";
  }

  close(hide: () => void): void | Promise<void> {
    if (!this.open && !this.pending.show && !this.pending.hide) return;
    return this.closeAfterTransitions(hide);
  }

  private async closeAfterTransitions(hide: () => void): Promise<void> {
    // Allow an in-progress show or hide event to finish dispatching.
    await Promise.resolve();
    await this.waitFor("show");
    await this.waitFor("hide");
    if (this.open) {
      hide();
      await this.waitFor("hide");
    }
    this.open = false;
    delete this.pending.show;
    delete this.pending.hide;
  }

  private waitFor(transition: Transition): void | Promise<void> {
    const event = this.pending[transition];
    if (!event || event.defaultPrevented) return;

    const name = `${transition === "show" ? "shown" : "hidden"}.bs.${this.kind}`;
    return new Promise((resolve) => {
      const onComplete = (event: Event): void => {
        if (event.target !== this.element) return;
        this.element.removeEventListener(name, onComplete);
        resolve();
      };
      this.element.addEventListener(name, onComplete);
    });
  }
}
