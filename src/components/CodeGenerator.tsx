import React, { useState } from 'react';
import styled from 'styled-components';

interface CodeGeneratorProps {
  onLoadCode: (asm: string) => void;
}

const GeneratorWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const TriggerButton = styled.button<{ active: boolean }>`
  padding: 0.25rem 0.5rem;
  height: 1.5rem;
  background-color: ${props => props.active ? 'rgba(16, 185, 129, 0.2)' : '#47474a'};
  color: ${props => props.active ? '#10b981' : '#e4e4e7'};
  font-size: 8px;
  font-weight: 900;
  border-radius: 0.25rem;
  border: 1px solid ${props => props.active ? '#10b981' : '#3f3f46'};
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.15s;

  &:hover {
    background-color: ${props => props.active ? 'rgba(16, 185, 129, 0.3)' : '#3f3f46'};
  }
`;

const Popover = styled.div`
  position: absolute;
  top: 1.75rem;
  right: 0;
  width: 280px;
  background-color: #18181b;
  border-radius: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #47474a;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  z-index: 50;
`;

const Title = styled.h2`
  color: #10b981; /* emerald-500 */
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
`;

const InputArea = styled.textarea`
  background-color: #09090b;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
  border-radius: 0.375rem;
  padding: 0.5rem;
  font-size: 12px;
  min-height: 60px;
  resize: vertical;
  outline: none;
  &:focus {
    border-color: #10b981;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const GenerateButton = styled.button`
  background-color: #059669; /* emerald-600 */
  color: white;
  font-weight: 800;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 11px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  flex: 1;

  &:hover {
    background-color: #10b981;
  }

  &:disabled {
    background-color: #3f3f46;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const ConfigButton = styled.button`
  background-color: transparent;
  color: #a1a1aa;
  border: 1px solid #3f3f46;
  border-radius: 0.375rem;
  padding: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: white;
    border-color: #52525b;
  }
`;

const ApiKeyInput = styled.input`
  background-color: #09090b;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  font-size: 10px;
  width: 100%;
  margin-top: 0.25rem;
`;

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({ onLoadCode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(() => localStorage.getItem('z80lab_openai_prompt') || '');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('z80lab_openai_key') || '');

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('z80lab_openai_key', key);
  };

  const savePrompt = (text: string) => {
    setPrompt(text);
    localStorage.setItem('z80lab_openai_prompt', text);
  };

  const generateCode = async () => {
    if (!prompt.trim()) return;
    if (!apiKey) {
      alert('Please set your OpenAI API Key in the config (gear icon).');
      setShowConfig(true);
      return;
    }

    setLoading(true);
    try {
      const systemPrompt = `You are a Z80 Assembly expert. Generate ONLY Z80 assembly code based on the user's request.
- Start address: 0000H
- IO Ports: Port 0 (OUT) for Lamps, Port 1 (IN) for Switches.
- Memory Mapped IO: 8000H (Lamps), 8001H (Switches).
- Use standard Z80 mnemonics.
- Use 'H' suffix for all hexadecimal numbers (e.g., 0000H, 8000H, 50H).
- IMPORTANT: DO NOT USE LABELS (e.g., LOOP:). Our assembler does not support them.
- IMPORTANT: Use absolute memory addresses for all jumps (JP, CALL, JR, DJNZ).
- IMPORTANT: Our assembler is primitive. Do not use more than one instruction per line. Do not use complex directives.
- Example for a loop (assuming it starts at 0000H):
LD B, 50H
INC A
DJNZ 0002H ; Jump back to INC A at address 0002H (LD B is 2 bytes, INC A is 1 byte)
- Do not include explanations, only the assembly instructions, one per line.
- Ensure all addresses are correctly calculated starting from 0000H.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate code');
      }

      const data = await response.json();
      let generatedAsm = data.choices[0].message.content;
      
      // Clean up markdown if present
      generatedAsm = generatedAsm.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
      
      onLoadCode(generatedAsm);
      setIsOpen(false);
    } catch (err: unknown) {
      console.error(err);
      alert('Error: ' + (err as { message: string }).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GeneratorWrapper>
      <TriggerButton active={isOpen} onClick={() => setIsOpen(!isOpen)} title="AI Sample Generator">
        <svg style={{ width: '10px', height: '10px' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
        AI Generator
      </TriggerButton>

      {isOpen && (
        <Popover>
          <Title>
            <svg style={{ width: '12px', height: '12px' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
            AI Sample Generator
          </Title>
          
          <InputArea 
            placeholder="Enter code description (e.g., 'Loop to blink lamps')"
            value={prompt}
            onChange={(e) => savePrompt(e.target.value)}
            disabled={loading}
            autoFocus
          />
          
          <ButtonRow>
            <GenerateButton onClick={generateCode} disabled={loading || !prompt.trim()}>
              {loading ? 'GENERATING...' : 'GENERATE & LOAD'}
            </GenerateButton>
            <ConfigButton onClick={() => setShowConfig(!showConfig)} title="Settings">
              <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.13,5.91,7.62,6.29L5.23,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.72,8.87 C2.6,9.08,2.65,9.34,2.83,9.48l2.03,1.58C4.81,11.36,4.79,11.67,4.79,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.5c-1.93,0-3.5-1.57-3.5-3.5 s1.57-3.5,3.5-3.5s3.5,1.57,3.5,3.5S13.93,15.5,12,15.5z" />
              </svg>
            </ConfigButton>
          </ButtonRow>
          
          {showConfig && (
            <div>
              <label style={{ fontSize: '9px', color: '#a1a1aa' }}>OpenAI API Key (stored locally):</label>
              <ApiKeyInput 
                type="password" 
                placeholder="sk-..." 
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
              />
            </div>
          )}
        </Popover>
      )}
    </GeneratorWrapper>
  );
};
