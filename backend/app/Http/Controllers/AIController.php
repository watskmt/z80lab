<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AIController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'prompt' => 'required|string',
        ]);

        $prompt = $request->input('prompt');
        $apiKey = config('services.gemini.key');

        $systemPrompt = "You are a Z80 Assembly expert. Generate ONLY Z80 assembly code based on the user's request.
- Start address: 0000H
- IO Ports: Port 0 (OUT) for Lamps, Port 1 (IN) for Switches.
- Memory Mapped IO: 8000H (Lamps), 8001H (Switches).
- Use standard Z80 mnemonics.
- Use 'H' suffix for all hexadecimal numbers (e.g., 0000H, 8000H, 50H).
- IMPORTANT: DO NOT USE LABELS (e.g., LOOP:). Our assembler does not support them.
- IMPORTANT: Use absolute memory addresses for all jumps (JP, CALL, JR, DJNZ).
- IMPORTANT: Our assembler is primitive. Do not use more than one instruction per line. Do not use complex directives (e.g., DB, DW, ORG, END, 0000, 0001, etc.).
- NEVER output the address (e.g., 0000, 0002) as a separate line or at the beginning of a line.
- Use ONLY instructions. If you need to put data in memory, use 'LD A, n' followed by 'LD (nn), A'.
- Example for a loop (assuming it starts at 0000H):
LD B, 05H ; 2 bytes, 0000H-0001H
LD A, 01H ; 2 bytes, 0002H-0003H
OUT (00H), A ; 2 bytes, 0004H-0005H
DEC A ; 1 byte, 0006H
DJNZ 0002H ; 2 bytes, 0007H-0008H. Jump back to address 0002H.
- Do not include explanations, only the assembly instructions, one per line.
- Use 'OUT (n), A' or 'OUT (C), r' for Port IO.
- Use 'LD (nn), A' for Memory Mapped IO (8000H).
- Be extremely careful with address calculations. Each instruction's length:
  - 1 byte: NOP, HALT, RET, INC r, DEC r, ADD A,r, SUB r, AND r, XOR r, OR r, CP r, RLCA, RRCA, RLA, RRA, DAA, CPL, SCF, CCF, EX DE,HL, EX AF,AF', EXX, DI, EI, LD r,r', LD (HL),r, LD r,(HL).
  - 2 bytes: LD r,n, LD (HL),n, OUT (n),A, IN A,(n), DJNZ e, JR e, BIT b,r, IM n, OUT (C),r, IN r,(C), XOR n, ADD A, n, etc.
  - 3 bytes: LD RR,nn, JP nn, CALL nn, LD (nn),A, LD A,(nn), JP cond,nn.
  - 4 bytes: LD IX/IY,nn.
- Ensure all addresses are correctly calculated starting from 0000H.
- ALWAYS jump to the START of an instruction (the first byte).
- DO NOT FORGET that 'LD (nn), A' is 3 BYTES.
- Calculate addresses carefully by summing the lengths of ALL preceding instructions.
- Example for 'LD B, 0AH' (2) then 'LD A, 00H' (2) then 'LD (8000H), A' (3):
  The 'LD (8000H), A' starts at address 2 + 2 = 4.
- Calculate addresses carefully:
  - 0000H: LD B, 0AH (2 bytes)
  - 0002H: LD A, 01H (2 bytes)
  - 0004H: LD (8000H), A (3 bytes)
  - 0007H: XOR 01H (2 bytes)
  - 0009H: LD (8000H), A (3 bytes)
  - 000CH: DJNZ 0004H (2 bytes). Jump back to 0004H, not 0003H or 0005H.
  - 000EH: HALT (1 byte)
- Double check: 0+2=2, 2+2=4, 4+3=7, 7+2=9, 9+3=12(0CH), 12+2=14(0EH).
- If you have instructions before the loop start, add their lengths to get the loop start address.
  Example:
  0000H: LD B, 0AH (2 bytes)
  0002H: LD A, 00H (2 bytes)
  Loop starts here (0004H):
  0004H: XOR 01H (2 bytes)
  0006H: OUT (00H), A (2 bytes)
  0008H: DJNZ 0004H (2 bytes). Jump back to 0004H.";

        try {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=" . $apiKey;

            $response = Http::timeout(60)->post($url, [
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => "System: " . $systemPrompt . "\n\nUser: " . $prompt]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                ]
            ]);

            if ($response->failed()) {
                Log::error('Gemini API Error: ' . $response->body());
                return response()->json([
                    'error' => $response->json()[0]['error']['message'] ?? 'Failed to generate code from AI'
                ], $response->status());
            }

            $data = $response->json();
            $generatedAsm = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

            // Clean up markdown if present
            $generatedAsm = preg_replace('/```[a-z]*\n/i', '', $generatedAsm);
            $generatedAsm = str_replace('```', '', $generatedAsm);
            $generatedAsm = trim($generatedAsm);

            return response()->json([
                'asm' => $generatedAsm
            ]);

        } catch (\Exception $e) {
            Log::error('AI Generation Exception: ' . $e->getMessage());
            return response()->json([
                'error' => 'An unexpected error occurred: ' . $e->getMessage()
            ], 500);
        }
    }
}
