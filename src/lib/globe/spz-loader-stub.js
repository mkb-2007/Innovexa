/**
 * Safe stub for @spz-loader/core (JavaScript version).
 */

export async function loadSpz(_buffer, _options) {
  throw new Error("[spz-loader-stub] Gaussian Splatting (.spz) loading is not supported in this bundle.");
}

export async function loadSpzFromUrl(_url, _options) {
  throw new Error("[spz-loader-stub] Gaussian Splatting (.spz) loading is not supported in this bundle.");
}

const spzStub = {
  loadSpz,
  loadSpzFromUrl,
};

export default spzStub;
