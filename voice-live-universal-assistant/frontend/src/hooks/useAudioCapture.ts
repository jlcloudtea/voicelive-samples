import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4800;

interface UseAudioCaptureOptions {
  onAudioChunk: (base64Data: string) => void;
}

function chooseRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useAudioCapture({ onAudioChunk }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Int16Array>(new Int16Array(0));
  const isMutedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const flushBuffer = useCallback((buffer: Int16Array) => {
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    onAudioChunk(btoa(binary));
  }, [onAudioChunk]);

  const resetRecording = useCallback(() => {
    setRecordingBlob(null);
    setRecordingMimeType('');
    recordedChunksRef.current = [];
  }, []);

  const startCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    resetRecording();

    if (typeof MediaRecorder !== 'undefined') {
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        if (recordedChunksRef.current.length) {
          setRecordingBlob(new Blob(recordedChunksRef.current, { type: actualType }));
          setRecordingMimeType(actualType);
        }
      };
      recorder.start(1000);
    }

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
      const prev = bufferRef.current;
      const merged = new Int16Array(prev.length + incoming.length);
      merged.set(prev); merged.set(incoming, prev.length);
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
  }, [flushBuffer, resetRecording]);

  const stopCapture = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
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
    setIsMuted((prev) => {
      isMutedRef.current = !prev;
      return !prev;
    });
  }, []);

  return {
    startCapture, stopCapture, isCapturing, isMuted, toggleMute,
    recordingBlob, recordingMimeType, resetRecording,
  };
}
