import React from 'react';
import styled from 'styled-components';
import type { Registers } from '../types';
import { BoldReg } from './BoldReg';
import { FlagLamp } from './FlagLamp';
import { IOPanel } from './IOPanel';

interface ArchitecturePanelProps {
  regs: Registers;
  prevRegs: Registers;
  ioOut: number;
  ioIn: number;
  setIoIn: (val: number) => void;
  highlightSource?: boolean;
}

const PanelContainer = styled.div`
  background-color: rgba(39, 39, 42, 0.6);
  border-radius: 0.75rem;
  padding: 0.375rem;
  border: 1px solid #47474a;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  height: 100%;

    grid-column: span 3 / span 3;
`;

const Title = styled.h2`
  color: #60a5fa;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.2em;
  border-bottom: 1px solid #47474a;
  padding-bottom: 0.125rem;
  text-transform: uppercase;
  text-align: center;
  font-style: italic;
`;

const RegGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
`;

const DoubleRegGrid = styled.div`
  grid-column: span 2 / span 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
`;

const FlagsContainer = styled.div`
  background-color: rgba(0, 0, 0, 0.6);
  padding: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid #47474a;
`;

const FlagsRow = styled.div`
  display: flex;
  gap: 0.125rem;
`;

const Separator = styled.div`
  width: 1px;
  background-color: #47474a;
  margin: 0 0.0625rem;
`;

export const RegisterPanel: React.FC<ArchitecturePanelProps> = ({
  regs,
  prevRegs,
  ioOut,
  ioIn,
  setIoIn,
  highlightSource,
}) => {
  return (
    <PanelContainer className="custom-scrollbar">
      <Title>Core Architecture</Title>
      <RegGrid>
        <BoldReg label="A" val={regs.A} prevVal={prevRegs.A} highlight={highlightSource} />
        <BoldReg label="F" val={regs.F} prevVal={prevRegs.F} />
        <BoldReg label="B" val={regs.B} prevVal={prevRegs.B} />
        <BoldReg label="C" val={regs.C} prevVal={prevRegs.C} />
        <BoldReg label="D" val={regs.D} prevVal={prevRegs.D} />
        <BoldReg label="E" val={regs.E} prevVal={prevRegs.E} />
        <BoldReg label="H" val={regs.H} prevVal={prevRegs.H} />
        <BoldReg label="L" val={regs.L} prevVal={prevRegs.L} />
        <BoldReg label="IX" val={regs.IX} prevVal={prevRegs.IX} size={4} />
        <BoldReg label="IY" val={regs.IY} prevVal={prevRegs.IY} size={4} />
        <DoubleRegGrid>
          <BoldReg label="SP" val={regs.SP} prevVal={prevRegs.SP} size={4} />
          <BoldReg label="PC" val={regs.PC} prevVal={prevRegs.PC} size={4} />
        </DoubleRegGrid>
      </RegGrid>
      <FlagsContainer>
        <FlagsRow>
          <FlagLamp label="S" bit={7} val={regs.F} desc="Sign" />
          <FlagLamp label="Z" bit={6} val={regs.F} desc="Zero" />
          <Separator />
          <FlagLamp label="H" bit={4} val={regs.F} desc="H-C" />
          <FlagLamp label="P" bit={2} val={regs.F} desc="P/V" />
          <FlagLamp label="N" bit={1} val={regs.F} desc="N/S" />
          <FlagLamp label="C" bit={0} val={regs.F} desc="Carry" />
        </FlagsRow>
      </FlagsContainer>
      <IOPanel ioOut={ioOut} ioIn={ioIn} setIoIn={setIoIn} />
    </PanelContainer>
  );
};
