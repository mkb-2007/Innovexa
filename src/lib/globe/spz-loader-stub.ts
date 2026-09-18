/**
 * Safe stub for @spz-loader/core.
 *
 * The upstream @spz-loader/core package embeds raw WASM binary data inside an
 * untagged template string containing octal escape sequences (\0\0...).
 * In Next.js production builds, minification turns this into invalid JavaScript:
 * "Uncaught SyntaxError: Octal escape sequences are not allowed in template strings",
 * which halts bundle parsing before Cesium can initialize.
 *
 * Since the ocean globe and ARGO floats do not use Gaussian Splatting (.spz models),
 * stubbing this unused loader eliminates the production crash completely.
 */

export async function loadSpz(_buffer: unknown, _options?: unknown): Promise<never> {
  throw new Error("[spz-loader-stub] Gaussian Splatting (.spz) loading is not supported in this bundle.");
}

export async function loadSpzFromUrl(_url: string, _options?: unknown): Promise<never> {
  throw new Error("[spz-loader-stub] Gaussian Splatting (.spz) loading is not supported in this bundle.");
}

const spzStub = {
  loadSpz,
  loadSpzFromUrl,
};

export default spzStub;
