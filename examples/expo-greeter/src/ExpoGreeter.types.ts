/** Events emitted by the module, for `addListener` and `useEvent`. */
export type ExpoGreeterModuleEvents = {
  /** Emitted by `setValueAsync`. */
  onChange: (params: ChangeEventPayload) => void;
};

/** Payload of the `onChange` event. */
export type ChangeEventPayload = {
  /** The value passed to `setValueAsync`. */
  value: string;
};

/** Options for `hello`. */
export type GreetingOptions = {
  /** Who to greet. Defaults to `"world"`. */
  name?: string;
  /** Ends the greeting with `!` instead of `.`. Defaults to `false`. */
  excited?: boolean;
};
