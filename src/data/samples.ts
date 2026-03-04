import { MEM_SIZE, CODE_BASE } from '../constants';

export const samplePrograms: Record<string, () => Uint8Array> = {
  basicLoad: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x3e, 0xaa, 0x06, 0xbb, 0x21, 0x00, 0x40, 0x77], CODE_BASE);
    return m;
  },
  djnzLoop10: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x06, 0x0a, 0x3e, 0x00, 0x3c, 0x10, 0xfd], CODE_BASE);
    return m;
  },
  stackOperation: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x21, 0x12, 0x34, 0xe5, 0x01, 0x00, 0x00, 0xd1], CODE_BASE);
    return m;
  },
  ldirTransfer: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([
      0x21, 0x00, 0x00, // LD HL, 0000
      0x11, 0x00, 0x40, // LD DE, 4000
      0x01, 0x04, 0x00, // LD BC, 0004
      0xed, 0xb0        // LDIR
    ], CODE_BASE);
    return m;
  },
  memoryTransfer: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x3e, 0x7f, 0x32, 0x00, 0x40], CODE_BASE);
    return m;
  },
  hlPairOperation: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x26, 0x12, 0x2e, 0x34], CODE_BASE);
    return m;
  },
  ioSwitchToLamp: () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([
      0x3a, 0x01, 0x80, // LD A, (8001H) ; 入力スイッチ
      0x32, 0x00, 0x80, // LD (8000H), A ; 出力ランプ
      0xc3, 0x00, 0x00  // JP 0000H
    ], CODE_BASE);
    return m;
  },
};

export const sampleProgramLabels: Record<string, string> = {
  basicLoad: '1. 基本ロード',
  djnzLoop10: '2. DJNZループ (10回)',
  stackOperation: '3. スタック操作',
  ldirTransfer: '4. LDIR転送',
  memoryTransfer: '5. メモリ転送',
  hlPairOperation: '6. HLペア操作',
  ioSwitchToLamp: '7. I/O連携 (スイッチ→ランプ)',
};
