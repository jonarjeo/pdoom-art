# Pocket TTS (browser WASM)

This directory vendors the browser WebAssembly runtime used by the
[LaurentMazare / xn Pocket TTS demo](https://laurentmazare.github.io/pocket-tts/)
(`ptts_wasm.js`, `ptts_wasm_bg.wasm`), which implements Kyutai
[Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for the web.

- Runtime: Apache-2.0 / MIT (xn-ptts / wasm-bindgen glue)
- Model weights: loaded at runtime from Hugging Face
  (`kyutai/pocket-tts-without-voice-cloning`, q8 quant from
  `lmz/pocket-tts-without-voice-cloning-q8`) — CC-BY-4.0
- Built-in voices (alba, marius, …): Kyutai voice embeddings, see
  https://huggingface.co/kyutai/tts-voices for per-voice licenses

Official Kyutai docs list this as a community in-browser implementation
(no first-party WASM package yet): https://kyutai-labs.github.io/pocket-tts/
