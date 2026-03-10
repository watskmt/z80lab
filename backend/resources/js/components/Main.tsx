import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import {
  MEM_SIZE,
  CODE_BASE,
  DATA_BASE,
  IO_OUT_ADDR,
  IO_IN_ADDR,
  SZP_TABLE,
  initialRegs,
  S_FLAG,
  Z_FLAG,
  H_FLAG,
  PV_FLAG,
  N_FLAG,
  C_FLAG,
} from '../constants';
import type { Registers } from '../types';
import { assembleInstruction, disasm } from '../utils/assembler';
import { samplePrograms, sampleProgramLabels } from '../data/samples';
import { RegisterPanel } from './RegisterPanel.tsx';
import { ProgramPanel } from './ProgramPanel';
import { RamPanel } from './RamPanel';
import { StackPanel } from './StackPanel';
import { CodeGenerator } from './CodeGenerator';


const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.125rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;

  @media (min-width: 768px) {
    grid-template-columns: repeat(9, minmax(0, 1fr));
  }
`;

const RightSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-height: 0;
  overflow: hidden;

  @media (min-width: 768px) {
    grid-column: span 6 / span 6;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.125rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;

  @media (min-width: 768px) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
`;

const FooterAction = styled.div`
  background-color: #18181b; /* zinc-900 */
  padding: 0.25rem 0.375rem; /* px-1.5 py-1 -> py-1 is 0.25rem, wait tailwind py-1 is 4px=0.25rem, px-1.5 is 6px=0.375rem */
  border-radius: 0.5rem;
  border: 1px solid #47474a; /* zinc-800 */
  display: flex;
  justify-content: center;
  flex-shrink: 0;
`;

const StepButton = styled.button`
  background-color: #2563eb; /* blue-600 */
  color: white;
  font-weight: 900; /* font-black */
  padding: 0.25rem 1.5rem; /* px-6 py-1 */
  border-radius: 0.5rem;
  font-size: 1rem;
  border: none;
  border-bottom: 2px solid #1e40af; /* blue-800 */
  width: 100%;
  max-width: 28rem; /* max-w-md */
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    background-color: #3b82f6; /* blue-500 */
  }

  &:active {
    transform: translateY(0.125rem); /* translate-y-0.5 */
  }
`;

const PageContainer = styled.div`
  height: 100%;
  width: 100%;
  background-color: #09090b; /* zinc-950 */
  color: #e4e4e7; /* zinc-200 */
  padding: 0.125rem; /* p-0.5 is 2px */
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
`;

const MainWrapper = styled.div`
  width: 100%;
  min-width: 650px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* space-y-0.5 is 2px */
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #18181b; /* zinc-900 */
  padding: 0.125rem 0.375rem; /* px-1.5 py-0.5 */
  border-radius: 0.5rem;
  border: 1px solid #47474a; /* zinc-800 */
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  height: 2.25rem; /* h-9 */
`;

const Logo = styled.h1`
  font-size: 1.25rem; /* text-xl */
  font-weight: 900; /* font-black */
  color: #ffffff;
  font-style: italic;
  letter-spacing: -0.05em; /* tracking-tighter */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem; /* gap-1 */
`;

const LogoAccent = styled.span`
  color: #3b82f6; /* blue-500 */
  margin-left: 0.125rem;
`;

const SocialLinkWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
  border-left: 1px solid #47474a;
  padding-left: 0.5rem;
