type WaterfallCard = {
  id: string;
  title: string;
  height: number;
  hue: number;
  tone: number;
};

const buildCards = (count: number, offset = 0): WaterfallCard[] => {
  const cards: WaterfallCard[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = offset + i + 1;
    const hue = (index * 29) % 360;
    cards.push({
      id: `card-${index}`,
      title: `Aurafall #${index}`,
      height: 160 + ((index * 37) % 140),
      hue,
      tone: 70 + ((index * 13) % 20),
    });
  }

  return cards;
};

export class MyApp {
  public aurafall?: HTMLElement;

  public virtual = true;
  public enableCache = true;
  public gap = 16;
  public padding = 16;
  public itemMinWidth = 220;
  public maxColumnCount = 6;
  public minColumnCount = 2;
  public topPreloadScreenCount = 0;
  public bottomPreloadScreenCount = 1;
  public bottomDistance = 160;
  public pageSize = 24;
  public maxItems = 0;
  public loadDelayMs = 250;
  public autoLoad = true;
  public loading = false;
  public page = 0;
  public visibleCount = 0;
  public distanceFromBottom = 0;
  public isAutoFilling = false;

  private scrollPending = false;
  private fillPending = false;

  public items: WaterfallCard[] = [];

  public calcItemHeight = (item: WaterfallCard): number => item.height;

  public attached(): void {
    this.attachScroll();
    void this.loadMore();
  }

  public detached(): void {
    this.detachScroll();
  }

  public get preloadScreenCount(): [number, number] {
    return [this.topPreloadScreenCount, this.bottomPreloadScreenCount];
  }

  public addItems(): void {
    void this.loadMore();
  }

  public shuffle(): void {
    this.items = [...this.items].sort(() => Math.random() - 0.5);
    this.requestFill();
  }

  public backTop(): void {
    if (!this.aurafall) return;
    this.aurafall.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public requestFill(): void {
    if (this.fillPending) return;
    this.fillPending = true;
    this.requestFrame(() => {
      this.fillPending = false;
      void this.fillUntilScrollable();
    });
  }

  public cardStyle(item: WaterfallCard): string {
    return `height: 100%; background: hsl(${item.hue}, ${item.tone}%, 88%);`;
  }

  public cardImageStyle(item: WaterfallCard): string {
    return `background: linear-gradient(135deg, hsl(${item.hue}, 80%, 70%), hsl(${(item.hue + 60) % 360}, 80%, 70%));`;
  }

  private attachScroll(): void {
    if (!this.aurafall) return;
    this.aurafall.addEventListener('scroll', this.handleScroll, { passive: true });
  }

  private detachScroll(): void {
    if (!this.aurafall) return;
    this.aurafall.removeEventListener('scroll', this.handleScroll);
  }

  private handleScroll = (): void => {
    if (!this.autoLoad) return;
    if (this.scrollPending) return;
    this.scrollPending = true;
    this.requestFrame(() => {
      this.scrollPending = false;
      void this.checkAutoLoad();
    });
  };

  private async checkAutoLoad(): Promise<void> {
    this.updateStats();
    if (!this.autoLoad || this.loading) return;
    if (this.distanceFromBottom > this.bottomDistance) return;
    await this.loadMore();
  }

  private async loadMore(): Promise<void> {
    if (this.loading) return;
    if (this.maxItems > 0 && this.items.length >= this.maxItems) return;

    this.loading = true;
    await this.delay(this.loadDelayMs);

    const remaining = this.maxItems > 0 ? this.maxItems - this.items.length : this.pageSize;
    const count = Math.min(this.pageSize, remaining);
    const next = buildCards(count, this.items.length);

    this.items = [...this.items, ...next];
    this.page += 1;
    this.loading = false;

    this.updateStats();
    await this.fillUntilScrollable();
  }

  private async fillUntilScrollable(maxRounds = 6): Promise<void> {
    if (!this.aurafall || this.isAutoFilling) return;
    this.isAutoFilling = true;

    for (let i = 0; i < maxRounds; i += 1) {
      await this.nextFrame();
      this.updateStats();
      if (!this.autoLoad || this.loading) break;
      if (this.maxItems > 0 && this.items.length >= this.maxItems) break;
      if (this.distanceFromBottom > this.bottomDistance) break;
      await this.loadMore();
    }

    this.isAutoFilling = false;
  }

  private updateStats(): void {
    if (!this.aurafall) {
      this.visibleCount = 0;
      this.distanceFromBottom = 0;
      return;
    }
    const { scrollHeight, scrollTop, clientHeight } = this.aurafall;
    this.distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    this.visibleCount = this.aurafall.querySelectorAll('.au-aurafall-item').length;
  }

  private requestFrame(cb: () => void): void {
    const raf = globalThis.requestAnimationFrame?.bind(globalThis);
    if (raf) {
      raf(() => cb());
    } else {
      setTimeout(() => cb(), 16);
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => this.requestFrame(() => resolve()));
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
