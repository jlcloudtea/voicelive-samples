import React from 'react';
import { Button, Text } from '@fluentui/react-components';
import { ArrowDownloadRegular, ChatAddRegular } from '@fluentui/react-icons';
import type { TranscriptEntry } from '../types';

interface SessionEndedViewProps {
  sessionId: string;
  transcripts: TranscriptEntry[];
  onNewThread: () => void;
  recordingBlob: Blob | null;
  recordingMimeType: string;
  durationMs: number;
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const SessionEndedView: React.FC<SessionEndedViewProps> = ({ transcripts, onNewThread, recordingBlob, recordingMimeType, durationMs }) => {
  const finals = transcripts.filter((entry) => entry.isFinal && entry.text.trim());
  const downloadTranscript = () => {
    const content = ['AI Troubleshooting Demo', `Session ended: ${new Date().toLocaleString()}`, `Duration: ${Math.floor(durationMs/60000)}:${String(Math.floor(durationMs/1000)%60).padStart(2,'0')}`, '', ...finals.flatMap((e) => [e.role === 'user' ? 'STUDENT' : 'ASSISTANT', e.text, ''])].join('\n');
    downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `troubleshooting-transcript-${stamp()}.txt`);
  };
  const audioExtension = recordingMimeType.includes('mp4') ? 'm4a' : 'webm';
  return <div className="sessionCompleteCard">
    <span className="completionEyebrow">SESSION COMPLETE</span>
    <h2>Your practice files are ready</h2>
    <p>The transcript and audio include both the student and the assistant. The recording is created locally in this browser.</p>
    <div className="downloadActions">
      <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={downloadTranscript} disabled={!finals.length}>Download transcript (.txt)</Button>
      <Button icon={<ArrowDownloadRegular />} onClick={() => recordingBlob && downloadBlob(recordingBlob, `troubleshooting-audio-${stamp()}.${audioExtension}`)} disabled={!recordingBlob}>Download audio (.{audioExtension})</Button>
      <Button appearance="subtle" icon={<ChatAddRegular />} onClick={onNewThread}>New chat</Button>
    </div>
    <div className="endedTranscript">{finals.map((e,i)=><div key={i} className={`endedEntry ${e.role}`}><Text size={200} weight="semibold">{e.role==='user'?'Student':'Assistant'}</Text><Text size={300}>{e.text}</Text></div>)}</div>
    <p className="localDataNotice">Local session data is cleared when you select New chat or close the page.</p>
  </div>;
};
