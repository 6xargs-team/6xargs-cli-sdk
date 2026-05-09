/**
 * termcn component library — internal Ink-based UI primitives for 6xargs CLI output.
 *
 * Components:
 *   Alert    — error / warning / info / success messages with optional fix hint
 *   Badge    — colored plan-tier labels and job-status icons
 *   Spinner  — animated braille loading indicator (self-contained frame state)
 *   ToolCall — structured ask-query response (answer + sources + latency)
 */
export { Alert }    from "./Alert.js";
export { Badge }    from "./Badge.js";
export { Spinner }  from "./Spinner.js";
export { ToolCall } from "./ToolCall.js";

export type { AlertProps }    from "./Alert.js";
export type { BadgeProps }    from "./Badge.js";
export type { SpinnerProps }  from "./Spinner.js";
export type { ToolCallProps, ToolCallSource } from "./ToolCall.js";
