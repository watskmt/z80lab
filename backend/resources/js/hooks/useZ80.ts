import {useState, useCallback} from 'react';
import {
    MEM_SIZE,
    CODE_BASE,
    IO_OUT_ADDR,
    IO_IN_ADDR,
    SZP_TABLE,
    initialRegs,
    S_FLAG,
    Z_FLAG,
    H_FLAG,
    PV_FLAG,
    N_FLAG,
    C_FLAG,
} from '../constants';
import type {Registers} from '@/types';
import {samplePrograms} from '../data/samples';

export function useZ80() {
    // CPUの状態管理
    const [codeMemory, setCodeMemory] = useState(samplePrograms.basicLoad()); // プログラムメモリ (ROM相当)
    const [dataMemory, setDataMemory] = useState(new Uint8Array(MEM_SIZE)); // データメモリ (RAM相当)
    const [prevDataMemory, setPrevDataMemory] = useState(new Uint8Array(MEM_SIZE)); // 以前のメモリ状態 (変更箇所のハイライト用)
    const [ioOut, setIoOut] = useState(0); // I/O出力ポート
    const [ioIn, setIoIn] = useState(0); // I/O入力ポート
    const [prevRegs, setPrevRegs] = useState<Registers>(initialRegs); // 以前のレジスタ状態
    const [regs, setRegs] = useState<Registers>(initialRegs); // 現在のレジスタ状態
    const [stackBaseAddr, setStackBaseAddr] = useState(initialRegs.SP); // スタックのベースアドレス
    const [writes, setWrites] = useState<number[]>([]); // 今回のステップで書き込まれたメモリアドレス
    const [highlightWrite, setHighlightWrite] = useState<{ // アニメーション用の書き込み情報
        sourceAddr: number;
        destAddr: number;
        value: number;
    } | null>(null);

    /**
     * CPUの状態をリセット
     */
    const resetState = useCallback(() => {
        const emptyMem = new Uint8Array(MEM_SIZE);
        setDataMemory(emptyMem);
        setPrevDataMemory(emptyMem);
        setIoOut(0);
        setIoIn(0);
        setRegs(initialRegs);
        setPrevRegs(initialRegs);
        setStackBaseAddr(initialRegs.SP);
        setWrites([]);
    }, []);

    /**
     * 命令を1ステップ実行
     */
    const step = useCallback(() => {
        setPrevRegs(regs);
        setPrevDataMemory(new Uint8Array(dataMemory));
        const newData = new Uint8Array(dataMemory);
        const m = codeMemory;
        const dm = dataMemory;
        const r = {...regs};
        const memWrite: number[] = [];
        let writeAnimation: { sourceAddr: number; destAddr: number; value: number } | null = null;

        // ヘルパー関数: 8ビット読み込み
        const get8 = (addr: number) => {
            addr &= 0xffff;
            if (addr === IO_IN_ADDR) return ioIn;
            return dm[addr];
        };
        // ヘルパー関数: 8ビット書き込み
        const set8 = (addr: number, val: number, sourceAddr?: number) => {
            addr &= 0xffff;
            val &= 0xff;
            if (addr === IO_OUT_ADDR) {
                setIoOut(val);
            }
            newData[addr] = val;
            memWrite.push(addr);
            // 書き込みアニメーションの記録
            if (sourceAddr !== undefined && sourceAddr !== addr) {
                writeAnimation = {sourceAddr, destAddr: addr, value: val};
            }
        };
        // ヘルパー関数: 16ビット読み込み
        const get16 = (addr: number) => get8(addr) | (get8(addr + 1) << 8);
        // ヘルパー関数: 16ビット書き込み
        const set16 = (addr: number, val: number) => {
            set8(addr, val & 0xff);
            set8(addr + 1, (val >> 8) & 0xff);
        };
        // スタック操作: PUSH
        const push = (val: number) => {
            r.SP = (r.SP - 2) & 0xffff;
            set16(r.SP, val);
        };
        // スタック操作: POP
        const pop = () => {
            const val = get16(r.SP);
            r.SP = (r.SP + 2) & 0xffff;
            return val;
        };
        // レジスタ取得 (インデックス指定)
        const getReg = (idx: number) => {
            if (idx === 0) return r.B;
            if (idx === 1) return r.C;
            if (idx === 2) return r.D;
            if (idx === 3) return r.E;
            if (idx === 4) return r.H;
            if (idx === 5) return r.L;
            if (idx === 6) return get8((r.H << 8) | r.L);
            return r.A;
        };
        // レジスタ設定 (インデックス指定)
        const setReg = (idx: number, val: number) => {
            val &= 0xff;
            if (idx === 0) r.B = val;
            else if (idx === 1) r.C = val;
            else if (idx === 2) r.D = val;
            else if (idx === 3) r.E = val;
            else if (idx === 4) r.H = val;
            else if (idx === 5) r.L = val;
            else if (idx === 6) set8((r.H << 8) | r.L, val, CODE_BASE);
            else r.A = val;
        };
        // 8ビット加算
        const add8 = (a: number, b: number, cy = 0) => {
            const res = a + b + cy;
            const h = (a & 0xf) + (b & 0xf) + cy;
            r.F = SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
            if (res > 0xff) r.F |= C_FLAG;
            if (h > 0xf) r.F |= H_FLAG;
            if (((a ^ ~b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
            return res & 0xff;
        };
        // 8ビット減算
        const sub8 = (a: number, b: number, cy = 0) => {
            const res = a - b - cy;
            const h = (a & 0xf) - (b & 0xf) - cy;
            r.F = SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
            r.F |= N_FLAG;
            if (res < 0) r.F |= C_FLAG;
            if (h < 0) r.F |= H_FLAG;
            if (((a ^ b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
            return res & 0xff;
        };
        const cp8 = (a: number, b: number) => {
            sub8(a, b);
        };
        const and8 = (val: number) => {
            r.A &= val;
            r.F = SZP_TABLE[r.A] | H_FLAG;
        };
        const or8 = (val: number) => {
            r.A |= val;
            r.F = SZP_TABLE[r.A];
        };
        const xor8 = (val: number) => {
            r.A ^= val;
            r.F = SZP_TABLE[r.A];
        };

        // 命令フェッチ
        const op = m[r.PC++];
        r.R = (r.R + 1) & 0x7f; // リフレッシュレジスタ更新

        if (op >= 0x40 && op <= 0x7f) {
            // 8-bit Load (LD r, r) / HALT
            if (op === 0x76) r.PC--; else setReg((op >> 3) & 7, getReg(op & 7));
        } else if (op >= 0x80 && op <= 0xbf) {
            // 8-bit Arithmetic (ADD, ADC, SUB, SBC, AND, XOR, OR, CP)
            const val = getReg(op & 7);
            switch ((op >> 3) & 7) {
                case 0:
                    r.A = add8(r.A, val);
                    break;
                case 1:
                    r.A = add8(r.A, val, (r.F & C_FLAG));
                    break;
                case 2:
                    r.A = sub8(r.A, val);
                    break;
                case 3:
                    r.A = sub8(r.A, val, (r.F & C_FLAG));
                    break;
                case 4:
                    and8(val);
                    break;
                case 5:
                    xor8(val);
                    break;
                case 6:
                    or8(val);
                    break;
                case 7:
                    cp8(r.A, val);
                    break;
            }
        } else {
            // その他 (Misc instructions)
            switch (op) {
                case 0x00:
                    break; // NOP
                case 0x01:
                    r.C = m[r.PC++];
                    r.B = m[r.PC++];
                    break; // LD BC, nn
                case 0x02:
                    set8((r.B << 8) | r.C, r.A, CODE_BASE);
                    break; // LD (BC), A
                case 0x03: {
                    const v = ((r.B << 8) | r.C + 1) & 0xffff;
                    r.B = v >> 8;
                    r.C = v & 0xff;
                    break;
                } // INC BC
                case 0x04:
                    r.B = add8(r.B, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG);
                    break; // INC B
                case 0x05:
                    r.B = sub8(r.B, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG) | N_FLAG;
                    break; // DEC B
                case 0x06:
                    r.B = m[r.PC++];
                    break; // LD B, n
                case 0x08: {
                    const tmp = r.A;
                    r.A = r.A2;
                    r.A2 = tmp;
                    const tmp2 = r.F;
                    r.F = r.F2;
                    r.F2 = tmp2;
                    break;
                } // EX AF, AF'
                case 0x09: { // ADD HL, BC
                    const hl = (r.H << 8) | r.L;
                    const bc = (r.B << 8) | r.C;
                    const res = hl + bc;
                    r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
                    r.H = (res >> 8) & 0xff;
                    r.L = res & 0xff;
                    break;
                }
                case 0x0a:
                    r.A = get8((r.B << 8) | r.C);
                    break; // LD A, (BC)
                case 0x0b: {
                    const v = ((r.B << 8) | r.C - 1) & 0xffff;
                    r.B = v >> 8;
                    r.C = v & 0xff;
                    break;
                } // DEC BC
                case 0x0c:
                    r.C = add8(r.C, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG);
                    break; // INC C
                case 0x0d:
                    r.C = sub8(r.C, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG) | N_FLAG;
                    break; // DEC C
                case 0x0e:
                    r.C = m[r.PC++];
                    break; // LD C, n
                case 0x10: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    r.B = (r.B - 1) & 0xff;
                    if (r.B !== 0) r.PC += off;
                    break;
                } // DJNZ
                case 0x11:
                    r.E = m[r.PC++];
                    r.D = m[r.PC++];
                    break; // LD DE, nn
                case 0x12:
                    set8((r.D << 8) | r.E, r.A, CODE_BASE);
                    break; // LD (DE), A
                case 0x13: {
                    const v = ((r.D << 8) | r.E + 1) & 0xffff;
                    r.D = v >> 8;
                    r.E = v & 0xff;
                    break;
                } // INC DE
                case 0x14:
                    r.D = add8(r.D, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG);
                    break; // INC D
                case 0x15:
                    r.D = sub8(r.D, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG) | N_FLAG;
                    break; // DEC D
                case 0x16:
                    r.D = m[r.PC++];
                    break; // LD D, n
                case 0x18: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    r.PC += off;
                    break;
                } // JR
                case 0x19: { // ADD HL, DE
                    const hl = (r.H << 8) | r.L;
                    const de = (r.D << 8) | r.E;
                    const res = hl + de;
                    r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
                    r.H = (res >> 8) & 0xff;
                    r.L = res & 0xff;
                    break;
                }
                case 0x1a:
                    r.A = get8((r.D << 8) | r.E);
                    break; // LD A, (DE)
                case 0x1b: {
                    const v = ((r.D << 8) | r.E - 1) & 0xffff;
                    r.D = v >> 8;
                    r.E = v & 0xff;
                    break;
                } // DEC DE
                case 0x1c:
                    r.E = add8(r.E, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG);
                    break; // INC E
                case 0x1d:
                    r.E = sub8(r.E, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG) | N_FLAG;
                    break; // DEC E
                case 0x1e:
                    r.E = m[r.PC++];
                    break; // LD E, n
                case 0x20: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    if (!(r.F & Z_FLAG)) r.PC += off;
                    break;
                } // JR NZ
                case 0x21:
                    r.L = m[r.PC++];
                    r.H = m[r.PC++];
                    break; // LD HL, nn
                case 0x22: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    set16(adr, (r.H << 8) | r.L);
                    break;
                } // LD (nn), HL
                case 0x23: {
                    const v = ((r.H << 8) | r.L + 1) & 0xffff;
                    r.H = v >> 8;
                    r.L = v & 0xff;
                    break;
                } // INC HL
                case 0x24:
                    r.H = add8(r.H, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG);
                    break; // INC H
                case 0x25:
                    r.H = sub8(r.H, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG) | N_FLAG;
                    break; // DEC H
                case 0x26:
                    r.H = m[r.PC++];
                    break; // LD H, n
                case 0x28: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    if (r.F & Z_FLAG) r.PC += off;
                    break;
                } // JR Z
                case 0x29: { // ADD HL, HL
                    const hl = (r.H << 8) | r.L;
                    const res = hl + hl;
                    r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
                    r.H = (res >> 8) & 0xff;
                    r.L = res & 0xff;
                    break;
                }
                case 0x2a: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    const v = get16(adr);
                    r.H = v >> 8;
                    r.L = v & 0xff;
                    break;
                } // LD HL, (nn)
                case 0x2b: {
                    const v = ((r.H << 8) | r.L - 1) & 0xffff;
                    r.H = v >> 8;
                    r.L = v & 0xff;
                    break;
                } // DEC HL
                case 0x2c:
                    r.L = add8(r.L, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG);
                    break; // INC L
                case 0x2d:
                    r.L = sub8(r.L, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG) | N_FLAG;
                    break; // DEC L
                case 0x2e:
                    r.L = m[r.PC++];
                    break; // LD L, n
                case 0x30: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    if (!(r.F & C_FLAG)) r.PC += off;
                    break;
                } // JR NC
                case 0x31:
                    r.SP = m[r.PC++] | (m[r.PC++] << 8);
                    break; // LD SP, nn
                case 0x32: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    set8(adr, r.A, CODE_BASE);
                    break;
                } // LD (nn), A
                case 0x33:
                    r.SP = (r.SP + 1) & 0xffff;
                    break; // INC SP
                case 0x34: {
                    const adr = (r.H << 8) | r.L;
                    const v = add8(get8(adr), 1);
                    set8(adr, v);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG);
                    break;
                } // INC (HL)
                case 0x35: {
                    const adr = (r.H << 8) | r.L;
                    const v = sub8(get8(adr), 1);
                    set8(adr, v);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG) | N_FLAG;
                    break;
                } // DEC (HL)
                case 0x36:
                    set8((r.H << 8) | r.L, m[r.PC++]);
                    break; // LD (HL), n
                case 0x38: {
                    let off = m[r.PC++];
                    if (off > 127) off -= 256;
                    if (r.F & C_FLAG) r.PC += off;
                    break;
                } // JR C
                case 0x39: { // ADD HL, SP
                    const hl = (r.H << 8) | r.L;
                    const res = hl + r.SP;
                    r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
                    r.H = (res >> 8) & 0xff;
                    r.L = res & 0xff;
                    break;
                }
                case 0x3a: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    r.A = get8(adr);
                    break;
                } // LD A, (nn)
                case 0x3b:
                    r.SP = (r.SP - 1) & 0xffff;
                    break; // DEC SP
                case 0x3c:
                    r.A = add8(r.A, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG);
                    break; // INC A
                case 0x3d:
                    r.A = sub8(r.A, 1);
                    r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG) | N_FLAG;
                    break; // DEC A
                case 0x3e:
                    r.A = m[r.PC++];
                    break; // LD A, n
                case 0xc0:
                    if (!(r.F & Z_FLAG)) r.PC = pop();
                    break; // RET NZ
                case 0xc1: {
                    const v = pop();
                    r.C = v & 0xff;
                    r.B = v >> 8;
                    break;
                } // POP BC
                case 0xc2: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & Z_FLAG)) r.PC = adr;
                    break;
                } // JP NZ, nn
                case 0xc3:
                    r.PC = m[r.PC++] | (m[r.PC++] << 8);
                    break; // JP nn
                case 0xc4: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & Z_FLAG)) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL NZ, nn
                case 0xc5:
                    push((r.B << 8) | r.C);
                    break; // PUSH BC
                case 0xc6:
                    r.A = add8(r.A, m[r.PC++]);
                    break; // ADD A, n
                case 0xc7:
                    push(r.PC);
                    r.PC = 0x00;
                    break; // RST 00H
                case 0xc8:
                    if (r.F & Z_FLAG) r.PC = pop();
                    break; // RET Z
                case 0xc9:
                    r.PC = pop();
                    break; // RET
                case 0xca: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & Z_FLAG) r.PC = adr;
                    break;
                } // JP Z, nn
                case 0xcc: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & Z_FLAG) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL Z, nn
                case 0xcd: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    push(r.PC);
                    r.PC = adr;
                    break;
                } // CALL nn
                case 0xce:
                    r.A = add8(r.A, m[r.PC++], (r.F & C_FLAG));
                    break; // ADC A, n
                case 0xcf:
                    push(r.PC);
                    r.PC = 0x08;
                    break; // RST 08H
                case 0xd0:
                    if (!(r.F & C_FLAG)) r.PC = pop();
                    break; // RET NC
                case 0xd1: {
                    const v = pop();
                    r.E = v & 0xff;
                    r.D = v >> 8;
                    break;
                } // POP DE
                case 0xd2: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & C_FLAG)) r.PC = adr;
                    break;
                } // JP NC, nn
                case 0xd4: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & C_FLAG)) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL NC, nn
                case 0xd5:
                    push((r.D << 8) | r.E);
                    break; // PUSH DE
                case 0xd6:
                    r.A = sub8(r.A, m[r.PC++]);
                    break; // SUB n
                case 0xd7:
                    push(r.PC);
                    r.PC = 0x10;
                    break; // RST 10H
                case 0xd8:
                    if (r.F & C_FLAG) r.PC = pop();
                    break; // RET C
                case 0xd9: { // EXX
                    let tmp = r.B;
                    r.B = r.B2;
                    r.B2 = tmp;
                    tmp = r.C;
                    r.C = r.C2;
                    r.C2 = tmp;
                    tmp = r.D;
                    r.D = r.D2;
                    r.D2 = tmp;
                    tmp = r.E;
                    r.E = r.E2;
                    r.E2 = tmp;
                    tmp = r.H;
                    r.H = r.H2;
                    r.H2 = tmp;
                    tmp = r.L;
                    r.L = r.L2;
                    r.L2 = tmp;
                    break;
                }
                case 0xda: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & C_FLAG) r.PC = adr;
                    break;
                } // JP C, nn
                case 0xdc: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & C_FLAG) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL C, nn
                case 0xde:
                    r.A = sub8(r.A, m[r.PC++], (r.F & C_FLAG));
                    break; // SBC A, n
                case 0xdf:
                    push(r.PC);
                    r.PC = 0x18;
                    break; // RST 18H
                case 0xe0:
                    if (!(r.F & PV_FLAG)) r.PC = pop();
                    break; // RET PO
                case 0xe1: {
                    const v = pop();
                    r.L = v & 0xff;
                    r.H = v >> 8;
                    break;
                } // POP HL
                case 0xe2: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & PV_FLAG)) r.PC = adr;
                    break;
                } // JP PO, nn
                case 0xe3: {
                    const v = get16(r.SP);
                    set16(r.SP, (r.H << 8) | r.L);
                    r.H = v >> 8;
                    r.L = v & 0xff;
                    break;
                } // EX (SP), HL
                case 0xe4: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & PV_FLAG)) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL PO, nn
                case 0xe5:
                    push((r.H << 8) | r.L);
                    break; // PUSH HL
                case 0xe6:
                    and8(m[r.PC++]);
                    break; // AND n
                case 0xe7:
                    push(r.PC);
                    r.PC = 0x20;
                    break; // RST 20H
                case 0xe8:
                    if (r.F & PV_FLAG) r.PC = pop();
                    break; // RET PE
                case 0xe9:
                    r.PC = (r.H << 8) | r.L;
                    break; // JP (HL)
                case 0xea: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & PV_FLAG) r.PC = adr;
                    break;
                } // JP PE, nn
                case 0xeb: {
                    let t = r.H;
                    r.H = r.D;
                    r.D = t;
                    t = r.L;
                    r.L = r.E;
                    r.E = t;
                    break;
                } // EX DE, HL
                case 0xec: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & PV_FLAG) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL PE, nn
                case 0xee:
                    xor8(m[r.PC++]);
                    break; // XOR n
                case 0xef:
                    push(r.PC);
                    r.PC = 0x28;
                    break; // RST 28H
                case 0xf0:
                    if (!(r.F & S_FLAG)) r.PC = pop();
                    break; // RET P
                case 0xf1: {
                    const v = pop();
                    r.F = v & 0xff;
                    r.A = v >> 8;
                    break;
                } // POP AF
                case 0xf2: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & S_FLAG)) r.PC = adr;
                    break;
                } // JP P, nn
                case 0xf3:
                    break; // DI
                case 0xf4: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (!(r.F & S_FLAG)) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL P, nn
                case 0xf5:
                    push((r.A << 8) | r.F);
                    break; // PUSH AF
                case 0xf6:
                    or8(m[r.PC++]);
                    break; // OR n
                case 0xf7:
                    push(r.PC);
                    r.PC = 0x30;
                    break; // RST 30H
                case 0xf8:
                    if (r.F & S_FLAG) r.PC = pop();
                    break; // RET M
                case 0xf9:
                    r.SP = (r.H << 8) | r.L;
                    break; // LD SP, HL
                case 0xfa: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & S_FLAG) r.PC = adr;
                    break;
                } // JP M, nn
                case 0xfb:
                    break; // EI
                case 0xfc: {
                    const adr = m[r.PC++] | (m[r.PC++] << 8);
                    if (r.F & S_FLAG) {
                        push(r.PC);
                        r.PC = adr;
                    }
                    break;
                } // CALL M, nn
                case 0xfe:
                    cp8(r.A, m[r.PC++]);
                    break; // CP n
                case 0xff:
                    push(r.PC);
                    r.PC = 0x38;
                    break; // RST 38H
                case 0xcb: {
                    // BIT, RES, SET, Shift/Rotate instructions (Prefix CB)
                    const cbOp = m[r.PC++];
                    const val = getReg(cbOp & 7);
                    let res = val;
                    switch (cbOp >> 3) {
                        case 0:
                            r.F = (val >> 7) & C_FLAG;
                            res = ((val << 1) | r.F) & 0xff;
                            r.F |= SZP_TABLE[res];
                            break; // RLC
                        case 1:
                            r.F = val & C_FLAG;
                            res = (val >> 1) | (r.F << 7);
                            r.F |= SZP_TABLE[res];
                            break; // RRC
                        case 2: {
                            const c = r.F & C_FLAG;
                            r.F = (val >> 7) & C_FLAG;
                            res = ((val << 1) | c) & 0xff;
                            r.F |= SZP_TABLE[res];
                            break;
                        } // RL
                        case 3: {
                            const c2 = r.F & C_FLAG;
                            r.F = val & C_FLAG;
                            res = (val >> 1) | (c2 << 7);
                            r.F |= SZP_TABLE[res];
                            break;
                        } // RR
                        case 4:
                            r.F = (val >> 7) & C_FLAG;
                            res = (val << 1) & 0xff;
                            r.F |= SZP_TABLE[res];
                            break; // SLA
                        case 5:
                            r.F = val & C_FLAG;
                            res = (val >> 1) | (val & 0x80);
                            r.F |= SZP_TABLE[res];
                            break; // SRA
                        case 7:
                            r.F = val & C_FLAG;
                            res = (val >> 1);
                            r.F |= SZP_TABLE[res];
                            break; // SRL
                        default:
                            if ((cbOp >> 6) === 1) { // BIT
                                const bit = (cbOp >> 3) & 7;
                                r.F = (r.F & C_FLAG) | H_FLAG | (SZP_TABLE[val & (1 << bit)] & ~PV_FLAG);
                                if (bit === 7 && (val & 0x80)) r.F |= S_FLAG;
                                return;
                            } else if ((cbOp >> 6) === 2) {
                                res = val & ~(1 << ((cbOp >> 3) & 7));
                            } // RES
                            else if ((cbOp >> 6) === 3) {
                                res = val | (1 << ((cbOp >> 3) & 7));
                            } // SET
                    }
                    setReg(cbOp & 7, res);
                    break;
                }
                case 0xdb: {
                    const port = m[r.PC++];
                    r.A = (port === 1) ? ioIn : 0;
                    break;
                } // IN A, (n)
                case 0xd3: {
                    const port = m[r.PC++];
                    if (port === 0) setIoOut(r.A);
                    break;
                } // OUT (n), A
                case 0xed: {
                    // Extended instructions (Prefix ED)
                    const edOp = m[r.PC++];
                    switch (edOp) {
                        case 0x44:
                            r.A = sub8(0, r.A);
                            break; // NEG
                        case 0x46:
                            r.IM = 0;
                            break; // IM 0
                        case 0x56:
                            r.IM = 1;
                            break; // IM 1
                        case 0x5e:
                            r.IM = 2;
                            break; // IM 2
                        case 0x47:
                            r.I = r.A;
                            break; // LD I, A
                        case 0x4f:
                            r.R = r.A;
                            break; // LD R, A
                        case 0x57:
                            r.A = r.I;
                            r.F = (r.F & C_FLAG) | SZP_TABLE[r.A];
                            break; // LD A, I
                        case 0x5f:
                            r.A = r.R;
                            r.F = (r.F & C_FLAG) | SZP_TABLE[r.A];
                            break; // LD A, R
                        case 0x40:
                        case 0x48:
                        case 0x50:
                        case 0x58:
                        case 0x60:
                        case 0x68:
                        case 0x78: { // IN r, (C)
                            const port = r.C;
                            let val = (port === 1) ? ioIn : 0;
                            setReg((edOp >> 3) & 7, val);
                            r.F = (r.F & C_FLAG) | SZP_TABLE[getReg((edOp >> 3) & 7)];
                            break;
                        }
                        case 0x41:
                        case 0x49:
                        case 0x51:
                        case 0x59:
                        case 0x61:
                        case 0x69:
                        case 0x79: { // OUT (C), r
                            const port = r.C;
                            if (port === 0) setIoOut(getReg((edOp >> 3) & 7));
                            break;
                        }
                        case 0x4a: { // ADC HL, BC
                            const hl = (r.H << 8) | r.L;
                            const bc = (r.B << 8) | r.C;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl + bc + carry;
                            r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x5a: { // ADC HL, DE
                            const hl = (r.H << 8) | r.L;
                            const de = (r.D << 8) | r.E;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl + de + carry;
                            r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x6a: { // ADC HL, HL
                            const hl = (r.H << 8) | r.L;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl + hl + carry;
                            r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x7a: { // ADC HL, SP
                            const hl = (r.H << 8) | r.L;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl + r.SP + carry;
                            r.F = (res > 0xffff ? C_FLAG : 0) | (res === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x42: { // SBC HL, BC
                            const hl = (r.H << 8) | r.L;
                            const bc = (r.B << 8) | r.C;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl - bc - carry;
                            r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x52: { // SBC HL, DE
                            const hl = (r.H << 8) | r.L;
                            const de = (r.D << 8) | r.E;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl - de - carry;
                            r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x62: { // SBC HL, HL
                            const hl = (r.H << 8) | r.L;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl - hl - carry;
                            r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x72: { // SBC HL, SP
                            const hl = (r.H << 8) | r.L;
                            const carry = (r.F & C_FLAG) ? 1 : 0;
                            const res = hl - r.SP - carry;
                            r.F = (res < 0 ? C_FLAG : 0) | N_FLAG | ((res & 0xffff) === 0 ? Z_FLAG : 0) | ((res & 0x8000) ? S_FLAG : 0);
                            r.H = (res >> 8) & 0xff;
                            r.L = res & 0xff;
                            break;
                        }
                        case 0x4d:
                        case 0x45:
                            r.PC = pop();
                            break; // RETI / RETN
                        case 0x67: { // RRD
                            const hlVal = get8((r.H << 8) | r.L);
                            const lowA = r.A & 0x0f;
                            r.A = (r.A & 0xf0) | (hlVal & 0x0f);
                            set8((r.H << 8) | r.L, (hlVal >> 4) | (lowA << 4));
                            r.F = (r.F & C_FLAG) | SZP_TABLE[r.A];
                            break;
                        }
                        case 0x6f: { // RLD
                            const hlVal = get8((r.H << 8) | r.L);
                            const lowA = r.A & 0x0f;
                            r.A = (r.A & 0xf0) | (hlVal >> 4);
                            set8((r.H << 8) | r.L, (hlVal << 4) | lowA);
                            r.F = (r.F & C_FLAG) | SZP_TABLE[r.A];
                            break;
                        }
                        case 0xb0: { // LDIR
                            let src = (r.H << 8) | r.L;
                            let dst = (r.D << 8) | r.E;
                            let len = (r.B << 8) | r.C;
                            if (len > 0) {
                                set8(dst, get8(src));
                                src = (src + 1) & 0xffff;
                                dst = (dst + 1) & 0xffff;
                                len = (len - 1) & 0xffff;
                                r.H = src >> 8;
                                r.L = src & 0xff;
                                r.D = dst >> 8;
                                r.E = dst & 0xff;
                                r.B = len >> 8;
                                r.C = len & 0xff;
                                if (len > 0) r.PC -= 2;
                                r.F &= ~(N_FLAG | H_FLAG | PV_FLAG);
                            }
                            break;
                        }
                        case 0xb8: { // LDDR
                            let src = (r.H << 8) | r.L;
                            let dst = (r.D << 8) | r.E;
                            let len = (r.B << 8) | r.C;
                            if (len > 0) {
                                set8(dst, get8(src));
                                src = (src - 1) & 0xffff;
                                dst = (dst - 1) & 0xffff;
                                len = (len - 1) & 0xffff;
                                r.H = src >> 8;
                                r.L = src & 0xff;
                                r.D = dst >> 8;
                                r.E = dst & 0xff;
                                r.B = len >> 8;
                                r.C = len & 0xff;
                                if (len > 0) r.PC -= 2;
                                r.F &= ~(N_FLAG | H_FLAG | PV_FLAG);
                            }
                            break;
                        }
                        case 0xb1: { // CPIR
                            let addr = (r.H << 8) | r.L;
                            let len = (r.B << 8) | r.C;
                            if (len > 0) {
                                cp8(r.A, get8(addr));
                                addr = (addr + 1) & 0xffff;
                                len = (len - 1) & 0xffff;
                                r.H = addr >> 8;
                                r.L = addr & 0xff;
                                r.B = len >> 8;
                                r.C = len & 0xff;
                                if (len > 0 && !(r.F & Z_FLAG)) r.PC -= 2;
                            }
                            break;
                        }
                        case 0xb9: { // CPDR
                            let addr = (r.H << 8) | r.L;
                            let len = (r.B << 8) | r.C;
                            if (len > 0) {
                                cp8(r.A, get8(addr));
                                addr = (addr - 1) & 0xffff;
                                len = (len - 1) & 0xffff;
                                r.H = addr >> 8;
                                r.L = addr & 0xff;
                                r.B = len >> 8;
                                r.C = len & 0xff;
                                if (len > 0 && !(r.F & Z_FLAG)) r.PC -= 2;
                            }
                            break;
                        }
                        case 0xa2:
                        case 0xaa: { // INIR / INDR
                            let addr = (r.H << 8) | r.L;
                            const port = r.C;
                            set8(addr, (port === 1) ? ioIn : 0);
                            r.B = (r.B - 1) & 0xff;
                            addr = (edOp === 0xa2) ? (addr + 1) & 0xffff : (addr - 1) & 0xffff;
                            r.H = addr >> 8;
                            r.L = addr & 0xff;
                            r.F = (r.B === 0) ? Z_FLAG : 0;
                            if (r.B > 0) r.PC -= 2;
                            break;
                        }
                        case 0xa3:
                        case 0xab: { // OTIR / OTDR
                            let addr = (r.H << 8) | r.L;
                            const port = r.C;
                            if (port === 0) setIoOut(get8(addr));
                            r.B = (r.B - 1) & 0xff;
                            addr = (edOp === 0xa3) ? (addr + 1) & 0xffff : (addr - 1) & 0xffff;
                            r.H = addr >> 8;
                            r.L = addr & 0xff;
                            r.F = (r.B === 0) ? Z_FLAG : 0;
                            if (r.B > 0) r.PC -= 2;
                            break;
                        }
                        default:
                            break;
                    }
                    break;
                }
                case 0xdd:
                case 0xfd: {
                    // Index register instructions (Prefix DD: IX, FD: IY)
                    const isIY = (op === 0xfd);
                    const subOp = m[r.PC++];
                    const idxReg = isIY ? 'IY' : 'IX';
                    if (subOp === 0x21) {
                        r[idxReg] = m[r.PC++] | (m[r.PC++] << 8);
                    } // LD IX/IY, nn
                    else if (subOp === 0x36) {
                        let d = m[r.PC++];
                        if (d > 127) d -= 256;
                        set8((r[idxReg] + d) & 0xffff, m[r.PC++], CODE_BASE);
                    } // LD (IX/IY+d), n
                    else if (subOp === 0x7e) {
                        let d = m[r.PC++];
                        if (d > 127) d -= 256;
                        r.A = get8((r[idxReg] + d) & 0xffff);
                    } // LD A, (IX/IY+d)
                    else if (subOp === 0x77) {
                        let d = m[r.PC++];
                        if (d > 127) d -= 256;
                        set8((r[idxReg] + d) & 0xffff, r.A, CODE_BASE);
                    } // LD (IX/IY+d), A
                    else if (subOp === 0x23) {
                        r[idxReg] = (r[idxReg] + 1) & 0xffff;
                    } // INC IX/IY
                    else if (subOp === 0x2b) {
                        r[idxReg] = (r[idxReg] - 1) & 0xffff;
                    } // DEC IX/IY
                    else if (subOp === 0xe5) {
                        push(r[idxReg]);
                    } // PUSH IX/IY
                    else if (subOp === 0xe1) {
                        r[idxReg] = pop();
                    } // POP IX/IY
                    break;
                }
                default:
                    break;
            }
        }
        // 状態の更新
        setDataMemory(newData);
        setRegs(r);
        setWrites(memWrite);
        if (writeAnimation) {
            setHighlightWrite(writeAnimation);
            setTimeout(() => setHighlightWrite(null), 800);
        }
    }, [regs, dataMemory, codeMemory, ioIn]);

    /**
     * 手動でのメモリ更新
     */
    const updateRam = useCallback((addr: number, val: number) => {
        const newMem = new Uint8Array(dataMemory);
        newMem[addr] = val;
        setDataMemory(newMem);
        setPrevDataMemory(new Uint8Array(dataMemory));
    }, [dataMemory]);

    return {
        codeMemory, setCodeMemory,
        dataMemory, setDataMemory,
        prevDataMemory, setPrevDataMemory,
        ioOut, setIoOut,
        ioIn, setIoIn,
        prevRegs, setPrevRegs,
        regs, setRegs,
        stackBaseAddr, setStackBaseAddr,
        writes, setWrites,
        highlightWrite, setHighlightWrite,
        resetState,
        step,
        updateRam,
    };
}
