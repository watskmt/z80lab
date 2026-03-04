import React, { useState } from 'react';
import styled from 'styled-components';
import { hex2 } from '../constants';

interface IOPanelProps {
  ioOut: number;
  ioIn: number;
  setIoIn: (val: number) => void;
}

const PanelContainer = styled.div`
  background-color: rgba(39, 39, 42, 0.6);
  border-radius: 0.75rem;
  padding: 0.5rem;
  border: 1px solid #47474a;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
`;

const Title = styled.h2`
  color: #c084fc;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.2em;
  border-bottom: 1px solid #47474a;
  padding-bottom: 0.125rem;
  text-transform: uppercase;
  text-align: center;
  font-style: italic;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const SubPanel = styled.div`
  background-color: rgba(0, 0, 0, 0.4);
  padding: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid #47474a;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.125rem;
`;

const SubTitle = styled.span`
  font-size: 10px;
  font-weight: 800;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const HexValue = styled.span`
  font-size: 11px;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  color: #fbbf24;
  background-color: rgba(0, 0, 0, 0.4);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.2);
`;

const BitsRow = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
`;

const NibbleGroup = styled.div`
  display: flex;
  gap: 0.125rem;
  flex: 1;
`;

const BitItem = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.0625rem;
`;

const Lamp = styled.div<{ isOn: boolean }>`
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 9999px;
  border: 1px solid ${(props) => (props.isOn ? '#fef08a' : '#18181b')};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: ${(props) => (props.isOn ? '#facc15' : '#09090b')};
  box-shadow: ${(props) =>
    props.isOn
      ? '0 0 10px rgba(250, 204, 21, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.5)'
      : 'inset 0 2px 4px rgba(0, 0, 0, 0.6)'};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 20%;
    left: 20%;
    width: 30%;
    height: 30%;
    background: white;
    filter: blur(2px);
    border-radius: 9999px;
    opacity: ${(props) => (props.isOn ? 0.6 : 0)};
  }
`;

const SwitchContainer = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
`;

const SwitchBase = styled.div`
  width: 100%;
  background: linear-gradient(145deg, #27272a, #18181b);
  border-radius: 0.375rem;
  padding: 0.25rem 0.125rem;
  border: 2px solid #3f3f46;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  height: 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  position: relative;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #52525b;
    box-shadow:
      0 6px 8px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &:active {
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
`;

const SwitchLabel = styled.span<{ active: boolean }>`
  font-size: 9px;
  font-weight: 900;
  color: ${(props) => (props.active ? '#fbbf24' : '#52525b')};
  transition: all 0.15s;
  text-shadow: ${(props) =>
    props.active ? '0 0 8px rgba(251, 191, 36, 0.8)' : 'none'};
  user-select: none;
  letter-spacing: 0.02em;
  z-index: 1;
`;

const SwitchKnob = styled.div<{ isOn: boolean }>`
  width: 90%;
  height: 1.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.isOn
      ? 'linear-gradient(145deg, #dc2626, #991b1b)'
      : 'linear-gradient(145deg, #52525b, #3f3f46)'};
  border: 1px solid ${(props) => (props.isOn ? '#7f1d1d' : '#27272a')};
  transform: ${(props) =>
    props.isOn ? 'translateY(-0.4rem)' : 'translateY(0.4rem)'};
  box-shadow: ${(props) =>
    props.isOn
      ? '0 -2px 4px rgba(220, 38, 38, 0.3), 0 -4px 8px rgba(220, 38, 38, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
      : '0 2px 4px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.3)'};

  &::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 30%;
    background: ${(props) =>
      props.isOn
        ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent)'
        : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.15), transparent)'};
    border-radius: 2px;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 70%;
    height: 2px;
    background: ${(props) =>
      props.isOn ? 'rgba(127, 29, 29, 0.6)' : 'rgba(0, 0, 0, 0.6)'};
    border-radius: 1px;
    pointer-events: none;
  }
`;

const KnobGradient = styled.div<{ isOn: boolean }>`
  width: 80%;
  height: 4px;
  border-radius: 2px;
  background: ${(props) =>
    props.isOn
      ? 'linear-gradient(90deg, #7f1d1d, #dc2626, #7f1d1d)'
      : 'linear-gradient(90deg, #27272a, #52525b, #27272a)'};
  box-shadow: ${(props) =>
    props.isOn
      ? '0 0 4px rgba(220, 38, 38, 0.6)'
      : 'inset 0 1px 2px rgba(0, 0, 0, 0.5)'};
`;

const KnobIndicator = styled.div<{ isOn: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  transition: all 0.2s;
  background-color: ${(props) => (props.isOn ? '#fef08a' : '#27272a')};
  border: 1px solid ${(props) => (props.isOn ? '#facc15' : '#18181b')};
  box-shadow: ${(props) =>
    props.isOn
      ? '0 0 8px rgba(250, 204, 21, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.5)'
      : 'inset 0 1px 2px rgba(0, 0, 0, 0.5)'};
`;

