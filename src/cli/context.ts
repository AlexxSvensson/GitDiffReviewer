export interface CliContext {
  cwd: string;
}

export function resolveContext(): CliContext {
  return { cwd: process.cwd() };
}
