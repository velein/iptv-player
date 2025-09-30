# Design Document

## Overview

The channel list redesign introduces a three-column hierarchical navigation interface that allows users to browse channels by groups, select individual channels, and view EPG programs. This design improves content discovery and provides a more organized way to navigate the IPTV content.

## Architecture

### Component Structure

```
ChannelBrowser (New Component)
├── ChannelGroupList (Column 1)
├── ChannelList (Column 2) 
└── ChannelEpgList (Column 3)
```

### Data Flow

1. **Channel Groups**: Extracted from playlist channels based on `group` property
2. **Channel Selection**: Filters channels by selected group
3. **EPG Data**: Fetched for selected channel using existing EPG hooks
4. **Navigation**: Uses existing router navigation to player

## Components and Interfaces

### ChannelBrowser Component

**Purpose**: Main container component that manages the three-column layout and state

**Props**:
```typescript
interface ChannelBrowserProps {
  onChannelSelect?: (channelId: string) => void;
  onProgramSelect?: (program: EpgProgram, channelId: string) => void;
}
```

**State**:
```typescript
interface ChannelBrowserState {
  selectedGroup: string | null;
  selectedChannel: string | null;
  groups: ChannelGroup[];
}
```

### ChannelGroupList Component

**Purpose**: Displays available channel groups in the first column

**Props**:
```typescript
interface ChannelGroupListProps {
  groups: ChannelGroup[];
  selectedGroup: string | null;
  onGroupSelect: (groupName: string) => void;
}
```

**Features**:
- Lists all unique channel groups
- Highlights selected group
- Shows channel count per group
- Handles empty state

### ChannelList Component

**Purpose**: Displays channels for the selected group in the second column

**Props**:
```typescript
interface ChannelListProps {
  channels: Channel[];
  selectedChannel: string | null;
  onChannelSelect: (channelId: string) => void;
  groupName: string | null;
}
```

**Features**:
- Lists channels in selected group
- Shows channel logos if available
- Highlights selected channel
- Handles empty/no group selected state

### ChannelEpgList Component

**Purpose**: Displays EPG programs for the selected channel in the third column

**Props**:
```typescript
interface ChannelEpgListProps {
  channelId: string | null;
  onProgramSelect: (program: EpgProgram, channelId: string) => void;
}
```

**Features**:
- Shows current and upcoming programs
- Indicates live/upcoming/ended status
- Handles no EPG data state
- Scrollable program list

## Data Models

### ChannelGroup Interface

```typescript
interface ChannelGroup {
  name: string;
  channelCount: number;
  channels: Channel[];
}
```

### Enhanced Channel Display

```typescript
interface ChannelDisplay extends Channel {
  isSelected: boolean;
  programCount?: number;
}
```

### Program Display

```typescript
interface ProgramDisplay extends EpgProgram {
  status: 'live' | 'upcoming' | 'ended';
  isClickable: boolean;
}
```

## Error Handling

### No Groups Available
- Display message: "No channel groups found"
- Provide option to view all channels

### No Channels in Group
- Display message: "No channels found in this group"
- Allow user to select different group

### No EPG Data
- Display message: "No program guide available for this channel"
- Show channel info instead

### Loading States
- Show skeleton loaders for each column
- Progressive loading (groups → channels → EPG)

## Testing Strategy

### Unit Tests
- Test group extraction logic
- Test channel filtering by group
- Test EPG data fetching
- Test navigation handlers

### Integration Tests
- Test full user flow: group → channel → program → player
- Test state management across components
- Test error handling scenarios

### User Experience Tests
- Test responsive layout behavior
- Test keyboard navigation
- Test accessibility features
- Test performance with large channel lists

## Implementation Notes

### Performance Considerations
- Virtualize long lists if needed
- Memoize group calculations
- Debounce EPG data fetching
- Cache EPG data per channel

### Accessibility
- Proper ARIA labels for navigation
- Keyboard navigation support
- Screen reader friendly
- Focus management

### Responsive Design
- Mobile: Stack columns vertically
- Tablet: Two-column layout with modal for third
- Desktop: Full three-column layout

### Integration Points
- Reuse existing `usePlaylist` hook
- Reuse existing `useEpg` hook
- Integrate with existing router navigation
- Maintain existing player functionality