const BitLabel = styled.span`
  font-size: 8px;
  font-weight: 800;
  color: #e1e1ea;
  margin-top: 2px;
`;

const ModeBadge = styled.button<{ active: boolean }>`
  font-size: 8px;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid ${props => props.active ? '#c084fc' : '#47474a'};
  background: ${props => props.active ? 'rgba(192, 132, 252, 0.2)' : 'transparent'};
  color: ${props => props.active ? '#c084fc' : '#a1a1aa'};
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s;

  &:hover {
    border-color: #c084fc;
    color: #c084fc;
  }
`;

export const IOPanel = ({ ioOut, ioIn, setIoIn }: IOPanelProps) => {
  const [mode, setMode] = useState<'mmio' | 'io'>('mmio');
  const toggleBit = (bit: number) => {
    setIoIn(ioIn ^ (1 << bit));
  };

  const renderLamps = () => {
    const bits = [7, 6, 5, 4, 3, 2, 1, 0];
    return (
      <BitsRow>
        <NibbleGroup>
          {bits.slice(0, 4).map((bit) => {
            const isOn = (ioOut & (1 << bit)) !== 0;
            return (
              <BitItem key={bit}>
                <Lamp isOn={isOn} />
                <BitLabel>B{bit}</BitLabel>
              </BitItem>
            );
          })}
        </NibbleGroup>
        <NibbleGroup>
          {bits.slice(4, 8).map((bit) => {
            const isOn = (ioOut & (1 << bit)) !== 0;
            return (
              <BitItem key={bit}>
                <Lamp isOn={isOn} />
                <BitLabel>B{bit}</BitLabel>
              </BitItem>
            );
          })}
        </NibbleGroup>
      </BitsRow>
    );
  };

  const renderSwitches = () => {
    const bits = [7, 6, 5, 4, 3, 2, 1, 0];
    return (
      <BitsRow>
        <NibbleGroup>
          {bits.slice(0, 4).map((bit) => {
            const isOn = (ioIn & (1 << bit)) !== 0;
            return (
              <SwitchContainer key={bit}>
                <SwitchBase onClick={() => toggleBit(bit)}>
                  <SwitchLabel active={isOn}>1</SwitchLabel>
                  <SwitchKnob isOn={isOn}>
                    <KnobGradient isOn={isOn} />
                    <KnobIndicator isOn={isOn} />
                  </SwitchKnob>
                  <SwitchLabel active={!isOn}>0</SwitchLabel>
                </SwitchBase>
                <BitLabel>B{bit}</BitLabel>
              </SwitchContainer>
            );
          })}
        </NibbleGroup>
        <NibbleGroup>
          {bits.slice(4, 8).map((bit) => {
            const isOn = (ioIn & (1 << bit)) !== 0;
            return (
              <SwitchContainer key={bit}>
                <SwitchBase onClick={() => toggleBit(bit)}>
                  <SwitchLabel active={isOn}>1</SwitchLabel>
                  <SwitchKnob isOn={isOn}>
                    <KnobGradient isOn={isOn} />
                    <KnobIndicator isOn={isOn} />
                  </SwitchKnob>
                  <SwitchLabel active={!isOn}>0</SwitchLabel>
                </SwitchBase>
                <BitLabel>B{bit}</BitLabel>
              </SwitchContainer>
            );
          })}
        </NibbleGroup>
      </BitsRow>
    );
  };

  return (
    <PanelContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
        <ModeBadge active={mode === 'mmio'} onClick={() => setMode('mmio')}>MMIO</ModeBadge>
        <ModeBadge active={mode === 'io'} onClick={() => setMode('io')}>Standard IO</ModeBadge>
      </div>
      <Title>{mode === 'mmio' ? 'Memory Mapped I/O' : 'Standard I/O Port'}</Title>

      <ControlGroup>
        {/* OUTPUT LAMPS */}
        <SubPanel>
          <HeaderRow>
            <SubTitle>{mode === 'mmio' ? 'Lamps (0x8000)' : 'Port 0 (OUT)'}</SubTitle>
            <HexValue>{hex2(ioOut)}</HexValue>
          </HeaderRow>
          {renderLamps()}
        </SubPanel>

        {/* INPUT SWITCHES */}
        <SubPanel>
          <HeaderRow>
            <SubTitle>{mode === 'mmio' ? 'Switches (0x8001)' : 'Port 1 (IN)'}</SubTitle>
            <HexValue>{hex2(ioIn)}</HexValue>
          </HeaderRow>
          {renderSwitches()}
        </SubPanel>
      </ControlGroup>
    </PanelContainer>
  );
};
