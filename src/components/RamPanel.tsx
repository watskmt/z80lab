import React from 'react';
import styled from 'styled-components';
import { hex4, hex2 } from '../constants';

interface RamPanelProps {
  dataMemory: Uint8Array;
  prevDataMemory: Uint8Array;
  writes: number[];
  DATA_BASE: number;
  highlightAddr?: number;
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

const Row = styled.tr<{ touched: boolean; isHighlight: boolean }>`
  background-color: ${(props) =>
    props.isHighlight ? 'rgba(30, 58, 138, 0.8)' :
    props.touched ? 'rgba(127, 29, 29, 0.4)' : 'transparent'};
  box-shadow: ${(props) =>
    props.isHighlight ? 'inset 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.4)' : 'none'};
  transition: all 0.15s ease-in-out;
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

export const RamPanel: React.FC<RamPanelProps> = ({
  dataMemory,
  prevDataMemory,
  writes,
  DATA_BASE,
  highlightAddr,
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
                <Row key={i} touched={isTouched} isHighlight={isHighlight}>
                  <AddrCell touched={isTouched}>{hex4(addr)}</AddrCell>
                  <ValCell touched={isTouched}>
                    {isChanged ? (
                      <TransitionText>
                        <OldValue>{hex2(prevVal)}</OldValue>
                        <Arrow>→</Arrow>
                        <NewValue>{hex2(currentVal)}</NewValue>
                      </TransitionText>
                    ) : (
                      hex2(currentVal)
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
