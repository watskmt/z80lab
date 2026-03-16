import styled from 'styled-components';

interface FlagLampProps {
  label: string;
  bit: number;
  val: number;
  desc: string;
}

const LampContainer = styled.div<{ $isOn: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  padding: 0.125rem 0.0625rem;
  border-radius: 0.25rem;
  border-width: 1px;
  border-style: solid;
  transition: all 0.3s ease-in-out;
  background-color: ${(props) =>
    props.$isOn ? 'rgba(239, 68, 68, 0.2)' : '#18181b'};
  border-color: ${(props) => (props.$isOn ? '#ef4444' : '#47474a')};
  box-shadow: ${(props) =>
    props.$isOn ? '0 0 6px rgba(239, 68, 68, 0.4)' : 'none'};
`;

const Label = styled.span<{ $isOn: boolean }>`
  font-size: 0.875rem;
  font-weight: 900;
  color: ${(props) => (props.$isOn ? '#ef4444' : '#ffffff')};
`;

const Description = styled.span<{ $isOn: boolean }>`
  font-size: 7px;
  font-weight: 700;
  margin-top: 0.125rem;
  text-transform: uppercase;
  text-align: center;
  color: ${(props) => (props.$isOn ? '#f87171' : '#52525b')};
`;

export const FlagLamp = ({ label, bit, val, desc }: FlagLampProps) => {
  const $isOn = (val & (1 << bit)) !== 0;
  return (
    <LampContainer $isOn={$isOn}>
      <Label $isOn={$isOn}>{label}</Label>
      <Description $isOn={$isOn}>{desc}</Description>
    </LampContainer>
  );
};
