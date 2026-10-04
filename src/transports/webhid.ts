import type { Transport } from '../drivers/types';

/** WebHID exists in Chromium browsers (Chrome, Edge, Opera, Brave) on a secure origin. */
export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

/** Opens the browser's device picker. Resolves to null when the user cancels. */
export async function pickHidDevice(filters: HIDDeviceFilter[]): Promise<HIDDevice | null> {
  const devices = await navigator.hid.requestDevice({ filters });
  // One keyboard shows up as several HID interfaces; take the one the filters asked for.
  const matches = (device: HIDDevice) =>
    device.collections.some((collection) =>
      filters.some(
        (filter) =>
          (filter.usagePage === undefined || filter.usagePage === collection.usagePage) &&
          (filter.usage === undefined || filter.usage === collection.usage),
      ),
    );
  return devices.find(matches) ?? devices[0] ?? null;
}

export async function openHidTransport(device: HIDDevice): Promise<Transport> {
  if (!device.opened) await device.open();

  return {
    info: {
      name: device.productName || 'Unknown keyboard',
      vendorId: device.vendorId,
      productId: device.productId,
      virtual: false,
    },
    async send(report) {
      // Copying gives WebHID a plain ArrayBuffer-backed view.
      await device.sendReport(0, new Uint8Array(report));
    },
    onReport(listener) {
      const handler = (event: HIDInputReportEvent) => {
        const { buffer, byteOffset, byteLength } = event.data;
        listener(new Uint8Array(buffer, byteOffset, byteLength));
      };
      device.addEventListener('inputreport', handler);
      return () => device.removeEventListener('inputreport', handler);
    },
    onDisconnect(listener) {
      const handler = (event: HIDConnectionEvent) => {
        if (event.device === device) listener();
      };
      navigator.hid.addEventListener('disconnect', handler);
      return () => navigator.hid.removeEventListener('disconnect', handler);
    },
    async close() {
      if (device.opened) await device.close();
    },
    async sendFeature(report) {
      await device.sendFeatureReport(0, new Uint8Array(report));
    },
    async receiveFeature() {
      const { buffer, byteOffset, byteLength } = await device.receiveFeatureReport(0);
      const bytes = new Uint8Array(buffer, byteOffset, byteLength);
      // Some platforms put the report id in front of the 64 data bytes.
      return bytes.length === 65 ? bytes.subarray(1) : bytes;
    },
  };
}
