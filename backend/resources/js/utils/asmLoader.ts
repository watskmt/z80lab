import { MEM_SIZE, CODE_BASE, DATA_BASE } from '../constants';
import { assembleInstruction, resolveAsmIdentifiers } from './assembler';

export interface AssembledInstruction {
  addr: number;
  bytes: number[];
  text: string;
}

export interface AssembleProgramResult {
  codeMemory: Uint8Array;
  dataMemory: Uint8Array;
  labelMap: Record<string, number>;
  errorLines: string[];
  addrToCSrc: Record<number, string>;
  instructions: AssembledInstruction[];
}

const stripLabel = (line: string): [string | null, string] => {
  const m = line.match(/^([A-Za-z_]\w*):\s*(.*)/);
  return m ? [m[1], m[2].trim()] : [null, line.trim()];
};

const parseNumeric = (tok: string): number | null => {
  const t = tok.trim();
  if (!t) return null;
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^[0-9a-f]+H$/i.test(t)) return parseInt(t.slice(0, -1), 16);
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
};

const tokenizeDataOperands = (rest: string): string[] => {
  const tokens: string[] = [];
  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /[\s,]/.test(rest[i])) i++;
    if (i >= rest.length) break;
    if (rest[i] === '"') {
      let j = i + 1;
      while (j < rest.length && rest[j] !== '"') j++;
      tokens.push(rest.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < rest.length && rest[j] !== ',') j++;
    tokens.push(rest.slice(i, j).trim());
    i = j + 1;
  }
  return tokens.filter(Boolean);
};

const encodeDb = (instr: string): number[] | null => {
  const m = instr.match(/^DB\s+(.*)$/i);
  if (!m) return null;
  const bytes: number[] = [];
  for (const tok of tokenizeDataOperands(m[1])) {
    if (tok.startsWith('"')) {
      const inner = tok.slice(1, -1);
      for (let k = 0; k < inner.length; k++) bytes.push(inner.charCodeAt(k) & 0xff);
    } else {
      const n = parseNumeric(tok);
      if (n === null) return null;
      bytes.push(n & 0xff);
    }
  }
  return bytes;
};

const encodeDw = (instr: string): number[] | null => {
  const m = instr.match(/^DW\s+(.*)$/i);
  if (!m) return null;
  const bytes: number[] = [];
  for (const tok of tokenizeDataOperands(m[1])) {
    const n = parseNumeric(tok);
    if (n === null) return null;
    bytes.push(n & 0xff, (n >> 8) & 0xff);
  }
  return bytes;
};

const parseOrg = (instr: string): number | null => {
  const m = instr.match(/^ORG\s+(.+)$/i);
  if (!m) return null;
  return parseNumeric(m[1].trim());
};

const isDataLine = (s: string) => s.startsWith('DB') || s.startsWith('DW');
const isOrgLine = (s: string) => s.startsWith('ORG');
const isEndLine = (s: string) => s.startsWith('END');

const assignLabel = (
  label: string | null,
  addr: number,
  map: Record<string, number>,
) => {
  if (label !== null) map[label] = addr;
};

/** Two-pass load of assembler text into code/data images (same rules as Import ASM/C). */
export function assembleProgram(text: string): AssembleProgramResult {
  const rawLines = text.split('\n');
  const labelMap: Record<string, number> = {};
  let codeAddr = CODE_BASE;
  let dataAddr = DATA_BASE;

  for (const rawLine of rawLines) {
    const stripped = rawLine.split(';')[0].trim();
    if (!stripped) continue;
    const [label, instr] = stripLabel(stripped);
    const s = (instr || '').toUpperCase().trim();

    if (isOrgLine(s)) {
      const org = parseOrg(instr);
      if (org !== null) {
        if (org >= DATA_BASE) dataAddr = org;
        else codeAddr = org;
      }
      assignLabel(label, org !== null && org >= DATA_BASE ? dataAddr : codeAddr, labelMap);
      continue;
    }
    if (isEndLine(s)) continue;

    if (isDataLine(s)) {
      assignLabel(label, dataAddr, labelMap);
      const bytes = s.startsWith('DB') ? encodeDb(instr) : encodeDw(instr);
      if (bytes) dataAddr += bytes.length;
      continue;
    }

    assignLabel(label, codeAddr, labelMap);
    if (!instr) continue;

    const resolved = resolveAsmIdentifiers(instr, labelMap, 'dummy');
    const bytes = assembleInstruction(resolved, codeAddr);
    codeAddr += bytes.length;
  }

  const newCodeMem = new Uint8Array(MEM_SIZE);
  const newDataMem = new Uint8Array(MEM_SIZE);
  let currentCodeAddr = CODE_BASE;
  let currentDataAddr = DATA_BASE;
  const errorLines: string[] = [];
  const newAddrToCSrc: Record<number, string> = {};
  const instructions: AssembledInstruction[] = [];
  let pendingCSrc: string | null = null;

  rawLines.forEach((rawLine, idx) => {
    const cSrcMatch = rawLine.match(/^\s*;\s*\d+:\s*(.+)$/);
    if (cSrcMatch) {
      pendingCSrc = cSrcMatch[1].trim();
      return;
    }
    const stripped = rawLine.split(';')[0].trim();
    if (!stripped) return;
    const [label, instr] = stripLabel(stripped);
    const s = (instr || '').toUpperCase().trim();

    if (isOrgLine(s)) {
      const org = parseOrg(instr);
      if (org !== null) {
        if (org >= DATA_BASE) currentDataAddr = org;
        else currentCodeAddr = org;
      }
      return;
    }
    if (isEndLine(s)) return;

    if (isDataLine(s)) {
      const bytes = s.startsWith('DB') ? encodeDb(instr) : encodeDw(instr);
      if (!bytes || bytes.length === 0) {
        errorLines.push(`Line ${idx + 1}: ${rawLine.trim()}`);
        return;
      }
      bytes.forEach((b) => {
        if (currentDataAddr < MEM_SIZE) newDataMem[currentDataAddr++] = b;
      });
      return;
    }

    if (pendingCSrc !== null && (label !== null || instr)) {
      newAddrToCSrc[currentCodeAddr] = pendingCSrc;
      pendingCSrc = null;
    }
    if (!instr) return;

    const resolved = resolveAsmIdentifiers(instr, labelMap, 'keep');
    const bytes = assembleInstruction(resolved, currentCodeAddr);
    if (bytes.length > 0) {
      instructions.push({ addr: currentCodeAddr, bytes: [...bytes], text: instr });
      bytes.forEach((b) => { if (currentCodeAddr < MEM_SIZE) newCodeMem[currentCodeAddr++] = b; });
    } else {
      errorLines.push(`Line ${idx + 1}: ${rawLine.trim()}`);
    }
  });

  return {
    codeMemory: newCodeMem,
    dataMemory: newDataMem,
    labelMap,
    errorLines,
    addrToCSrc: newAddrToCSrc,
    instructions,
  };
}
