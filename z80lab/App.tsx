import React, { useState, useEffect, useRef } from 'react';

const injectTailwind = () => {
    if (!document.getElementById('tailwind-cdn')) {
        const script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
    }
};

const MEM_SIZE = 0x10000;
const CODE_BASE = 0x0000;
const DATA_BASE = 0x4000;

const hex2 = (v: number) => (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
const hex4 = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');

const REGS_MAP: Record<string, number> = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, A: 7 };
const REGS_LIST = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];

// ===== アセンブラ =====
const assembleInstruction = (text: string, currentAddr: number): number[] => {
    const s = text.toUpperCase().trim();
    if (!s || s === '-' || s.startsWith('DB')) return [];

    if (s.startsWith('JP ')) {
        const isNZ = s.includes('NZ,');
        const targetPart = isNZ ? s.split('NZ,')[1] : s.split('JP ')[1];
        const addr = parseInt(targetPart.trim(), 16) || 0;
        return [isNZ ? 0xC2 : 0xC3, addr & 0xff, (addr >> 8) & 0xff];
    }

    if (s.startsWith('JR ') || s.startsWith('DJNZ ')) {
        const isDJNZ = s.startsWith('DJNZ');
        const targetPart = isDJNZ ? s.split('DJNZ ')[1] : s.split('JR ')[1];
        const targetAddr = parseInt(targetPart.trim(), 16) || 0;
        const offset = (targetAddr - (currentAddr + 2)) & 0xff;
        return [isDJNZ ? 0x10 : 0x18, offset];
    }

    const compact = s.replace(/\s+/g, '');
    const ldRegMatch = compact.match(/^LD([A-EHL]),([A-EHL])$/);
    if (ldRegMatch) return [0x40 | (REGS_MAP[ldRegMatch[1]] << 3) | REGS_MAP[ldRegMatch[2]]];
    if (compact.startsWith('LDA,')) return [0x3e, parseInt(compact.split(',')[1], 16) || 0];
    if (compact.startsWith('LDB,')) return [0x06, parseInt(compact.split(',')[1], 16) || 0];
    if (compact === 'DECA') return [0x3d];
    if (compact.startsWith('LDH,')) return [0x26, parseInt(compact.split(',')[1], 16) || 0];
    if (compact.startsWith('LDL,')) return [0x2e, parseInt(compact.split(',')[1], 16) || 0];
    if (compact === 'LD(HL),A') return [0x77];
    if (compact.startsWith('LD(') && compact.endsWith('),A')) {
        const addr = parseInt(compact.match(/\(([^)]+)\)/)?.[1] || '0', 16);
        return [0x32, addr & 0xff, (addr >> 8) & 0xff];
    }
    if (compact === 'NOP') return [0x00];
    return [];
};

// ===== Disassembler (テキスト書き出し用) =====
function disasm(code: Uint8Array, start: number, count = 128) {
    const out = [];
    let pc = start;
    for (let i = 0; i < count && pc < MEM_SIZE; i++) {
        const currentPc = pc;
        const op = code[pc];
        let text = '';
        if (op >= 0x40 && op <= 0x7f && op !== 0x76) {
            text = `LD ${REGS_LIST[(op >> 3) & 7]},${REGS_LIST[op & 7]}`;
            pc += 1;
        } else {
            switch (op) {
                case 0x3e: text = `LD A,${hex2(code[pc + 1])}`; pc += 2; break;
                case 0x06: text = `LD B,${hex2(code[pc + 1])}`; pc += 2; break;
                case 0x3d: text = `DEC A`; pc += 1; break;
                case 0x26: text = `LD H,${hex2(code[pc + 1])}`; pc += 2; break;
                case 0x2e: text = `LD L,${hex2(code[pc + 1])}`; pc += 2; break;
                case 0x77: text = `LD (HL),A`; pc += 1; break;
                case 0x32: text = `LD (${hex4((code[pc + 2] << 8) | code[pc + 1])}),A`; pc += 3; break;
                case 0xc2: text = `JP NZ,${hex4((code[pc + 2] << 8) | code[pc + 1])}`; pc += 3; break;
                case 0xc3: text = `JP ${hex4((code[pc + 2] << 8) | code[pc + 1])}`; pc += 3; break;
                case 0x18: { let off = code[pc+1]; if(off > 127) off -= 256; text = `JR ${hex4(pc + 2 + off)}`; pc += 2; break; }
                case 0x10: { let off = code[pc+1]; if(off > 127) off -= 256; text = `DJNZ ${hex4(pc + 2 + off)}`; pc += 2; break; }
                case 0x00: text = 'NOP'; pc += 1; break;
                default: text = op !== 0 ? `DB ${hex2(op)}` : '-'; pc += 1;
            }
        }
        out.push({ addr: currentPc, text });
    }
    return out;
}

