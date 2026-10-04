import type { KeyboardDefinition } from '../core/definition';
import {
  RK_DATA_AT,
  RK_FIRST_DATA_AT,
  RK_KEYMAP_REPORTS,
  RK_REPORT_ID,
  RK_REPORT_SIZE,
} from '../drivers/royal-kludge';
import type { Transport } from '../drivers/types';

/**
 * A Royal Kludge keyboard that exists only in memory. Like the real one it takes
 * reports and answers nothing. Unlike the real one it can be asked what it holds,
 * which is what the tests do.
 */
export class VirtualRoyalKludge {
  /** The key bytes of the last complete keymap, or null while none has arrived. */
  keymap: Uint8Array | null = null;
  /** The last lighting report, without its report id. */
  lighting: Uint8Array | null = null;
  private parts: Uint8Array[] = [];

  /** Takes one feature report: its id and the 64 bytes after it. */
  receive(reportId: number, data: Uint8Array): void {
    if (reportId !== RK_REPORT_ID || data.length !== RK_REPORT_SIZE - 1) return;
    const [count, index] = data;

    if (count === 1) {
      if (index === 1 && data[2] === 0x02 && data[3] === 0x29) this.lighting = data.slice();
      return;
    }
    if (count !== RK_KEYMAP_REPORTS) return;

    // A keymap starts with report 1 and has to arrive whole and in order.
    if (index === 1) this.parts = [];
    if (index !== this.parts.length + 1) {
      this.parts = [];
      return;
    }
    // `data` has no report id in front, so the key bytes start one byte earlier.
    this.parts.push(data.slice((index === 1 ? RK_FIRST_DATA_AT : RK_DATA_AT) - 1));
    if (this.parts.length < RK_KEYMAP_REPORTS) return;

    const keymap = new Uint8Array(this.parts.reduce((total, part) => total + part.length, 0));
    let at = 0;
    for (const part of this.parts) {
      keymap.set(part, at);
      at += part.length;
    }
    this.keymap = keymap;
    this.parts = [];
  }

  /** The value stored for the key at a position, or undefined before any keymap arrived. */
  codeAt(position: number): number | undefined {
    if (!this.keymap) return undefined;
    return new DataView(this.keymap.buffer).getUint32(position * 4);
  }
}

export function createVirtualRoyalKludgeTransport(
  definition: KeyboardDefinition,
  keyboard = new VirtualRoyalKludge(),
): Transport {
  return {
    info: {
      name: definition.name,
      vendorId: definition.vendorId,
      productId: definition.productId,
      virtual: true,
    },
    // Unused: this firmware is spoken to with feature reports only, and never answers.
    send: async () => undefined,
    onReport: () => () => undefined,
    onDisconnect: () => () => undefined,
    close: async () => undefined,

    async sendFeature(report, reportId = 0) {
      keyboard.receive(reportId, report);
    },
  };
}
