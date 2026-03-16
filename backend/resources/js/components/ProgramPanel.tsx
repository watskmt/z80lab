import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { hex4 } from '../constants';
import { disasm } from '../utils/assembler';

// Z80ニーモニックリスト
const Z80_MNEMONICS = [
  'LD', 'PUSH', 'POP', 'ADD', 'ADC', 'SUB', 'SBC', 'AND', 'OR', 'XOR', 'CP',
  'INC', 'DEC', 'JP', 'JR', 'CALL', 'RET', 'RST', 'NOP', 'HALT', 'DI', 'EI',
  'RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SRL', 'BIT', 'SET', 'RES',
  'EX', 'EXX', 'DJNZ', 'LDIR', 'LDDR', 'CPIR', 'CPDR', 'NEG', 'DAA', 'CPL',
  'CCF', 'SCF', 'IN', 'OUT', 'RLD', 'RRD', 'IM', 'DB'
];

// レジスタ候補
const REGISTERS_8BIT = ['A', 'B', 'C', 'D', 'E', 'H', 'L'];
const REGISTERS_16BIT = ['BC', 'DE', 'HL', 'SP', 'AF', 'IX', 'IY'];

// オペランド候補マップ
const OPERAND_SUGGESTIONS: Record<string, string[]> = {
  'LD': [
    'A,', 'B,', 'C,', 'D,', 'E,', 'H,', 'L,',
    '(HL),', '(BC),', '(DE),', '(nnnn),',
    'BC,', 'DE,', 'HL,', 'SP,', 'IX,', 'IY,',
    'A,nn', 'B,nn', 'C,nn', 'D,nn', 'E,nn', 'H,nn', 'L,nn',
    'BC,nnnn', 'DE,nnnn', 'HL,nnnn', 'SP,nnnn'
  ],
  'PUSH': ['BC', 'DE', 'HL', 'AF', 'IX', 'IY'],
  'POP': ['BC', 'DE', 'HL', 'AF', 'IX', 'IY'],
  'ADD': ['A,', 'HL,', 'IX,', 'IY,', 'A,nn', 'HL,BC', 'HL,DE', 'HL,HL', 'HL,SP'],
  'ADC': ['A,', 'HL,', 'A,nn', 'HL,BC', 'HL,DE', 'HL,HL', 'HL,SP'],
  'SUB': ['A,', 'nn', ...REGISTERS_8BIT, '(HL)'],
  'SBC': ['A,', 'HL,', 'A,nn', 'HL,BC', 'HL,DE', 'HL,HL', 'HL,SP'],
  'AND': ['A,', 'nn', ...REGISTERS_8BIT, '(HL)'],
  'OR': ['A,', 'nn', ...REGISTERS_8BIT, '(HL)'],
  'XOR': ['A,', 'nn', ...REGISTERS_8BIT, '(HL)'],
  'CP': ['A,', 'nn', ...REGISTERS_8BIT, '(HL)'],
  'INC': [...REGISTERS_8BIT, ...REGISTERS_16BIT, '(HL)', '(IX+dd)', '(IY+dd)'],
  'DEC': [...REGISTERS_8BIT, ...REGISTERS_16BIT, '(HL)', '(IX+dd)', '(IY+dd)'],
  'JP': ['nnnn', '(HL)', '(IX)', '(IY)', 'NZ,', 'Z,', 'NC,', 'C,', 'PO,', 'PE,', 'P,', 'M,'],
  'JR': ['nn', 'NZ,', 'Z,', 'NC,', 'C,'],
  'CALL': ['nnnn', 'NZ,', 'Z,', 'NC,', 'C,', 'PO,', 'PE,', 'P,', 'M,'],
  'RET': ['', 'NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'],
  'RST': ['00H', '08H', '10H', '18H', '20H', '28H', '30H', '38H'],
  'BIT': ['0,', '1,', '2,', '3,', '4,', '5,', '6,', '7,'],
  'SET': ['0,', '1,', '2,', '3,', '4,', '5,', '6,', '7,'],
  'RES': ['0,', '1,', '2,', '3,', '4,', '5,', '6,', '7,'],
  'IN': ['A,(nn)', 'A,(C)', 'B,(C)', 'C,(C)', 'D,(C)', 'E,(C)', 'H,(C)', 'L,(C)'],
  'OUT': ['(nn),A', '(C),A', '(C),B', '(C),C', '(C),D', '(C),E', '(C),H', '(C),L'],
  'IM': ['0', '1', '2'],
  'EX': ['DE,HL', 'AF,AF\'', '(SP),HL', '(SP),IX', '(SP),IY'],
  'RLC': [...REGISTERS_8BIT, '(HL)'],
  'RRC': [...REGISTERS_8BIT, '(HL)'],
  'RL': [...REGISTERS_8BIT, '(HL)'],
  'RR': [...REGISTERS_8BIT, '(HL)'],
  'SLA': [...REGISTERS_8BIT, '(HL)'],
  'SRA': [...REGISTERS_8BIT, '(HL)'],
  'SRL': [...REGISTERS_8BIT, '(HL)'],
};

