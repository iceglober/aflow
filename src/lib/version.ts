declare const __AFLOW_VERSION__: string;

export const VERSION: string =
  typeof __AFLOW_VERSION__ !== "undefined" ? __AFLOW_VERSION__ : "0.0.0-dev";
