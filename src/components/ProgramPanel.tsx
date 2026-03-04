import React from 'react';
import styled from 'styled-components';
import { hex4 } from '../constants';
import { disasm } from '../utils/assembler';

interface ProgramPanelProps {
  codeMemory: Uint8Array;
  pc: number;
  editingAddr: number | null;
  editVal: string;
  setEditingAddr: (addr: number | null) => void;
  setEditVal: (val: string) => void;
  handleUpdateCode: (addr: number, text: string) => void;
  CODE_BASE: number;
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

const CodeLine = styled.div<{ isCurrent: boolean }>`
  display: flex;
  gap: 0.375rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  margin-bottom: 0.125rem;
  border: 1px solid ${(props) => (props.isCurrent ? '#eab308' : 'transparent')};
  background-color: ${(props) => (props.isCurrent ? '#eab308' : 'transparent')};
  color: ${(props) => (props.isCurrent ? '#000000' : '#a1a1aa')};
  font-weight: ${(props) => (props.isCurrent ? '900' : 'normal')};
`;

const Address = styled.span<{ isCurrent: boolean }>`
  font-size: 0.75rem;
  flex-shrink: 0;
  font-weight: 700;
  color: ${(props) => (props.isCurrent ? '#000000' : 'rgba(202, 138, 4, 0.8)')};
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

export const ProgramPanel: React.FC<ProgramPanelProps> = ({
  codeMemory,
  pc,
  editingAddr,
  editVal,
  setEditingAddr,
  setEditVal,
  handleUpdateCode,
  CODE_BASE,
}) => {
  return (
    <PanelContainer>
      <Title>PROGRAM</Title>
      <CodeArea className="custom-scrollbar">
        {disasm(codeMemory, CODE_BASE).map((l, i) => (
          <CodeLine key={i} isCurrent={l.addr === pc}>
            <Address isCurrent={l.addr === pc}>{hex4(l.addr)}</Address>
            {editingAddr === l.addr ? (
              <InstructionInput
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={() => handleUpdateCode(l.addr, editVal)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleUpdateCode(l.addr, editVal)
                }
              />
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
        ))}
      </CodeArea>
    </PanelContainer>
  );
};