interface ProgramPanelProps {
  codeMemory: Uint8Array;
  pc: number;
  editingAddr: number | null;
  editVal: string;
  setEditingAddr: (addr: number | null) => void;
  setEditVal: (val: string) => void;
  handleUpdateCode: (addr: number, text: string) => void;
  CODE_BASE: number;
  addrToCSrc?: Record<number, string>;
}

const PanelContainer = styled.div`
  height: 100%;
  background-color: rgba(39, 39, 42, 0.6);
  border-radius: 0.75rem;
  padding: 0.25rem;
  border: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);

  @media (min-width: 768px) {
    grid-column: span 2 / span 2;
  }
`;

const Title = styled.h2`
  color: #eab308;
  font-weight: 900;
  font-size: 0.875rem;
  border-bottom: 1px solid rgba(234, 179, 8, 0.3);
  padding-bottom: 0.125rem;
  margin-bottom: 0.25rem;
  text-align: center;
  font-style: italic;
`;

const CodeArea = styled.div`
  overflow-y: auto;
  flex-grow: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 0.5rem;
  padding: 0.25rem;
`;

const CodeLine = styled.div<{ $isCurrent: boolean }>`
  display: flex;
  gap: 0.375rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  margin-bottom: 0.125rem;
  border: 1px solid ${(props) => (props.$isCurrent ? '#eab308' : 'transparent')};
  background-color: ${(props) => (props.$isCurrent ? '#eab308' : 'transparent')};
  color: ${(props) => (props.$isCurrent ? '#000000' : '#a1a1aa')};
  font-weight: ${(props) => (props.$isCurrent ? '900' : 'normal')};
`;

const Address = styled.span<{ $isCurrent: boolean }>`
  font-size: 0.75rem;
  flex-shrink: 0;
  font-weight: 700;
  color: ${(props) => (props.$isCurrent ? '#000000' : 'rgba(202, 138, 4, 0.8)')};
`;

const InstructionInput = styled.input`
  background-color: #ffffff;
  color: #000000;
  width: 100%;
  padding: 0 0.125rem;
  border-radius: 0.125rem;
  text-transform: uppercase;
  font-weight: 700;
  font-size: 0.75rem;
  border: none;
  outline: none;
`;

const InstructionText = styled.span`
  font-size: 0.75rem;
  letter-spacing: -0.05em;
  cursor: pointer;

  &:hover {
    color: #ffffff;
  }
`;

const SuggestionContainer = styled.div`
  position: relative;
  width: 100%;
`;

const SuggestionList = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #18181b;
  border: 1px solid #3b82f6;
  border-radius: 0.25rem;
  margin: 0.125rem 0 0 0;
  padding: 0;
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
`;

const SuggestionItem = styled.li<{ $isSelected: boolean }>`
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  background-color: ${(props) => (props.$isSelected ? '#3b82f6' : 'transparent')};
  color: ${(props) => (props.$isSelected ? '#ffffff' : '#d4d4d8')};

  &:hover {
    background-color: #3b82f6;
    color: #ffffff;
  }