`;

const SocialLink = styled.a`
  color: #e1e1ea; /* zinc-500 */
  transition: color 0.15s;
  display: flex;
  align-items: center;

  &:hover {
    color: #ffffff;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* gap-2 */
  height: 100%;
`;

const HeaderButton = styled.button<{ variant?: 'blue' | 'green' | 'red' }>`
  padding: 0.25rem 0.5rem; /* px-2 py-1 */
  height: 1.5rem; /* h-6 */
  background-color: #47474a; /* zinc-800 */
  font-size: 8px;
  font-weight: 900;
  border-radius: 0.25rem;
  border: 1px solid #3f3f46; /* zinc-700 */
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.15s;

  color: ${props => {
    if (props.variant === 'blue') return '#60a5fa';
    if (props.variant === 'green') return '#4ade80';
    if (props.variant === 'red') return '#f87171';
    return '#e4e4e7';
  }};

  ${props => props.variant === 'red' && `
    background-color: rgba(69, 10, 10, 0.3);
    border-color: rgba(69, 10, 10, 0.5);
    &:hover { background-color: rgba(69, 10, 10, 0.5); }
  `}

  ${props => props.variant !== 'red' && `
    &:hover { background-color: #3f3f46; }
  `}
`;

const Select = styled.select`
  background-color: #47474a;
  color: #e4e4e7;
  font-size: 10px;
  font-weight: 700;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #3f3f46;
  outline: none;
  cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  width: 9rem;
  appearance: none;

  &:hover {
    background-color: #3f3f46;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const GlobalStyle = styled.div`
  width: 100%;
  height: 100%;
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    background: rgba(0, 0, 0, 0.2);
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(200, 200, 200, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(200, 200, 200, 0.8);
  }
`;

export default function Main() {
  useEffect(() => {
    // injectTailwind(); // Remove injectTailwind call
  }, []);
  const [codeMemory, setCodeMemory] = useState(
    samplePrograms.basicLoad()
  );
  const [dataMemory, setDataMemory] = useState(new Uint8Array(MEM_SIZE));
  const [prevDataMemory, setPrevDataMemory] = useState(new Uint8Array(MEM_SIZE));
  const [ioOut, setIoOut] = useState(0);
  const [ioIn, setIoIn] = useState(0);
  const [prevRegs, setPrevRegs] = useState<Registers>(initialRegs);
  const [regs, setRegs] = useState<Registers>(initialRegs);
  const [stackBaseAddr, setStackBaseAddr] = useState(initialRegs.SP);
  const [writes, setWrites] = useState<number[]>([]);
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [editingRamAddr, setEditingRamAddr] = useState<number | null>(null);
  const [editRamVal, setEditRamVal] = useState('');
  const [editingStackAddr, setEditingStackAddr] = useState<number | null>(null);
  const [editStackVal, setEditStackVal] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlightWrite, setHighlightWrite] = useState<{
    sourceAddr: number;
    destAddr: number;
    value: number;
  } | null>(null);

  const resetState = () => {
    const emptyMem = new Uint8Array(MEM_SIZE);
    setDataMemory(emptyMem);
    setPrevDataMemory(emptyMem);
    setIoOut(0);
    setIoIn(0);
    setRegs(initialRegs);
    setPrevRegs(initialRegs);
    setStackBaseAddr(initialRegs.SP);
    setWrites([]);
  };

  const handleUpdateCode = (addr: number, text: string) => {
    const bytes = assembleInstruction(text, addr);
    if (bytes.length > 0) {
      const newMem = new Uint8Array(codeMemory);
      bytes.forEach((b, i) => {
        if (addr + i < MEM_SIZE) newMem[addr + i] = b;
      });
      setCodeMemory(newMem);
    }
    setEditingAddr(null);
  };

  const handleUpdateRam = (addr: number, text: string) => {
    const val = parseInt(text, 16);
    if (!isNaN(val) && val >= 0 && val <= 0xff) {
      const newMem = new Uint8Array(dataMemory);
      newMem[addr] = val;
      setDataMemory(newMem);
      setPrevDataMemory(new Uint8Array(dataMemory));
    }
    setEditingRamAddr(null);
  };

  const handleUpdateStack = (addr: number, text: string) => {
    const val = parseInt(text, 16);
    if (!isNaN(val) && val >= 0 && val <= 0xff) {
      const newMem = new Uint8Array(dataMemory);
      newMem[addr] = val;
      setDataMemory(newMem);
      setPrevDataMemory(new Uint8Array(dataMemory));
    }
    setEditingStackAddr(null);
  };

  const saveAsm = () => {
    const lines = disasm(codeMemory, CODE_BASE)
      .filter((l) => l.text !== '-' && !l.text.startsWith('DB 00'))
      .map((l) => l.text);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.asm';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadAsmText = (text: string) => {
    const lines = text.split('\n');
    const newMem = new Uint8Array(MEM_SIZE);
    let currentAddr = CODE_BASE;
    let hasError = false;
    lines.forEach((line) => {
      if (!line.trim() || line.trim().startsWith(';')) return;
      const bytes = assembleInstruction(line, currentAddr);
      if (bytes.length > 0) {
        bytes.forEach((b) => {
          if (currentAddr < MEM_SIZE) newMem[currentAddr++] = b;
        });
      } else {
        const s = line.split(';')[0].toUpperCase().trim();
        if (s && s !== '-' && !s.startsWith('DB') && !s.startsWith('DW') && !s.startsWith('ORG') && !s.startsWith('END')) {
          console.warn('Failed to assemble instruction:', line);
          hasError = true;
        }
      }
    });
    setCodeMemory(newMem);
    resetState();
    if (hasError) {
      alert('Some instructions could not be assembled. Check the console for details.');
    }
  };

  const loadAsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      loadAsmText(text);
    };
    reader.readAsText(file);
  };

  const step = () => {
    setPrevRegs(regs);
    setPrevDataMemory(new Uint8Array(dataMemory)); // 前回のメモリ状態を保存
    const newData = new Uint8Array(dataMemory);
    const m = codeMemory;
    const dm = dataMemory;
    const r = { ...regs };
    const memWrite: number[] = [];
    let writeAnimation: { sourceAddr: number; destAddr: number; value: number } | null = null;

    const get8 = (addr: number) => {
      addr &= 0xffff;
      if (addr === IO_IN_ADDR) return ioIn;
      return dm[addr];
    };
    const set8 = (addr: number, val: number, sourceAddr?: number) => {
      addr &= 0xffff;
      val &= 0xff;
      if (addr === IO_OUT_ADDR) {
        setIoOut(val);
      }
      newData[addr] = val;
      memWrite.push(addr);

      // アニメーション情報を記録（レジスタからの書き込みのみ）
      if (sourceAddr !== undefined && sourceAddr !== addr) {
        writeAnimation = { sourceAddr, destAddr: addr, value: val };
      }
    };
    const get16 = (addr: number) => get8(addr) | (get8(addr + 1) << 8);
    const set16 = (addr: number, val: number) => {
      set8(addr, val & 0xff);
      set8(addr + 1, (val >> 8) & 0xff);
    };

    const push = (val: number) => {
      r.SP = (r.SP - 2) & 0xffff;
      set16(r.SP, val);
    };
    const pop = () => {
      const val = get16(r.SP);
      r.SP = (r.SP + 2) & 0xffff;
      return val;
    };

    const getReg = (idx: number) => {
      if (idx === 0) return r.B;
      if (idx === 1) return r.C;
      if (idx === 2) return r.D;
      if (idx === 3) return r.E;
      if (idx === 4) return r.H;
      if (idx === 5) return r.L;
      if (idx === 6) return get8((r.H << 8) | r.L);
      return r.A;
    };
    const setReg = (idx: number, val: number) => {
      val &= 0xff;
      if (idx === 0) r.B = val;
      else if (idx === 1) r.C = val;
      else if (idx === 2) r.D = val;
      else if (idx === 3) r.E = val;
      else if (idx === 4) r.H = val;
      else if (idx === 5) r.L = val;
      else if (idx === 6) set8((r.H << 8) | r.L, val, CODE_BASE);
      else r.A = val;
    };

    const add8 = (a: number, b: number, cy = 0) => {
      const res = a + b + cy;
      const h = (a & 0xf) + (b & 0xf) + cy;
      r.F = SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
      if (res > 0xff) r.F |= C_FLAG;
      if (h > 0xf) r.F |= H_FLAG;
      if (((a ^ ~b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
      return res & 0xff;
    };
    const sub8 = (a: number, b: number, cy = 0) => {
      const res = a - b - cy;
      const h = (a & 0xf) - (b & 0xf) - cy;
      r.F =
        SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
      r.F |= N_FLAG;
      if (res < 0) r.F |= C_FLAG;
      if (h < 0) r.F |= H_FLAG;
      if (((a ^ b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
      return res & 0xff;
    };
    const cp8 = (a: number, b: number) => {
      sub8(a, b);
    };
    const and8 = (val: number) => {
      r.A &= val;
      r.F = SZP_TABLE[r.A] | H_FLAG;
    };
    const or8 = (val: number) => {
      r.A |= val;
      r.F = SZP_TABLE[r.A];
    };
    const xor8 = (val: number) => {
      r.A ^= val;
      r.F = SZP_TABLE[r.A];
    };

    const op = m[r.PC++];
    r.R = (r.R + 1) & 0x7f;

    if (op >= 0x40 && op <= 0x7f) {
      if (op === 0x76) {
        r.PC--;
      } else {
        setReg((op >> 3) & 7, getReg(op & 7));
      }
    } else if (op >= 0x80 && op <= 0xbf) {
      const val = getReg(op & 7);
      switch ((op >> 3) & 7) {
        case 0: r.A = add8(r.A, val); break;
        case 1: r.A = add8(r.A, val, (r.F & C_FLAG)); break;
        case 2: r.A = sub8(r.A, val); break;
        case 3: r.A = sub8(r.A, val, (r.F & C_FLAG)); break;
        case 4: and8(val); break;
        case 5: xor8(val); break;
        case 6: or8(val); break;
        case 7: cp8(r.A, val); break;
      }
    } else {
      switch (op) {
        case 0x00: break;
        case 0x01: r.C = m[r.PC++]; r.B = m[r.PC++]; break;
        case 0x02: set8((r.B << 8) | r.C, r.A, CODE_BASE); break;
        case 0x03: { const v = ((r.B << 8) | r.C + 1) & 0xffff; r.B = v >> 8; r.C = v & 0xff; break; }
        case 0x04: r.B = add8(r.B, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG); break;
        case 0x05: r.B = sub8(r.B, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG) | N_FLAG; break;
        case 0x06: r.B = m[r.PC++]; break;
        case 0x08: { // EX AF,AF'
          const tmp = r.A; r.A = r.A2; r.A2 = tmp;
          const tmp2 = r.F; r.F = r.F2; r.F2 = tmp2;
          break;
        }
        case 0x09: {
          const hl = (r.H << 8) | r.L; const bc = (r.B << 8) | r.C; const res = hl + bc;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        }
        case 0x0a: r.A = get8((r.B << 8) | r.C); break;
        case 0x0b: { const v = ((r.B << 8) | r.C - 1) & 0xffff; r.B = v >> 8; r.C = v & 0xff; break; }
        case 0x0c: r.C = add8(r.C, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG); break;
        case 0x0d: r.C = sub8(r.C, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG) | N_FLAG; break;
        case 0x0e: r.C = m[r.PC++]; break;
        case 0x10: { let off = m[r.PC++]; if (off > 127) off -= 256; r.B = (r.B - 1) & 0xff; if (r.B !== 0) r.PC += off; break; }
        case 0x11: r.E = m[r.PC++]; r.D = m[r.PC++]; break;
        case 0x12: set8((r.D << 8) | r.E, r.A, CODE_BASE); break;
        case 0x13: { const v = ((r.D << 8) | r.E + 1) & 0xffff; r.D = v >> 8; r.E = v & 0xff; break; }
        case 0x14: r.D = add8(r.D, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG); break;
        case 0x15: r.D = sub8(r.D, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG) | N_FLAG; break;
        case 0x16: r.D = m[r.PC++]; break;
        case 0x18: { let off = m[r.PC++]; if (off > 127) off -= 256; r.PC += off; break; }
        case 0x19: {
          const hl = (r.H << 8) | r.L; const de = (r.D << 8) | r.E; const res = hl + de;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        }
        case 0x1a: r.A = get8((r.D << 8) | r.E); break;
        case 0x1b: { const v = ((r.D << 8) | r.E - 1) & 0xffff; r.D = v >> 8; r.E = v & 0xff; break; }
        case 0x1c: r.E = add8(r.E, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG); break;
        case 0x1d: r.E = sub8(r.E, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG) | N_FLAG; break;
        case 0x1e: r.E = m[r.PC++]; break;
        case 0x20: { let off = m[r.PC++]; if (off > 127) off -= 256; if (!(r.F & Z_FLAG)) r.PC += off; break; }
        case 0x21: r.L = m[r.PC++]; r.H = m[r.PC++]; break;
        case 0x22: { const adr = m[r.PC++] | (m[r.PC++] << 8); set16(adr, (r.H << 8) | r.L); break; }
        case 0x23: { const v = ((r.H << 8) | r.L + 1) & 0xffff; r.H = v >> 8; r.L = v & 0xff; break; }
        case 0x24: r.H = add8(r.H, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG); break;
        case 0x25: r.H = sub8(r.H, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG) | N_FLAG; break;
        case 0x26: r.H = m[r.PC++]; break;
        case 0x28: { let off = m[r.PC++]; if (off > 127) off -= 256; if (r.F & Z_FLAG) r.PC += off; break; }
        case 0x29: {
          const hl = (r.H << 8) | r.L; const res = hl + hl;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        }
        case 0x2a: { const adr = m[r.PC++] | (m[r.PC++] << 8); const v = get16(adr); r.H = v >> 8; r.L = v & 0xff; break; }
        case 0x2b: { const v = ((r.H << 8) | r.L - 1) & 0xffff; r.H = v >> 8; r.L = v & 0xff; break; }
        case 0x2c: r.L = add8(r.L, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG); break;
        case 0x2d: r.L = sub8(r.L, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG) | N_FLAG; break;
        case 0x2e: r.L = m[r.PC++]; break;
        case 0x30: { let off = m[r.PC++]; if (off > 127) off -= 256; if (!(r.F & C_FLAG)) r.PC += off; break; }
        case 0x31: r.SP = m[r.PC++] | (m[r.PC++] << 8); break;
        case 0x32: { const adr = m[r.PC++] | (m[r.PC++] << 8); set8(adr, r.A, CODE_BASE); break; }
        case 0x33: r.SP = (r.SP + 1) & 0xffff; break;
        case 0x34: { const adr = (r.H << 8) | r.L; const v = add8(get8(adr), 1); set8(adr, v); r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG); break; }
        case 0x35: { const adr = (r.H << 8) | r.L; const v = sub8(get8(adr), 1); set8(adr, v); r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG) | N_FLAG; break; }
        case 0x36: set8((r.H << 8) | r.L, m[r.PC++]); break;
        case 0x38: { let off = m[r.PC++]; if (off > 127) off -= 256; if (r.F & C_FLAG) r.PC += off; break; }
        case 0x39: {
          const hl = (r.H << 8) | r.L; const res = hl + r.SP;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        }
        case 0x3a: { const adr = m[r.PC++] | (m[r.PC++] << 8); r.A = get8(adr); break; }
        case 0x3b: r.SP = (r.SP - 1) & 0xffff; break;
        case 0x3c: r.A = add8(r.A, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG); break;
        case 0x3d: r.A = sub8(r.A, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG) | N_FLAG; break;
        case 0x3e: r.A = m[r.PC++]; break;
        case 0xc0: if (!(r.F & Z_FLAG)) r.PC = pop(); break;
        case 0xc1: { const v = pop(); r.C = v & 0xff; r.B = v >> 8; break; }
        case 0xc2: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & Z_FLAG)) r.PC = adr; break; }
        case 0xc3: r.PC = m[r.PC++] | (m[r.PC++] << 8); break;
        case 0xc4: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & Z_FLAG)) { push(r.PC); r.PC = adr; } break; }
        case 0xc5: push((r.B << 8) | r.C); break;
        case 0xc6: r.A = add8(r.A, m[r.PC++]); break;
        case 0xc7: push(r.PC); r.PC = 0x00; break;
        case 0xc8: if (r.F & Z_FLAG) r.PC = pop(); break;
        case 0xc9: r.PC = pop(); break;
        case 0xca: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & Z_FLAG) r.PC = adr; break; }
        case 0xcc: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & Z_FLAG) { push(r.PC); r.PC = adr; } break; }
        case 0xcd: { const adr = m[r.PC++] | (m[r.PC++] << 8); push(r.PC); r.PC = adr; break; }
        case 0xce: r.A = add8(r.A, m[r.PC++], (r.F & C_FLAG)); break;
        case 0xcf: push(r.PC); r.PC = 0x08; break;
        case 0xd0: if (!(r.F & C_FLAG)) r.PC = pop(); break;
        case 0xd1: { const v = pop(); r.E = v & 0xff; r.D = v >> 8; break; }
        case 0xd2: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & C_FLAG)) r.PC = adr; break; }
        case 0xd4: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & C_FLAG)) { push(r.PC); r.PC = adr; } break; }
        case 0xd5: push((r.D << 8) | r.E); break;
        case 0xd6: r.A = sub8(r.A, m[r.PC++]); break;
        case 0xd7: push(r.PC); r.PC = 0x10; break;
        case 0xd8: if (r.F & C_FLAG) r.PC = pop(); break;
        case 0xd9: { // EXX
          let tmp = r.B; r.B = r.B2; r.B2 = tmp;
          tmp = r.C; r.C = r.C2; r.C2 = tmp;
          tmp = r.D; r.D = r.D2; r.D2 = tmp;
          tmp = r.E; r.E = r.E2; r.E2 = tmp;
          tmp = r.H; r.H = r.H2; r.H2 = tmp;
          tmp = r.L; r.L = r.L2; r.L2 = tmp;
          break;
        }
        case 0xda: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & C_FLAG) r.PC = adr; break; }
        case 0xdc: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & C_FLAG) { push(r.PC); r.PC = adr; } break; }
        case 0xde: r.A = sub8(r.A, m[r.PC++], (r.F & C_FLAG)); break;
        case 0xdf: push(r.PC); r.PC = 0x18; break;
        case 0xe0: if (!(r.F & PV_FLAG)) r.PC = pop(); break;
        case 0xe1: { const v = pop(); r.L = v & 0xff; r.H = v >> 8; break; }
        case 0xe2: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & PV_FLAG)) r.PC = adr; break; }
        case 0xe3: { const v = get16(r.SP); set16(r.SP, (r.H << 8) | r.L); r.H = v >> 8; r.L = v & 0xff; break; }
        case 0xe4: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & PV_FLAG)) { push(r.PC); r.PC = adr; } break; }
        case 0xe5: push((r.H << 8) | r.L); break;
        case 0xe6: and8(m[r.PC++]); break;
        case 0xe7: push(r.PC); r.PC = 0x20; break;
        case 0xe8: if (r.F & PV_FLAG) r.PC = pop(); break;
        case 0xe9: r.PC = (r.H << 8) | r.L; break;
        case 0xea: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & PV_FLAG) r.PC = adr; break; }
        case 0xeb: { let t = r.H; r.H = r.D; r.D = t; t = r.L; r.L = r.E; r.E = t; break; }
        case 0xec: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & PV_FLAG) { push(r.PC); r.PC = adr; } break; }
        case 0xee: xor8(m[r.PC++]); break;
        case 0xef: push(r.PC); r.PC = 0x28; break;
        case 0xf0: if (!(r.F & S_FLAG)) r.PC = pop(); break;
        case 0xf1: { const v = pop(); r.F = v & 0xff; r.A = v >> 8; break; }
        case 0xf2: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & S_FLAG)) r.PC = adr; break; }
        case 0xf3: break;
        case 0xf4: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & S_FLAG)) { push(r.PC); r.PC = adr; } break; }
        case 0xf5: push((r.A << 8) | r.F); break;
        case 0xf6: or8(m[r.PC++]); break;
        case 0xf7: push(r.PC); r.PC = 0x30; break;
        case 0xf8: if (r.F & S_FLAG) r.PC = pop(); break;
        case 0xf9: r.SP = (r.H << 8) | r.L; break;
        case 0xfa: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & S_FLAG) r.PC = adr; break; }
        case 0xfb: break;
        case 0xfc: { const adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & S_FLAG) { push(r.PC); r.PC = adr; } break; }
        case 0xfe: cp8(r.A, m[r.PC++]); break;
        case 0xff: push(r.PC); r.PC = 0x38; break;

        case 0xcb: {
          const cbOp = m[r.PC++];
          const val = getReg(cbOp & 7);
          let res = val;
          switch (cbOp >> 3) {
            case 0:
              r.F = (val >> 7) & C_FLAG; res = ((val << 1) | r.F) & 0xff; r.F |= SZP_TABLE[res]; break;
            case 1:
              r.F = val & C_FLAG; res = (val >> 1) | (r.F << 7); r.F |= SZP_TABLE[res]; break;
            case 2: {
              const c = r.F & C_FLAG; r.F = (val >> 7) & C_FLAG; res = ((val << 1) | c) & 0xff; r.F |= SZP_TABLE[res]; break;
            }
            case 3: {
              const c2 = r.F & C_FLAG; r.F = val & C_FLAG; res = (val >> 1) | (c2 << 7); r.F |= SZP_TABLE[res]; break;
            }
            case 4:
              r.F = (val >> 7) & C_FLAG; res = (val << 1) & 0xff; r.F |= SZP_TABLE[res]; break;
            case 5:
              r.F = val & C_FLAG; res = (val >> 1) | (val & 0x80); r.F |= SZP_TABLE[res]; break;
            case 7:
              r.F = val & C_FLAG; res = (val >> 1); r.F |= SZP_TABLE[res]; break;
            default:
              if ((cbOp >> 6) === 1) {
                const bit = (cbOp >> 3) & 7; r.F = (r.F & C_FLAG) | H_FLAG | (SZP_TABLE[val & (1 << bit)] & ~PV_FLAG);
                if (bit === 7 && (val & 0x80)) r.F |= S_FLAG;
                return;
              } else if ((cbOp >> 6) === 2) {
                res = val & ~(1 << ((cbOp >> 3) & 7));
              } else if ((cbOp >> 6) === 3) {
                res = val | (1 << ((cbOp >> 3) & 7));
              }
          }
          setReg(cbOp & 7, res);
          break;
        }

        case 0xdb: { // IN A,(n)
          const port = m[r.PC++];
          if (port === 1) { // Port 1: Input Switch
            r.A = ioIn;
          } else {
            r.A = 0;
          }
          break;
        }
        case 0xd3: { // OUT (n),A
          const port = m[r.PC++];
          if (port === 0) { // Port 0: Output Lamp
            setIoOut(r.A);
          }
          break;
        }
        case 0xed: {
          const edOp = m[r.PC++];
          switch (edOp) {
            // NEG - Negate A
            case 0x44: r.A = sub8(0, r.A); break;
            // IM 0, IM 1, IM 2
            case 0x46: r.IM = 0; break;
            case 0x56: r.IM = 1; break;
            case 0x5e: r.IM = 2; break;
            // LD I,A / LD R,A / LD A,I / LD A,R
            case 0x47: r.I = r.A; break;
            case 0x4f: r.R = r.A; break;
            case 0x57: r.A = r.I; r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            case 0x5f: r.A = r.R; r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            // IN r, (C) / OUT (C), r
            case 0x40: case 0x48: case 0x50: case 0x58: case 0x60: case 0x68: case 0x78: {
              const port = r.C;
              let val = 0;
              if (port === 1) val = ioIn;
              setReg((edOp >> 3) & 7, val);
              r.F = (r.F & C_FLAG) | SZP_TABLE[getReg((edOp >> 3) & 7)];
              break;
            }
            case 0x41: case 0x49: case 0x51: case 0x59: case 0x61: case 0x69: case 0x79: {
              const port = r.C;
              if (port === 0) {
                setIoOut(getReg((edOp >> 3) & 7));
              }
              break;
            }
            // 16-bit ADC HL,ss
            case 0x4a: { // ADC HL,BC
              const hl = (r.H << 8) | r.L; const bc = (r.B << 8) | r.C; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl + bc + carry;
              r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x5a: { // ADC HL,DE
              const hl = (r.H << 8) | r.L; const de = (r.D << 8) | r.E; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl + de + carry;
              r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x6a: { // ADC HL,HL
              const hl = (r.H << 8) | r.L; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl + hl + carry;
              r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x7a: { // ADC HL,SP
              const hl = (r.H << 8) | r.L; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl + r.SP + carry;
              r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            // 16-bit SBC HL,ss
            case 0x42: { // SBC HL,BC
              const hl = (r.H << 8) | r.L; const bc = (r.B << 8) | r.C; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl - bc - carry;
              r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x52: { // SBC HL,DE
              const hl = (r.H << 8) | r.L; const de = (r.D << 8) | r.E; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl - de - carry;
              r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x62: { // SBC HL,HL
              const hl = (r.H << 8) | r.L; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl - hl - carry;
              r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            case 0x72: { // SBC HL,SP
              const hl = (r.H << 8) | r.L; const carry = (r.F & C_FLAG) ? 1 : 0;
              const res = hl - r.SP - carry;
              r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
              r.H = (res >> 8) & 0xff; r.L = res & 0xff;
              break;
            }
            // RETI / RETN
            case 0x4d: r.PC = pop(); break; // RETI
            case 0x45: r.PC = pop(); break; // RETN
            // RRD / RLD
            case 0x67: {
              const hlVal = get8((r.H << 8) | r.L); const lowA = r.A & 0x0f;
              r.A = (r.A & 0xf0) | (hlVal & 0x0f);
              set8((r.H << 8) | r.L, (hlVal >> 4) | (lowA << 4));
              r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            }
            case 0x6f: {
              const hlVal = get8((r.H << 8) | r.L); const lowA = r.A & 0x0f;
              r.A = (r.A & 0xf0) | (hlVal >> 4);
              set8((r.H << 8) | r.L, (hlVal << 4) | lowA);
              r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            }
            // Block instructions
            case 0xb0: { // LDIR
              let src = (r.H << 8) | r.L; let dst = (r.D << 8) | r.E; let len = (r.B << 8) | r.C;
              if (len > 0) {
                set8(dst, get8(src));
                src = (src + 1) & 0xffff; dst = (dst + 1) & 0xffff; len = (len - 1) & 0xffff;
                r.H = src >> 8; r.L = src & 0xff; r.D = dst >> 8; r.E = dst & 0xff; r.B = len >> 8; r.C = len & 0xff;
                if (len > 0) r.PC -= 2;
                r.F &= ~(N_FLAG | H_FLAG | PV_FLAG);
              }
              break;
            }
            case 0xb8: { // LDDR
              let src = (r.H << 8) | r.L; let dst = (r.D << 8) | r.E; let len = (r.B << 8) | r.C;
              if (len > 0) {
                set8(dst, get8(src));
                src = (src - 1) & 0xffff; dst = (dst - 1) & 0xffff; len = (len - 1) & 0xffff;
                r.H = src >> 8; r.L = src & 0xff; r.D = dst >> 8; r.E = dst & 0xff; r.B = len >> 8; r.C = len & 0xff;
                if (len > 0) r.PC -= 2;
                r.F &= ~(N_FLAG | H_FLAG | PV_FLAG);
              }
              break;
            }
            case 0xb1: { // CPIR
              let addr = (r.H << 8) | r.L; let len = (r.B << 8) | r.C;
              if (len > 0) {
                const val = get8(addr);
                cp8(r.A, val);
                addr = (addr + 1) & 0xffff; len = (len - 1) & 0xffff;
                r.H = addr >> 8; r.L = addr & 0xff; r.B = len >> 8; r.C = len & 0xff;
                if (len > 0 && !(r.F & Z_FLAG)) r.PC -= 2;
              }
              break;
            }
            case 0xb9: { // CPDR
              let addr = (r.H << 8) | r.L; let len = (r.B << 8) | r.C;
              if (len > 0) {
                const val = get8(addr);
                cp8(r.A, val);
                addr = (addr - 1) & 0xffff; len = (len - 1) & 0xffff;
                r.H = addr >> 8; r.L = addr & 0xff; r.B = len >> 8; r.C = len & 0xff;
                if (len > 0 && !(r.F & Z_FLAG)) r.PC -= 2;
              }
              break;
            }
            case 0xa2: { // INIR
              let addr = (r.H << 8) | r.L;
              const port = r.C;
              const val = (port === 1) ? ioIn : 0;
              set8(addr, val);
              r.B = (r.B - 1) & 0xff;
              addr = (addr + 1) & 0xffff;
              r.H = addr >> 8; r.L = addr & 0xff;
              r.F = (r.B === 0) ? Z_FLAG : 0;
              if (r.B > 0) r.PC -= 2;
              break;
            }
            case 0xaa: { // INDR
              let addr = (r.H << 8) | r.L;
              const port = r.C;
              const val = (port === 1) ? ioIn : 0;
              set8(addr, val);
              r.B = (r.B - 1) & 0xff;
              addr = (addr - 1) & 0xffff;
              r.H = addr >> 8; r.L = addr & 0xff;
              r.F = (r.B === 0) ? Z_FLAG : 0;
              if (r.B > 0) r.PC -= 2;
              break;
            }
            case 0xa3: { // OTIR
              let addr = (r.H << 8) | r.L;
              const port = r.C;
              const val = get8(addr);
              if (port === 0) setIoOut(val);
              r.B = (r.B - 1) & 0xff;
              addr = (addr + 1) & 0xffff;
              r.H = addr >> 8; r.L = addr & 0xff;
              r.F = (r.B === 0) ? Z_FLAG : 0;
              if (r.B > 0) r.PC -= 2;
              break;
            }
            case 0xab: { // OTDR
              let addr = (r.H << 8) | r.L;
              const port = r.C;
              const val = get8(addr);
              if (port === 0) setIoOut(val);
              r.B = (r.B - 1) & 0xff;
              addr = (addr - 1) & 0xffff;
              r.H = addr >> 8; r.L = addr & 0xff;
              r.F = (r.B === 0) ? Z_FLAG : 0;
              if (r.B > 0) r.PC -= 2;
              break;
            }
            default: break;
          }
          break;
        }
        case 0xdd: case 0xfd: {
          const isIY = (op === 0xfd);
          const subOp = m[r.PC++];
          const idxReg = isIY ? 'IY' : 'IX';

          if (subOp === 0x21) {
            // LD IX/IY, nn
            r[idxReg] = m[r.PC++] | (m[r.PC++] << 8);
          } else if (subOp === 0x36) {
            // LD (IX/IY+d), n
            let d = m[r.PC++];
            if (d > 127) d -= 256;
            const n = m[r.PC++];
            set8((r[idxReg] + d) & 0xffff, n, CODE_BASE);
          } else if (subOp === 0x7e) {
            // LD A, (IX/IY+d)
            let d = m[r.PC++];
            if (d > 127) d -= 256;
            r.A = get8((r[idxReg] + d) & 0xffff);
          } else if (subOp === 0x77) {
            // LD (IX/IY+d), A
            let d = m[r.PC++];
            if (d > 127) d -= 256;
            set8((r[idxReg] + d) & 0xffff, r.A, CODE_BASE);
          } else if (subOp === 0x23) {
            // INC IX/IY
            r[idxReg] = (r[idxReg] + 1) & 0xffff;
          } else if (subOp === 0x2b) {
            // DEC IX/IY
            r[idxReg] = (r[idxReg] - 1) & 0xffff;
          } else if (subOp === 0xe5) {
            // PUSH IX/IY
            push(r[idxReg]);
          } else if (subOp === 0xe1) {
            // POP IX/IY
            r[idxReg] = pop();
          }
          break;
        }

        default: break;
      }
    }

    setDataMemory(newData);
    setRegs(r);
    setWrites(memWrite);

    // ハイライト設定
    if (writeAnimation) {
      setHighlightWrite(writeAnimation);
      setTimeout(() => setHighlightWrite(null), 800);
    }
  };


  return (
    <GlobalStyle>
      <PageContainer>
        <MainWrapper>
          <Header>
            <Logo>
              Z80<LogoAccent>LAB</LogoAccent>
              <SocialLinkWrapper>
                <SocialLink
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="X (Twitter)"
                >
                  <svg style={{ width: '1rem', height: '1rem' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </SocialLink>
              </SocialLinkWrapper>
            </Logo>
            <HeaderActions>
              <HeaderButton variant="blue" onClick={saveAsm}>
                Save ASM
              </HeaderButton>
              <CodeGenerator onLoadCode={loadAsmText} />
              <HeaderButton variant="green" onClick={() => fileInputRef.current?.click()}>
                Load ASM
              </HeaderButton>
              <HiddenInput
                type="file"
                ref={fileInputRef}
                onChange={loadAsm}
                accept=".asm,.txt"
              />
              <Select
                onChange={(e) => {
                  const prog = samplePrograms[e.target.value];
                  if (prog) {
                    const newMem = prog();
                    setCodeMemory(newMem);
                    resetState();
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  SAMPLE CODE...
                </option>
                {Object.keys(samplePrograms).map((name) => (
                  <option key={name} value={name}>
                    {sampleProgramLabels[name]}
                  </option>
                ))}
              </Select>
              <HeaderButton variant="red" onClick={resetState}>
                RESET
              </HeaderButton>
            </HeaderActions>
          </Header>

          <MainGrid>
            <RegisterPanel
              regs={regs}
              prevRegs={prevRegs}
              ioOut={ioOut}
              ioIn={ioIn}
              setIoIn={setIoIn}
              highlightSource={highlightWrite?.sourceAddr === CODE_BASE}
            />

            <RightSection>
              <ContentGrid>
                <ProgramPanel
                  codeMemory={codeMemory}
                  pc={regs.PC}
                  editingAddr={editingAddr}
                  editVal={editVal}
                  setEditingAddr={setEditingAddr}
                  setEditVal={setEditVal}
                  handleUpdateCode={handleUpdateCode}
                  CODE_BASE={CODE_BASE}
                />

                <RamPanel
                  dataMemory={dataMemory}
                  prevDataMemory={prevDataMemory}
                  writes={writes}
                  DATA_BASE={DATA_BASE}
                  highlightAddr={highlightWrite?.destAddr}
                  editingAddr={editingRamAddr}
                  editVal={editRamVal}
                  setEditingAddr={setEditingRamAddr}
                  setEditVal={setEditRamVal}
                  handleUpdate={handleUpdateRam}
                />

                <StackPanel
                  stackBaseAddr={stackBaseAddr}
                  sp={regs.SP}
                  dataMemory={dataMemory}
                  prevDataMemory={prevDataMemory}
                  writes={writes}
                  editingAddr={editingStackAddr}
                  editVal={editStackVal}
                  setEditingAddr={setEditingStackAddr}
                  setEditVal={setEditStackVal}
                  handleUpdate={handleUpdateStack}
                />
              </ContentGrid>

              <FooterAction>
                <StepButton onClick={step}>
                  STEP EXECUTE
                </StepButton>
              </FooterAction>
            </RightSection>
          </MainGrid>
        </MainWrapper>
      </PageContainer>
    </GlobalStyle>
  );
}
