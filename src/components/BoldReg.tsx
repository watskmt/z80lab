import styled from 'styled-components';
import { hex2, hex4 } from '../constants';

interface BoldRegProps {
  label: string;
  val: number;
  prevVal: number;
  size?: number;
  highlight?: boolean;
}

const RegContainer = styled.div<{ isChanged: boolean; isHighlight: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.125rem;
  border-radius: 0.25rem;
  border-width: ${(props) => (props.isHighlight ? '2px' : '1px')};
  border-style: solid;
  transition: all 0.15s ease-in-out;
  min-height: 2.5rem;
  background-color: ${(props) =>
    props.isHighlight ? '#1e3a8a' :
    props.isChanged ? '#064e3b' : '#47474a'};
  border-color: ${(props) =>
    props.isHighlight ? '#3b82f6' :
    props.isChanged ? '#34d399' : '#3f3f46'};
  color: ${(props) => (props.isChanged ? 'inherit' : '#a1a1aa')};
  box-shadow: ${(props) =>
    props.isHighlight ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4)' : 'none'};
`;

const Label = styled.span<{ isChanged: boolean }>`
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.025em;
  font-size: 16px;
  margin-bottom: 0.125rem;
  color: ${(props) => (props.isChanged ? '#6ee7b7' : '#ffffff')};
`;

const Value = styled.span<{ isChanged: boolean }>`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-weight: 700;
  font-size: 0.625rem;
  line-height: 1;
  color: ${(props) => (props.isChanged ? '#ffffff' : '#f4f4f5')};

  @media (min-width: 1024px) {
    font-size: 0.75rem;
  }
`;

export const BoldReg = ({ label, val, prevVal, size = 2, highlight = false }: BoldRegProps) => {
  const isChanged = val !== prevVal;
  return (
    <RegContainer isChanged={isChanged} isHighlight={highlight}>
      <Label isChanged={isChanged}>{label}</Label>
      <Value isChanged={isChanged}>
        {size === 2 ? hex2(val) : hex4(val)}
      </Value>
    </RegContainer>
  );
};
