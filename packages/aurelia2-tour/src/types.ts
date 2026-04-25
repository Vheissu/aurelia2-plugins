export type TourPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string | Element | null;
  placement?: TourPlacement;
  nextLabel?: string;
  previousLabel?: string;
  doneLabel?: string;
}

export interface TourState {
  active: boolean;
  index: number;
  steps: TourStep[];
  current: TourStep | null;
}

export type TourListener = (state: TourState) => void;

export interface TourDispose {
  dispose(): void;
}

export interface TourConfigurationOptions {
  nextLabel?: string;
  previousLabel?: string;
  doneLabel?: string;
  closeLabel?: string;
}
