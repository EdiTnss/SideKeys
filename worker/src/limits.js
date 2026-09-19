// The proxy's size limit, in its own module: the entry module (index.js) may only export
// functions and handlers, or workerd refuses to start. src/ai/pipeline.js sizes its parts to fit
// under it, and test/pipeline.test.js checks every request of a long piece against it.
export const MAX_BODY_BYTES = 64 * 1024;
