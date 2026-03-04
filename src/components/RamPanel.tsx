import React from 'react';
import styled from 'styled-components';
import { hex4, hex2 } from '../constants';

interface RamPanelProps {
  dataMemory: Uint8Array;
  writes: number[];
  DATA_BASE: number;
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

const Row = styled.tr<{ touched: boolean }>`
  background-color: ${(props) => (props.touched ? 'rgba(127, 29, 29, 0.4)' : 'transparent')};
`;

const AddrCell = styled.td<{ touched: boolean }>`
  padding: 4px 4px;
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => (props.touched ? '#fca5a5' : '#92929b')};
`;

const ValCell = styled.td<{ touched: boolean }>`
  padding: 4px 4px;
  text-align: right;
  font-size: 14px;
  font-weight: 900;
  color: ${(props) => (props.touched ? '#ffffff' : '#d4d4d8')};
`;

export const RamPanel: React.FC<RamPanelProps> = ({
  dataMemory,
  writes,
  DATA_BASE,
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
              return (
                <Row key={i} touched={isTouched}>
                  <AddrCell touched={isTouched}>{hex4(addr)}</AddrCell>
                  <ValCell touched={isTouched}>{hex2(dataMemory[addr])}</ValCell>
                </Row>
              );
            })}
          </tbody>
        </Table>
      </ListArea>
    </PanelContainer>
  );
};
