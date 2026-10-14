export * from './core.js';
import type { Report, Config, Rule, Finding } from './core.js';
export const RULES: Record<string, Rule>;
export const DEFAULT_TYPES: string[];
export interface LintConfig { types?: string[]; scopes?: string[]; requireScope?: boolean; scopeCase?: boolean; subjectCase?: 'lower' | 'any'; headerMaxLength?: number; bodyMaxLineLength?: number; requireSignoff?: boolean; issuePattern?: string; ignoreMerges?: boolean; ignoreReverts?: boolean; ignore?: string[] }
export interface LintResult { findings: { rule: string; message: string; fix: string; line: number }[]; suggestion: string | null; parsed: { type: string; scope: string | null; breaking: boolean; subject: string } | null; header: string }
export function lintMessage(message: string, config?: LintConfig): LintResult;
export function lintCommits(commits: { sha?: string; message: string; source?: string }[], config?: LintConfig): { findings: Finding[]; results: object[] };
export function commitsInRange(dir: string, from?: string, to?: string): { sha: string; message: string }[];
export function check(dir: string, opts?: { message?: string; source?: string; from?: string; to?: string; lint?: LintConfig; now?: Date }, config?: Config & LintConfig, configFile?: string): Report & { commits: { sha: string | null; header: string; suggestion?: string | null; ignored?: boolean; findings: string[] }[] };
export function installHook(dir: string, opts?: { force?: boolean; command?: string }): { file: string; changed: boolean };
export function closestType(word: string, types?: string[]): string | null;
export function inferType(text: string, types?: string[]): string;
export function fixSubject(subject: string, opts?: { subjectCase?: 'lower' | 'any' }): string;
export function parseHeader(header: string): { type: string; scope?: string; bang?: string; subject: string } | null;
