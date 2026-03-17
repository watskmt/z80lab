import React from 'react';
import styled from 'styled-components';
import { hex4, hex2 } from '../constants';

interface RamPanelProps {
  dataMemory: Uint8Array;
  prevDataMemory: Uint8Array;
  writes: number[];
  DATA_BASE: number;
  highlightAddr?: number;
  editingAddr: number | null;
  editVal: string;
  setEditingAddr: (addr: number | null) => void;
  setEditVal: (val: string) => void;
  handleUpdate: (addr: number, val: string) => void;
}

const PanelContainer = styled.div`
  background-color: rgba(39, 39, 42, 0.6);
  border-radius: 0.75rem;
  padding: 0.25rem;
  border: 1px solid #47474a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
`;

const Title = styled.h2`
  color: #ef4444;
  font-weight: 900;
  font-size: 0.875rem;
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
  padding-bottom: 0.125rem;
  margin-bottom: 0.25rem;
  text-align: center;
  font-style: italic;
`;

const ListArea = styled.div`
  overflow-y: auto;
  flex-grow: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 0.5rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
`;

const Row = styled.tr<{ $touched: boolean; $isHighlight: boolean }>`
  background-color: ${(props) =>
    props.$isHighlight ? 'rgba(30, 58, 138, 0.8)' :
    props.$touched ? 'rgba(127, 29, 29, 0.4)' : 'transparent'};
  box-shadow: ${(props) =>
    props.$isHighlight ? 'inset 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.4)' : 'none'};
  transition: all 0.15s ease-in-out;
`;

const AddrCell = styled.td<{ $touched: boolean }>`
  padding: 2px 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${(props) => (props.$touched ? '#fca5a5' : '#92929b')};
  white-space: nowrap;
  width: 1px;
`;

const ValCell = styled.td<{ $touched: boolean }>`
  padding: 2px 6px;
  text-align: right;
  font-size: 0.75rem;
  font-weight: 900;
  color: ${(props) => (props.$touched ? '#ffffff' : '#d4d4d8')};
`;

const TransitionText = styled.span`
  display: inline-block;
  white-space: nowrap;
`;

const OldValue = styled.span`
  color: #f87171;
  text-decoration: line-through;
`;

const Arrow = styled.span`
  color: #60a5fa;
  margin: 0 2px;
`;

const NewValue = styled.span`
  color: #4ade80;
  font-weight: 900;
`;

const ValueInput = styled.input`
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
  text-align: right;
`;

const ValueText = styled.span`
  cursor: pointer;

  &:hover {
    color: #ffffff;
  }
`;

export const RamPanel: React.FC<RamPanelProps> = ({
  dataMemory,
  prevDataMemory,
  writes,
  DATA_BASE,
  highlightAddr,
  editingAddr,
  editVal,
  setEditingAddr,
  setEditVal,
  handleUpdate,
}) => {
  return (
    <PanelContainer>
      <Title>RAM</Title>
      <ListArea className="custom-scrollbar">
        <Table>
          <tbody>
            {Array.from({ length: 128 }).map((_, i) => {
              const addr = DATA_BASE + i;
              const isTouched = writes.includes(addr);
              const isHighlight = highlightAddr === addr;
              const currentVal = dataMemory[addr];
              const prevVal = prevDataMemory[addr];
              const isChanged = currentVal !== prevVal;

              return (
                <Row key={i} $touched={isTouched} $isHighlight={isHighlight}>
                  <AddrCell $touched={isTouched}>{hex4(addr)}</AddrCell>
                  <ValCell $touched={isTouched}>
                    {editingAddr === addr ? (
                      <ValueInput
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => handleUpdate(addr, editVal)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(addr, editVal)}
                      />
                    ) : isChanged ? (
                      <ValueText onClick={() => {
                        setEditingAddr(addr);
                        setEditVal(hex2(currentVal));
                      }}>
                        <TransitionText>
                          <OldValue>{hex2(prevVal)}</OldValue>
                          <Arrow>→</Arrow>
                          <NewValue>{hex2(currentVal)}</NewValue>
                        </TransitionText>
                      </ValueText>
                    ) : (
                      <ValueText onClick={() => {
                        setEditingAddr(addr);
                        setEditVal(hex2(currentVal));
                      }}>
                        {hex2(currentVal)}
                      </ValueText>
                    )}
                  </ValCell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </ListArea>
    </PanelContainer>
  );
};
