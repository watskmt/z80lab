import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import {
  MEM_SIZE,
  CODE_BASE,
  DATA_BASE,
} from '../constants';
import { assembleInstruction, disasm } from '../utils/assembler';
import { samplePrograms, sampleProgramLabels } from '../data/samples';
import { RegisterPanel } from './RegisterPanel.tsx';
import { ProgramPanel } from './ProgramPanel';
import { RamPanel } from './RamPanel';
import { StackPanel } from './StackPanel';
import { CodeGenerator } from './CodeGenerator';
import { useZ80 } from '../hooks/useZ80';
import { Compiler } from '@compiler/Compiler';


const MainGrid = styled.div`
  display: grid;
  gap: 0.125rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;

    grid-template-columns: repeat(8, minmax(0, 1fr));
`;

const RightSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-height: 0;
  overflow: hidden;

    grid-column: span 5 / span 5;
`;

const ContentGrid = styled.div`
  display: grid;
  gap: 0.125rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;

    grid-template-columns: 1fr 150px 150px;
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

const HeaderButton = styled.button<{ $variant?: 'blue' | 'green' | 'red' }>`
  padding: 0.25rem 0.5rem; /* px-2 py-1 */
  height: 1.8rem; /* h-6 */
  background-color: #47474a; /* zinc-800 */
  font-size: 14px;
  font-weight: 900;
  border-radius: 0.25rem;
  border: 1px solid #3f3f46; /* zinc-700 */
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.15s;

  color: ${props => {
    if (props.$variant === 'blue') return '#60a5fa';
    if (props.$variant === 'green') return '#4ade80';
    if (props.$variant === 'red') return '#f87171';
    return '#e4e4e7';
  }};

  ${props => props.$variant === 'red' && `
    background-color: rgba(69, 10, 10, 0.3);
    border-color: rgba(69, 10, 10, 0.5);
    &:hover { background-color: rgba(69, 10, 10, 0.5); }
  `}

  ${props => props.$variant !== 'red' && `
    &:hover { background-color: #3f3f46; }
  `}

`;

const Select = styled.select`
  background-color: #47474a;
  color: #e4e4e7;
  font-size: 14px;
  font-weight: 700;
  height: 1.8rem;
  padding: 0 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #3f3f46;
  outline: none;
  cursor: pointer;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  width: 10rem;
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
  const {
    codeMemory, setCodeMemory,
    dataMemory,
    prevDataMemory,
    ioOut,
    ioIn, setIoIn,
    prevRegs,
    regs,
    stackBaseAddr,
    writes,
    highlightWrite,
    resetState,
    step,
    updateRam,
  } = useZ80();

  useEffect(() => {
    // injectTailwind(); // Remove injectTailwind call
  }, []);

  const [addrToCSrc, setAddrToCSrc] = useState<Record<number, string>>({});
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [editingRamAddr, setEditingRamAddr] = useState<number | null>(null);
  const [editRamVal, setEditRamVal] = useState('');
  const [editingStackAddr, setEditingStackAddr] = useState<number | null>(null);
  const [editStackVal, setEditStackVal] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cFileInputRef = useRef<HTMLInputElement>(null);

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
      updateRam(addr, val);
    }
    setEditingRamAddr(null);
  };

  const handleUpdateStack = (addr: number, text: string) => {
    const val = parseInt(text, 16);
    if (!isNaN(val) && val >= 0 && val <= 0xff) {
      updateRam(addr, val);
    }
    setEditingStackAddr(null);
  };

  const saveAsm = () => {
    const lines = disasm(codeMemory, CODE_BASE)
      .filter((l) => l.text !== '-' && !l.text.startsWith('?? 00'))
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
    const rawLines = text.split('\n');

    const isDirective = (s: string) =>
      !s || s === '-' || s.startsWith('DB') || s.startsWith('DW') || s.startsWith('ORG') || s.startsWith('END');

    // Strip label prefix from a line, returning [labelOrNull, instrLine]
    const stripLabel = (line: string): [string | null, string] => {
      const m = line.match(/^([A-Za-z_]\w*):\s*(.*)/);
      return m ? [m[1], m[2].trim()] : [null, line.trim()];
    };

    // Pass 1: collect label → address
    const labelMap: Record<string, number> = {};
    let addr = CODE_BASE;
    for (const rawLine of rawLines) {
      const stripped = rawLine.split(';')[0].trim();
      if (!stripped) continue;
      const [label, instr] = stripLabel(stripped);
      if (label !== null) labelMap[label] = addr;
      if (!instr) continue;
      const s = instr.toUpperCase().trim();
      if (isDirective(s)) continue;
      // Substitute dummy address for unknown labels to get correct byte count
      const resolved = instr.replace(/\b([A-Za-z_]\w*)\b/g, (m) => (m in labelMap ? labelMap[m].toString() : '0'));
      const bytes = assembleInstruction(resolved, addr);
      addr += bytes.length > 0 ? bytes.length : 1;
    }

    // Pass 2: assemble with full label resolution
    const newMem = new Uint8Array(MEM_SIZE);
    let currentAddr = CODE_BASE;
    const errorLines: string[] = [];
    const newAddrToCSrc: Record<number, string> = {};
    let pendingCSrc: string | null = null;
    rawLines.forEach((rawLine, idx) => {
      // Detect C source annotation emitted by Z80CodeGen: "; N: source line"
      const cSrcMatch = rawLine.match(/^\s*;\s*\d+:\s*(.+)$/);
      if (cSrcMatch) {
        pendingCSrc = cSrcMatch[1].trim();
        return;
      }
      const stripped = rawLine.split(';')[0].trim();
      if (!stripped) return;
      const [label, instr] = stripLabel(stripped);
      if (pendingCSrc !== null && (label !== null || instr)) {
        newAddrToCSrc[currentAddr] = pendingCSrc;
        pendingCSrc = null;
      }
      if (!instr) return;
      const s = instr.toUpperCase().trim();
      if (isDirective(s)) return;
      const resolved = instr.replace(/\b([A-Za-z_]\w*)\b/g, (m) => (m in labelMap ? labelMap[m].toString() : m));
      const bytes = assembleInstruction(resolved, currentAddr);
      if (bytes.length > 0) {
        bytes.forEach((b) => { if (currentAddr < MEM_SIZE) newMem[currentAddr++] = b; });
      } else {
        console.warn('Failed to assemble instruction:', rawLine);
        errorLines.push(`Line ${idx + 1}: ${rawLine.trim()}`);
      }
    });

    setCodeMemory(newMem);
    setAddrToCSrc(newAddrToCSrc);
    resetState();
    if (errorLines.length > 0) {
      alert(`Failed to assemble ${errorLines.length} instruction(s):\n\n${errorLines.join('\n')}`);
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

  const loadC = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const source = ev.target?.result as string;
      const compiler = new Compiler({ sourceFile: file.name, origin: 0x0000 });
      const result = compiler.compile(source);
      if (!result.success) {
        const messages = result.errors.map(err => `${err.file}:${err.line}:${err.col}: ${err.message}`).join('\n');
        alert(`Compile errors:\n${messages}`);
        return;
      }
      console.log('[Compiler] Generated assembly:\n' + result.assembly);
      loadAsmText(result.assembly);
    };
    reader.readAsText(file);
    e.target.value = '';
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
                  href={`https://x.com/intent/post?url=${encodeURIComponent(window.location.href)}`}
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
              <HeaderButton $variant="blue" onClick={saveAsm}>
                Save ASM
              </HeaderButton>
              <CodeGenerator onLoadCode={loadAsmText} />
              <HeaderButton $variant="green" onClick={() => cFileInputRef.current?.click()}>
                Import C
              </HeaderButton>
              <HiddenInput
                type="file"
                ref={cFileInputRef}
                onChange={loadC}
                accept=".c"
              />
              <HeaderButton $variant="green" onClick={() => fileInputRef.current?.click()}>
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
                <option value="" disabled style={{ fontSize: '14px' }}>
                  SAMPLE CODE...
                </option>
                {Object.keys(samplePrograms).map((name) => (
                  <option key={name} value={name} style={{ fontSize: '14px' }}>
                    {sampleProgramLabels[name]}
                  </option>
                ))}
              </Select>
              <HeaderButton $variant="red" onClick={resetState}>
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
                  addrToCSrc={addrToCSrc}
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
