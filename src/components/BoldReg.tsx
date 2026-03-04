import styled from 'styled-components';
import { hex2, hex4 } from '../constants';

interface BoldRegProps {
  label: string;
  val: number;
  prevVal: number;
  size?: number;
}

const RegContainer = styled.div<{ isChanged: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.0625rem;
  border-radius: 0.25rem;
  border-width: 1px;
  border-style: solid;
  transition: all 0.15s ease-in-out;
  height: 100%;
  background-color: ${(props) => (props.isChanged ? '#064e3b' : '#47474a')};
  border-color: ${(props) => (props.isChanged ? '#34d399' : '#3f3f46')};
  color: ${(props) => (props.isChanged ? 'inherit' : '#a1a1aa')};
`;

const Label = styled.span<{ isChanged: boolean }>`
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.025em;
  font-size: 10px;
  margin-bottom: 0;
  color: ${(props) => (props.isChanged ? '#6ee7b7' : '#ffffff')};
`;

const Value = styled.span<{ isChanged: boolean }>`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-weight: 700;
  font-size: 0.75rem;
  line-height: 1;
  color: ${(props) => (props.isChanged ? '#ffffff' : '#f4f4f5')};

  @media (min-width: 1024px) {
    font-size: 0.875rem;
  }
`;

export const BoldReg = ({ label, val, prevVal, size = 2 }: BoldRegProps) => {
  const isChanged = val !== prevVal;
  return (
    <RegContainer isChanged={isChanged}>
      <Label isChanged={isChanged}>{label}</Label>
      <Value isChanged={isChanged}>
        {size === 2 ? hex2(val) : hex4(val)}
      </Value>
    </RegContainer>
  );
};
