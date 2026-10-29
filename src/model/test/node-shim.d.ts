/**
 * Minimal typings for the few Node built-ins the tests use (the repo has no @types/node and adds no deps).
 * Tests only; the app never imports these.
 */
declare module 'node:fs' {
  export function existsSync(p: string): boolean;
  export function readFileSync(p: string, enc: 'utf8'): string;
  export function readdirSync(p: string): string[];
  export function statSync(p: string): { isDirectory(): boolean };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare module 'node:process' {
  export function cwd(): string;
}
