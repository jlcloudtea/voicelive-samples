import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 24000;

function chooseRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaybackMuted, setIsPlaybackMuted] = useState(true);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingMimeType, setRecordingMimeType] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isMutedRef = useRef(true);

  const resetRecording = useCallback(() => {
    setRecordingBlob(null);
    setRecordingMimeType('');
    recordedChunksRef.current = [];
  }, []);

  const initPlayback = useCallback(async () => {
    if (audioContextRef.current) return;
    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = audioContext;
    await audioContext.audioWorklet.addModule('/audio-playback-worklet.js');
    const workletNode = new AudioWorkletNode(audioContext, 'audio-playback-processor');
    workletNodeRef.current = workletNode;
    const gainNode = audioContext.createGain();
    gainNodeRef.current = gainNode;
    gainNode.gain.value = 1;
    const recordingDestination = audioContext.createMediaStreamDestination();
    recordingDestinationRef.current = recordingDestination;
    workletNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.connect(recordingDestination);
  }, []);

  const attachMicrophoneStream = useCallback(async (stream: MediaStream) => {
    await initPlayback();
    const audioContext = audioContextRef.current!;
    const recordingDestination = recordingDestinationRef.current!;
    microphoneSourceRef.current?.disconnect();
    const microphoneSource = audioContext.createMediaStreamSource(stream);
    microphoneSourceRef.current = microphoneSource;
    // Connect microphone only to the recording mix, never to speakers.
    microphoneSource.connect(recordingDestination);

    if (typeof MediaRecorder !== 'undefined' && recorderRef.current?.state !== 'recording') {
      resetRecording();
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(recordingDestination.stream, { mimeType })
        : new MediaRecorder(recordingDestination.stream);
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
  }, [initPlayback, resetRecording]);

  const togglePlaybackMute = useCallback(() => {
    setIsPlaybackMuted((previous) => {
      const next = !previous;
      isMutedRef.current = next;
      return next;
    });
  }, []);

  const resetPlaybackMute = useCallback(() => {
    setIsPlaybackMuted(true);
    isMutedRef.current = true;
  }, []);

  const playAudio = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current || !workletNodeRef.current) await initPlayback();
    if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16Data = new Int16Array(bytes.buffer);
    // This single worklet feeds both speakers and the recording destination.
    workletNodeRef.current!.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    setIsPlaying(true);
  }, [initPlayback]);

  const stopPlayback = useCallback(() => {
    workletNodeRef.current?.port.postMessage(null);
    setIsPlaying(false);
  }, []);

  const cleanupPlayback = useCallback(() => {
    stopPlayback();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    microphoneSourceRef.current?.disconnect();
    microphoneSourceRef.current = null;
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;
    recordingDestinationRef.current?.disconnect();
    recordingDestinationRef.current = null;
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    audioContextRef.current = null;
  }, [stopPlayback]);

  return {
    playAudio, stopPlayback, isPlaying, initPlayback, cleanupPlayback,
    isPlaybackMuted, isMutedRef, togglePlaybackMute, resetPlaybackMute,
    attachMicrophoneStream, recordingBlob, recordingMimeType, resetRecording,
  };
}
