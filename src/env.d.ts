/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __CONTENT_PROFILE__: 'preview' | 'personal' | 'organisational';

declare module 'virtual:carpa-validators' {
  import type { ValidateFunction } from './content/validators.ts';
  export const presentation: ValidateFunction;
  export const medication: ValidateFunction;
  export const observationSet: ValidateFunction;
  export const referenceList: ValidateFunction;
}
