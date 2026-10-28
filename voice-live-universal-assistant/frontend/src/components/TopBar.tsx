import React from 'react';
import { Button, Text } from '@fluentui/react-components';
import { ChatAddRegular } from '@fluentui/react-icons';

interface TopBarProps {
  agentName: string;
  onNewThread: () => void;
  showControls: boolean;
  isSessionActive?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  agentName,
  onNewThread,
  showControls,
  isSessionActive = false,
}) => (
  <div style={barStyle}>
    <div style={leftSectionStyle}>
      <Text as="h1" weight="semibold" size={300} style={agentNameStyle}>
        {agentName || 'AI Troubleshooting Demo'}
      </Text>
    </div>
    {showControls && (
      <div style={rightStyle}>
        <Button
          appearance="subtle"
          icon={<ChatAddRegular />}
          onClick={onNewThread}
          disabled={isSessionActive}
        >
          New chat
        </Button>
      </div>
    )}
  </div>
);

const barStyle: React.CSSProperties = {
  display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'space-between',
  boxSizing: 'border-box', width: '100%', maxWidth: '100%', padding: '12px 16px',
};
const leftSectionStyle: React.CSSProperties = {
  overflow: 'hidden', display: 'flex', flex: 1, gap: '12px', alignItems: 'center', minWidth: 0,
};
const agentNameStyle: React.CSSProperties = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
};
const rightStyle: React.CSSProperties = {
  display: 'flex', flexShrink: 0, alignItems: 'center', gap: '8px',
};
