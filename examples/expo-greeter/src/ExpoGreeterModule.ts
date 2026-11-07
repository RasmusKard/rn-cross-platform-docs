import { NativeModule, requireNativeModule } from 'expo';

import { ExpoGreeterModuleEvents, GreetingOptions } from './ExpoGreeter.types';

/**
 * The native module's API, available as the package's default export.
 *
 * Listen to its events with `useEvent(ExpoGreeter, 'onChange')` from `expo`, or with `addListener`.
 */
export declare class ExpoGreeterModule extends NativeModule<ExpoGreeterModuleEvents> {
  /** The name {@linkcode hello} greets when {@linkcode GreetingOptions.name | options.name} is not given: `"world"`. */
  defaultName: string;

  /**
   * Builds a greeting.
   *
   * @param options Who to greet and how; omitted fields take their defaults.
   * @returns The greeting, e.g. `"Hello, world."`.
   *
   * @example
   * ```ts
   * ExpoGreeter.hello({ name: 'Ada', excited: true }); // "Hello, Ada!"
   * ```
   */
  hello(options?: GreetingOptions): string;

  /** Emits {@linkcode ExpoGreeterModuleEvents.onChange | onChange} with `value`. */
  setValueAsync(value: string): Promise<void>;
}

/**
 * The native module.
 *
 * @example
 * ```ts
 * import ExpoGreeter from 'expo-greeter';
 *
 * ExpoGreeter.hello(); // "Hello, world."
 * ```
 */
export default requireNativeModule<ExpoGreeterModule>('ExpoGreeter');
