import type { KeyboardDefinition } from '../core/definition';
import type { Transport } from '../drivers/types';
import { defaultCode, YICHIP_KEY_COUNT, YICHIP_REPORT_SIZE, YiChipCommand } from '../drivers/yichip';

/**
 * A YiChip keyboard that exists only in memory. It answers the way the real Akko
 * 5075B Plus was seen to: queries are answered on the next read, and a write leaves
 * the previous answer in place because the firmware sends none.
 */
export function createVirtualYiChipTransport(definition: KeyboardDefinition): Transport {
  const keymap = new Uint8Array(YICHIP_KEY_COUNT * 4);
  const stored = new DataView(keymap.buffer);
  (definition.defaultKeymap ?? []).forEach((value, position) => {
    stored.setUint32(position * 4, defaultCode(value));
  });
  let reply = new Uint8Array(YICHIP_REPORT_SIZE);

  return {
    info: {
      name: definition.name,
      vendorId: definition.vendorId,
      productId: definition.productId,
      virtual: true,
    },
    // Unused: this firmware is spoken to with feature reports only.
    send: async () => undefined,
    onReport: () => () => undefined,
    onDisconnect: () => () => undefined,
    close: async () => undefined,

    async sendFeature(report) {
      const sum = report.subarray(0, 7).reduce((total, byte) => total + byte, 0);
      if (report[7] !== 255 - (sum & 0xff)) return; // The firmware ignores a bad checksum.

      const answer = new Uint8Array(YICHIP_REPORT_SIZE);
      switch (report[0]) {
        case YiChipCommand.GetInfo:
          answer[0] = YiChipCommand.GetInfo;
          new DataView(answer.buffer).setUint32(1, definition.deviceId ?? 0, true);
          break;
        case YiChipCommand.GetProfile:
          answer[0] = YiChipCommand.GetProfile;
          break;
        case YiChipCommand.GetKeymap:
          answer.set(keymap.subarray(report[2] * 64, report[2] * 64 + 64));
          break;
        case YiChipCommand.SetKey:
          keymap.set(report.subarray(8, 12), report[2] * 4);
          return;
        default:
          return;
      }
      reply = answer;
    },
    async receiveFeature() {
      return reply.slice();
    },
  };
}