`;

const CSourceComment = styled.div`
  font-size: 0.65rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  color: #6ee7b7;
  opacity: 0.75;
  padding: 0.125rem 0.25rem 0 0.25rem;
  margin-top: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ProgramPanel: React.FC<ProgramPanelProps> = ({
  codeMemory,
  pc,
  editingAddr,
  editVal,
  setEditingAddr,
  setEditVal,
  handleUpdateCode,
  CODE_BASE,
  addrToCSrc,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = currentLineRef.current;
    const container = codeAreaRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const margin = 48;
    if (elRect.top < containerRect.top + margin) {
      container.scrollTop -= containerRect.top + margin - elRect.top;
    } else if (elRect.bottom > containerRect.bottom - margin) {
      container.scrollTop += elRect.bottom - containerRect.bottom + margin;
    }
  }, [pc]);

  // サジェスチョンを計算する関数
  const getSuggestions = (value: string): string[] => {
    if (!value) return [];

    const input = value.toUpperCase().trim();
    const parts = input.split(/\s+/);
    const mnemonic = parts[0];
    const operandPart = parts.slice(1).join(' ');

    // ニーモニックの候補
    if (parts.length === 1 && mnemonic) {
      return Z80_MNEMONICS.filter((m) => m.startsWith(mnemonic));
    }
    // オペランドの候補
    else if (parts.length >= 2 && OPERAND_SUGGESTIONS[mnemonic]) {
      const operands = OPERAND_SUGGESTIONS[mnemonic];
      const filtered = operands.filter((op) =>
        op.toUpperCase().startsWith(operandPart.toUpperCase())
      );
      return filtered.map(op => `${mnemonic} ${op}`);
    }

    return [];
  };

  const suggestions = getSuggestions(editVal);

  const handleKeyDown = (e: React.KeyboardEvent, addr: number) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (suggestions.length > 0) {
          e.preventDefault();
          const selected = suggestions[selectedIndex];
          setEditVal(selected);
          setSelectedIndex(0);
          if (e.key === 'Enter') {
            handleUpdateCode(addr, selected);
          }
        }
      } else if (e.key === 'Escape') {
        setSelectedIndex(0);
      }
    } else if (e.key === 'Enter') {
      handleUpdateCode(addr, editVal);
    }
  };

  const handleSuggestionClick = (suggestion: string, addr: number) => {
    setEditVal(suggestion);
    setSelectedIndex(0);
    handleUpdateCode(addr, suggestion);
  };

  return (
    <PanelContainer>
      <Title>PROGRAM</Title>
      <CodeArea className="custom-scrollbar" ref={codeAreaRef}>
        {disasm(codeMemory, CODE_BASE).map((l, i) => (
          <React.Fragment key={i}>
          {addrToCSrc?.[l.addr] && (
            <CSourceComment>{'// ' + addrToCSrc[l.addr]}</CSourceComment>
          )}
          <CodeLine $isCurrent={l.addr === pc} ref={l.addr === pc ? currentLineRef : undefined}>
            <Address $isCurrent={l.addr === pc}>{hex4(l.addr)}</Address>
            {editingAddr === l.addr ? (
              <SuggestionContainer>
                <InstructionInput
                  ref={inputRef}
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => {
                    setTimeout(() => {
                      handleUpdateCode(l.addr, editVal);
                      setSelectedIndex(0);
                    }, 200);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, l.addr)}
                />
                {suggestions.length > 0 && (
                  <SuggestionList>
                    {suggestions.map((suggestion, idx) => (
                      <SuggestionItem
                        key={suggestion}
                        $isSelected={idx === selectedIndex}
                        onMouseDown={() => handleSuggestionClick(suggestion, l.addr)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        {suggestion}
                      </SuggestionItem>
                    ))}
                  </SuggestionList>
                )}
              </SuggestionContainer>
            ) : (
              <InstructionText
                onClick={() => {
                  setEditingAddr(l.addr);
                  setEditVal(l.text);
                }}
              >
                {l.text}
              </InstructionText>
            )}
          </CodeLine>
          </React.Fragment>
        ))}
      </CodeArea>
    </PanelContainer>
  );
};
