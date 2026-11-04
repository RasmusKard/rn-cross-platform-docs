/** Events emitted by the module, for `addListener` and `useEvent`. */
export type ExpoGreeterModuleEvents = {
  /** Emitted by {@linkcode ExpoGreeterModule#setValueAsync | setValueAsync}. */
  onChange: (params: ChangeEventPayload) => void;
};

/** Payload of the {@linkcode ExpoGreeterModuleEvents.onChange | onChange} event. */
export type ChangeEventPayload = {
  /** The value passed to {@linkcode ExpoGreeterModule#setValueAsync | setValueAsync}. */
  value: string;
};

/** Options for {@linkcode ExpoGreeterModule#hello | hello}. */
export type GreetingOptions = {
  /** Who to greet. Defaults to {@linkcode ExpoGreeterModule#defaultName | defaultName}, `"world"`. */
  name?: string;
  /** Ends the greeting with `!` instead of `.`. Defaults to `false`. */
  excited?: boolean;
};
