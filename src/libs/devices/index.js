import { fiioJa11 } from "./fiioJa11";
import { fiioBTR17 } from "./fiioBTR17";

export const SUPPORTED_DEVICES = [fiioJa11, fiioBTR17];

export function findDriverForDevice(device) {
  const strict = SUPPORTED_DEVICES.find((d) => d.supports(device));
  if (strict) return strict;

  // The remote device_list only provides vendorId/productId/productName.
  // Fall back to a product-name match in case the reported VID/PID differs
  // slightly from the expected values.
  const name = String(device.productName || "").toLowerCase();
  return (
    SUPPORTED_DEVICES.find((d) => {
      const target = d.name.toLowerCase();
      return name && (name.includes(target) || target.includes(name));
    }) || null
  );
}

export function getSupportedDeviceFilters() {
  // navigator.hid.requestDevice needs a flat list of filters
  return SUPPORTED_DEVICES.flatMap((d) => d.filters || []);
}
