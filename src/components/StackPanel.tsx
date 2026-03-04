import React from 'react';
import styled from 'styled-components';
import { hex4, hex2 } from '../constants';

interface StackPanelProps {
  stackBaseAddr: number;
  sp: number;
  dataMemory: Uint8Array;
  writes: number[];
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

const Row = styled.tr<{ isSP: boolean; touched: boolean }>`
  background-color: ${(props) =>
    props.isSP ? 'rgba(37, 99, 235, 0.4)' : 'transparent'};
  border-left: ${(props) => (props.touched ? '2px solid #ef4444' : 'none')};
`;

const AddrCell = styled.td<{ isSP: boolean; touched: boolean }>`
  padding: 0.125rem 0.375rem;
  font-size: 14px;
  font-weight: 700;
  color: ${(props) =>
    props.isSP ? '#93c5fd' : props.touched ? '#fca5a5' : '#92929b'};
`;

const ValCell = styled.td<{ isSP: boolean; touched: boolean }>`
  padding: 0.125rem 0.375rem;
  text-align: right;
  font-size: 14px;
  font-weight: 900;
  color: ${(props) => (props.isSP || props.touched ? '#ffffff' : '#d4d4d8')};
`;

const MarkerCell = styled.td`
  padding: 0 0.125rem;
  font-size: 8px;
  color: #60a5fa;
  font-weight: 900;
`;

export const StackPanel: React.FC<StackPanelProps> = ({
  stackBaseAddr,
  sp,
  dataMemory,
  writes,
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
              return (
                <Row key={i} isSP={isSP} touched={isTouched}>
                  <AddrCell isSP={isSP} touched={isTouched}>{hex4(addr)}</AddrCell>
                  <ValCell isSP={isSP} touched={isTouched}>{hex2(dataMemory[addr])}</ValCell>
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