const samplePrograms: Record<string, () => Uint8Array> = {
    '1. 基本ロード': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x3e, 0xaa, 0x06, 0xbb], CODE_BASE);
        return m;
    },
    '2. DJNZループ (10回)': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x06, 0x0A, 0x3E, 0x00, 0x3D, 0x10, 0xFD], CODE_BASE);
        return m;
    },
    '3. インダイレクト': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x26, 0x40, 0x2e, 0x05, 0x3e, 0xd0, 0x77], CODE_BASE);
        return m;
    },
    '4. JRジャンプ': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x3E, 0xFF, 0x18, 0x01, 0x00, 0x06, 0xAA], CODE_BASE);
        return m;
    },
    '5. メモリ転送': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x3e, 0x7f, 0x32, 0x00, 0x40], CODE_BASE);
        return m;
    },
    '6. HLペア操作': () => {
        const m = new Uint8Array(MEM_SIZE);
        m.set([0x26, 0x12, 0x2e, 0x34], CODE_BASE);
        return m;
    },
};

const initialRegs = { A: 0, F: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, PC: CODE_BASE, SP: 0xfffe };

export default function Z80EduApp() {
    useEffect(() => { injectTailwind(); }, []);
    const [codeMemory, setCodeMemory] = useState(samplePrograms['1. 基本ロード']());
    const [dataMemory, setDataMemory] = useState(new Uint8Array(MEM_SIZE));
    const [prevRegs, setPrevRegs] = useState(initialRegs);
    const [regs, setRegs] = useState(initialRegs);
    const [writes, setWrites] = useState<number[]>([]);
    const [editingAddr, setEditingAddr] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setDataMemory(new Uint8Array(MEM_SIZE));
        setRegs(initialRegs); setPrevRegs(initialRegs); setWrites([]);
    };

    const handleUpdateCode = (addr: number, text: string) => {
        const bytes = assembleInstruction(text, addr);
        if (bytes.length > 0) {
            const newMem = new Uint8Array(codeMemory);
            bytes.forEach((b, i) => { if (addr + i < MEM_SIZE) newMem[addr + i] = b; });
            setCodeMemory(newMem);
        }
        setEditingAddr(null);
    };

    // ===== SAVE: ASMテキストとして保存 =====
    const saveAsm = () => {
        const lines = disasm(codeMemory, CODE_BASE)
            .filter(l => l.text !== '-' && !l.text.startsWith('DB 00'))
            .map(l => l.text);
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'program.asm'; a.click();
        URL.revokeObjectURL(url);
    };

    // ===== LOAD: ASMテキストを読み込んでアセンブル =====
    const loadAsm = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n');
            const newMem = new Uint8Array(MEM_SIZE);
            let currentAddr = CODE_BASE;
            lines.forEach(line => {
                const bytes = assembleInstruction(line, currentAddr);
                if (bytes.length > 0) {
                    bytes.forEach(b => { if (currentAddr < MEM_SIZE) newMem[currentAddr++] = b; });
                }
            });
            setCodeMemory(newMem); resetState();
        };
        reader.readAsText(file);
    };

    const step = () => {
        setPrevRegs(regs);
        const newData = new Uint8Array(dataMemory);
        const op = codeMemory[regs.PC];
        const newRegs = { ...regs };
        const memWrite: number[] = [];

        if (op >= 0x40 && op <= 0x7f && op !== 0x76) {
            const srcIdx = op & 7;
            const dstIdx = (op >> 3) & 7;
            const getVal = (idx: number) => {
                const name = REGS_LIST[idx];
                return name === '(HL)' ? dataMemory[(newRegs.H << 8) | newRegs.L] : (newRegs as any)[name];
            };
            const val = getVal(srcIdx);
            if (REGS_LIST[dstIdx] === '(HL)') {
                const addr = (newRegs.H << 8) | newRegs.L;
                newData[addr] = val; memWrite.push(addr);
            } else {
                (newRegs as any)[REGS_LIST[dstIdx]] = val;
            }
            newRegs.PC += 1;
        } else {
            switch (op) {
                case 0x3e: newRegs.A = codeMemory[regs.PC + 1]; newRegs.PC += 2; break;
                case 0x06: newRegs.B = codeMemory[regs.PC + 1]; newRegs.PC += 2; break;
                case 0x3d: newRegs.A = (newRegs.A - 1) & 0xff; newRegs.F = (newRegs.A === 0 ? 0x40 : 0) | (newRegs.A & 0x80); newRegs.PC += 1; break;
                case 0x26: newRegs.H = codeMemory[regs.PC + 1]; newRegs.PC += 2; break;
                case 0x2e: newRegs.L = codeMemory[regs.PC + 1]; newRegs.PC += 2; break;
                case 0x77: { const addr = (newRegs.H << 8) | newRegs.L; newData[addr] = newRegs.A; memWrite.push(addr); newRegs.PC += 1; break; }
                case 0x32: { const addr = (codeMemory[regs.PC + 2] << 8) | codeMemory[regs.PC + 1]; newData[addr] = newRegs.A; memWrite.push(addr); newRegs.PC += 3; break; }
                case 0xC2: if (!(newRegs.F & 0x40)) newRegs.PC = (codeMemory[regs.PC + 2] << 8) | codeMemory[regs.PC + 1]; else newRegs.PC += 3; break;
                case 0xC3: newRegs.PC = (codeMemory[regs.PC + 2] << 8) | codeMemory[regs.PC + 1]; break;
                case 0x18: { let off = codeMemory[regs.PC + 1]; if(off > 127) off -= 256; newRegs.PC += 2 + off; break; }
                case 0x10: { newRegs.B = (newRegs.B - 1) & 0xff; let off = codeMemory[regs.PC + 1]; if(off > 127) off -= 256; if (newRegs.B !== 0) newRegs.PC += 2 + off; else newRegs.PC += 2; break; }
                case 0x00: newRegs.PC += 1; break;
                default: newRegs.PC += 1;
            }
        }
        setDataMemory(newData); setRegs(newRegs); setWrites(memWrite);
    };

    const FlagLamp = ({ label, bit, val, desc }: any) => {
        const isOn = (val & (1 << bit)) !== 0;
        return (
            <div className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-lg border-2 transition-all duration-300 ${isOn ? 'bg-red-500/20 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'bg-zinc-900 border-zinc-800'}`}>
                <span className={`text-xl font-black ${isOn ? 'text-red-500' : 'text-white/80'}`}>{label}</span>
                <span className={`text-[7px] font-bold mt-1 uppercase text-center ${isOn ? 'text-red-400' : 'text-zinc-600'}`}>{desc}</span>
            </div>
        );
    };

    const BoldReg = ({ label, val, prevVal, size = 2 }: any) => {
        const isChanged = val !== prevVal;
        return (
            <div className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all h-full ${isChanged ? 'bg-green-900 border-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                <span className={`font-black uppercase tracking-tight text-xs mb-1 ${isChanged ? 'text-green-300' : 'text-zinc-500'}`}>{label}</span>
                <span className={`font-mono font-bold text-xl lg:text-2xl ${isChanged ? 'text-white' : 'text-zinc-100'}`}>{size === 2 ? hex2(val) : hex4(val)}</span>
            </div>
        );
    };

    return (
        <div className="h-screen bg-zinc-950 text-zinc-200 p-2 font-sans flex flex-col items-center overflow-hidden">
            <div className="w-full max-w-[1440px] h-full flex flex-col space-y-2">
                <header className="flex justify-between items-center bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 shadow-xl shrink-0 h-14">
                    <h1 className="text-2xl font-black text-white italic tracking-tighter shrink-0">Z80<span className="text-blue-500">LAB</span></h1>
                    <div className="flex items-center gap-3 h-full">
                        <button onClick={saveAsm} className="px-3 py-1.5 h-8 bg-zinc-800 text-[10px] font-black text-blue-400 rounded border border-zinc-700 hover:bg-zinc-700 uppercase">Save ASM</button>
                        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 h-8 bg-zinc-800 text-[10px] font-black text-green-400 rounded border border-zinc-700 hover:bg-zinc-700 uppercase">Load ASM</button>
                        <input type="file" ref={fileInputRef} onChange={loadAsm} className="hidden" accept=".asm,.txt" />
                        <select
                            className="bg-zinc-800 text-zinc-200 text-xs font-bold h-8 px-4 rounded border border-zinc-700 outline-none hover:bg-zinc-700 cursor-pointer shadow-lg w-52 appearance-none"
                            onChange={(e) => {
                                const prog = samplePrograms[e.target.value];
                                if (prog) { setCodeMemory(prog()); resetState(); }
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>SELECT PROGRAM...</option>
                            {Object.keys(samplePrograms).map((name) => (<option key={name} value={name}>{name}</option>))}
                        </select>
                        <button onClick={resetState} className="bg-red-900/30 text-red-400 text-[10px] font-black h-8 px-4 rounded border border-red-900/50 hover:bg-red-900/50 uppercase">RESET</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-[400px_1fr_300px] gap-2 flex-grow min-h-0 overflow-hidden">
                    {/* ARCHITECTURE PANEL */}
                    <div className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-4 overflow-y-auto custom-scrollbar shadow-2xl">
                        <h2 className="text-blue-400 font-black text-[10px] tracking-[0.3em] border-b border-zinc-800 pb-1 uppercase text-center italic">Core Architecture</h2>
                        <div className="grid grid-cols-4 gap-2">
                            <BoldReg label="A" val={regs.A} prevVal={prevRegs.A} /><BoldReg label="F" val={regs.F} prevVal={prevRegs.F} />
                            <BoldReg label="PC" val={regs.PC} prevVal={prevRegs.PC} size={4} /><BoldReg label="SP" val={regs.SP} prevVal={prevRegs.SP} size={4} />
                        </div>
                        <div className="bg-black/60 p-3 rounded-xl border border-zinc-800">
                            <div className="flex gap-1">
                                <FlagLamp label="S" bit={7} val={regs.F} desc="Sign" /><FlagLamp label="Z" bit={6} val={regs.F} desc="Zero" />
                                <div className="w-px bg-zinc-800 mx-0.5"></div>
                                <FlagLamp label="H" bit={4} val={regs.F} desc="H-C" /><FlagLamp label="P" bit={2} val={regs.F} desc="P/V" />
                                <FlagLamp label="N" bit={1} val={regs.F} desc="N/S" /><FlagLamp label="C" bit={0} val={regs.F} desc="Carry" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-2"><BoldReg label="B" val={regs.B} prevVal={prevRegs.B}/><BoldReg label="C" val={regs.C} prevVal={prevRegs.C}/></div>
                            <div className="flex flex-col gap-2"><BoldReg label="D" val={regs.D} prevVal={prevRegs.D}/><BoldReg label="E" val={regs.E} prevVal={prevRegs.E}/></div>
                            <div className="flex flex-col gap-2"><BoldReg label="H" val={regs.H} prevVal={prevRegs.H}/><BoldReg label="L" val={regs.L} prevVal={prevRegs.L}/></div>
                        </div>
                    </div>

                    {/* PROGRAM PANEL */}
                    <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 flex flex-col overflow-hidden shadow-2xl">
                        <h2 className="text-yellow-500 font-black text-xl border-b border-yellow-500/30 pb-1 mb-2 text-center italic">PROGRAM</h2>
                        <div className="overflow-y-auto flex-grow font-mono bg-black/60 rounded-xl p-2 custom-scrollbar">
                            {disasm(codeMemory, CODE_BASE).map((l, i) => (
                                <div key={i} className={`flex gap-3 px-2 py-1 rounded-lg mb-1 border ${l.addr === regs.PC ? 'bg-yellow-500 text-black font-black' : 'text-zinc-500 border-transparent'}`}>
                                    <span className={`text-base shrink-0 font-bold ${l.addr === regs.PC ? 'text-black' : 'text-yellow-600/60'}`}>{hex4(l.addr)}</span>
                                    {editingAddr === l.addr ? (
                                        <input autoFocus className="bg-white text-black w-full px-1 rounded uppercase font-bold" value={editVal} onChange={(e) => setEditVal(e.target.value)} onBlur={() => handleUpdateCode(l.addr, editVal)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateCode(l.addr, editVal)}/>
                                    ) : (
                                        <span className="text-lg tracking-tighter cursor-pointer hover:text-white" onClick={() => { setEditingAddr(l.addr); setEditVal(l.text); }}>{l.text}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RAM PANEL */}
                    <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 flex flex-col overflow-hidden shadow-2xl">
                        <h2 className="text-red-500 font-black text-xl border-b border-red-500/30 pb-1 mb-2 text-center italic">RAM</h2>
                        <div className="overflow-y-auto flex-grow font-mono bg-black/60 rounded-xl custom-scrollbar">
                            <table className="w-full border-separate border-spacing-0">
                                <tbody>
                                {Array.from({ length: 64 }).map((_, i) => {
                                    const addr = DATA_BASE + i; const isTouched = writes.includes(addr);
                                    return (
                                        <tr key={i} className={isTouched ? 'bg-red-900/40' : ''}>
                                            <td className={`px-3 py-1 text-sm font-bold ${isTouched ? 'text-red-300' : 'text-zinc-600'}`}>{hex4(addr)}</td>
                                            <td className={`px-3 py-1 text-right text-lg font-black ${isTouched ? 'text-white' : 'text-zinc-300'}`}>{hex2(dataMemory[addr])}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <footer className="flex items-center justify-between bg-zinc-900 px-5 py-3 rounded-xl border border-zinc-800 shrink-0">
                    <div className="flex gap-8 font-mono">
                        <div className="flex flex-col"><span className="text-[8px] text-zinc-500 font-black">PC</span><span className="text-yellow-500 text-2xl font-black">{hex4(regs.PC)}</span></div>
                        <div className="flex flex-col"><span className="text-[8px] text-zinc-500 font-black">OP</span><span className="text-blue-400 text-2xl font-black">{hex2(codeMemory[regs.PC])}</span></div>
                    </div>
                    <button onClick={step} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-3 rounded-xl text-2xl border-b-4 border-blue-800 active:translate-y-1 transition-all">STEP EXECUTE</button>
                </footer>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }`}</style>
        </div>
    );
}