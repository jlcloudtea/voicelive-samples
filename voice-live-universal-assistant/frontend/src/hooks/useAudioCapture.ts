import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4800;

interface UseAudioCaptureOptions {
  onAudioChunk: (base64Data: string) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export function useAudioCapture({ onAudioChunk, onStreamReady }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Int16Array>(new Int16Array(0));
  const isMutedRef = useRef(false);

  const flushBuffer = useCallback((buffer: Int16Array) => {
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    onAudioChunk(btoa(binary));
  }, [onAudioChunk]);

  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    onStreamReady?.(stream);

    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = audioContext;
    await audioContext.audioWorklet.addModule('/audio-capture-worklet.js');
    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
    workletNodeRef.current = workletNode;
    bufferRef.current = new Int16Array(0);
    workletNode.port.onmessage = (event: MessageEvent) => {
      if (isMutedRef.current) return;
      const incoming = new Int16Array(event.data.buffer);
      const previous = bufferRef.current;
      const merged = new Int16Array(previous.length + incoming.length);
      merged.set(previous); merged.set(incoming, previous.length);
      let offset = 0;
      const samplesPerChunk = BUFFER_SIZE / 2;
      while (offset + samplesPerChunk <= merged.length) {
        flushBuffer(merged.slice(offset, offset + samplesPerChunk));
        offset += samplesPerChunk;
      }
      bufferRef.current = merged.slice(offset);
    };
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
    setIsCapturing(true);
  }, [flushBuffer, onStreamReady]);

  const stopCapture = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    audioContextRef.current = null;
    bufferRef.current = new Int16Array(0);
    setIsCapturing(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => {
      isMutedRef.current = !previous;
      return !previous;
    });
  }, []);

  return { startCapture, stopCapture, isCapturing, isMuted, toggleMute };
}
