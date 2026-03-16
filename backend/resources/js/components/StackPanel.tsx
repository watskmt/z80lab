import React from 'react';
import styled from 'styled-components';
import { hex4, hex2 } from '../constants';

interface StackPanelProps {
  stackBaseAddr: number;
  sp: number;
  dataMemory: Uint8Array;
  prevDataMemory: Uint8Array;
  writes: number[];
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

  @media (min-width: 768px) {
    grid-column: span 2 / span 2;
  }
`;

const Title = styled.h2`
  color: #3b82f6;
  font-weight: 900;
  font-size: 0.875rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
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

const Row = styled.tr<{ $isSP: boolean; $touched: boolean }>`
  background-color: ${(props) =>
    props.$isSP ? 'rgba(37, 99, 235, 0.4)' : 'transparent'};
  border-left: ${(props) => (props.$touched ? '2px solid #ef4444' : 'none')};
`;

const AddrCell = styled.td<{ $isSP: boolean; $touched: boolean }>`
  padding: 0.125rem 0.375rem;
  font-size: 14px;
  font-weight: 700;
  color: ${(props) =>
    props.$isSP ? '#93c5fd' : props.$touched ? '#fca5a5' : '#92929b'};
`;

const ValCell = styled.td<{ $isSP: boolean; $touched: boolean }>`
  padding: 0.125rem 0.375rem;
  text-align: right;
  font-size: 14px;
  font-weight: 900;
  color: ${(props) => (props.$isSP || props.$touched ? '#ffffff' : '#d4d4d8')};
`;

const MarkerCell = styled.td`
  padding: 0 0.125rem;
  font-size: 8px;
  color: #60a5fa;
  font-weight: 900;
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
  font-size: 14px;
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

export const StackPanel: React.FC<StackPanelProps> = ({
  stackBaseAddr,
  sp,
  dataMemory,
  prevDataMemory,
  writes,
  editingAddr,
  editVal,
  setEditingAddr,
  setEditVal,
  handleUpdate,
}) => {
  return (
    <PanelContainer>
      <Title>STACK</Title>
      <ListArea className="custom-scrollbar">
        <Table>
          <tbody>
            {Array.from({ length: 64 }).map((_, i) => {
              const addr = (stackBaseAddr - 4 + i) & 0xffff;
              const isSP = addr === sp;
              const isTouched = writes.includes(addr);
              const currentVal = dataMemory[addr];
              const prevVal = prevDataMemory[addr];
              const isChanged = currentVal !== prevVal;

              return (
                <Row key={i} $isSP={isSP} $touched={isTouched}>
                  <AddrCell $isSP={isSP} $touched={isTouched}>{hex4(addr)}</AddrCell>
                  <ValCell $isSP={isSP} $touched={isTouched}>
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
                  <MarkerCell>{isSP ? '←' : ''}</MarkerCell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </ListArea>
    </PanelContainer>
  );
};
