import type { ComponentType } from 'react';

export interface Beat {
  /** short name for the stepper */
  label: string;
  /** number of sub-steps the presenter walks through inside this beat (>= 1) */
  steps: number;
  View: ComponentType<{ step: number }>;
}
