# Design Document

## Overview

This design enhances the EPG settings interface by implementing proper state management, visual feedback, and user experience improvements. The solution introduces a new EPG state management system that tracks loading, parsing, and error states while providing clear visual indicators and appropriate button states throughout the EPG lifecycle.

## Architecture

### State Management Architecture

The enhancement introduces a centralized EPG state management system that coordinates between:

1. **EPG URL Management**: Separate save/load cycle for EPG URLs
2. **EPG Loading States**: Track loading, parsing, and completion states
3. **UI State Coordination**: Synchronize button states, visibility, and loading indicators
4. **Cache Management**: Handle EPG cache operations and reset functionality

### Component Structure

```
Settings Component
├── EPG Configuration Section
│   ├── EPG URL Input Field
│   ├── Save EPG Button (conditional)
│   └── Loading Indicator (conditional)
├── EPG Management Section (conditional)
│   ├── Cache Status Display
│   ├── Reload EPG Button (conditional)
│   └── Loading States Display
└── Reset Everything Button
```

## Components and Interfaces

### Enhanced Settings Component

The Settings component will be restructured to support the new EPG workflow:

**New State Variables:**
- `epgUrl`: Current EPG URL input value (separate from saved settings)
- `savedEpgUrl`: Currently saved EPG URL from localStorage
- `epgLoadingState`: Tracks EPG loading phases ('idle' | 'loading' | 'parsing' | 'complete' | 'error')
- `isFirstTimeLoad`: Boolean to track if this is the first EPG save

**Key Methods:**
- `handleEpgUrlChange()`: Updates input field without saving
- `handleSaveEpg()`: Saves EPG URL and initiates loading
- `handleResetEverything()`: Clears all application data
- `getEpgButtonState()`: Determines save button enabled/disabled state

### Enhanced useEpg Hook

The useEpg hook will be extended to provide loading state information:

**New Return Values:**
- `epgLoadingState`: Current loading phase
- `isFirstTimeSetup`: Boolean indicating if no EPG has been configured
- `loadEpgWithProgress()`: Method that provides loading progress callbacks

**Loading State Flow:**
1. `idle`: No EPG operation in progress
2. `loading`: Fetching EPG data from URL
3. `parsing`: Processing and parsing EPG XML data
4. `complete`: EPG successfully loaded and parsed
5. `error`: EPG loading or parsing failed

### New EPG State Management Hook

A new `useEpgState` hook will manage the enhanced EPG state:

```typescript
interface EpgState {
  loadingState: 'idle' | 'loading' | 'parsing' | 'complete' | 'error';
  error: string | null;
  isFirstTimeSetup: boolean;
  hasValidEpgUrl: boolean;
}

function useEpgState() {
  // State management logic
  return {
    epgState,
    setLoadingState,
    setError,
    clearError,
    checkFirstTimeSetup
  };
}
```

## Data Models

### EPG Loading State Model

```typescript
type EpgLoadingState = 'idle' | 'loading' | 'parsing' | 'complete' | 'error';

interface EpgStateInfo {
  state: EpgLoadingState;
  progress?: number; // 0-100 for loading progress
  message?: string; // User-friendly status message
  error?: string; // Error message if state is 'error'
}
```

### Settings State Model

```typescript
interface SettingsState extends AppSettings {
  // Existing settings
  epgUrl: string;
  epgRefreshInterval: number;
  epgCacheEnabled: boolean;
  
  // New state tracking
  unsavedEpgUrl: string; // Current input value
  epgLoadingState: EpgLoadingState;
  isFirstTimeEpgSetup: boolean;
}
```

## User Interface Design

### EPG Configuration Section

**EPG URL Input with Save Button:**
- Input field for EPG URL (existing)
- "Save EPG" button positioned inline next to input
- Button states:
  - Disabled: When input is empty or unchanged from saved value
  - Enabled: When input contains new/modified URL
  - Loading: When EPG save/load is in progress

**Loading Indicator:**
- Appears below input when EPG is being processed
- Shows current phase: "Loading EPG..." or "Parsing EPG..."
- Progress spinner or progress bar
- Replaces or appears alongside existing help text

### EPG Management Section

**Conditional Visibility:**
- Hidden when no EPG URL has been saved
- Visible when EPG URL exists in settings
- Contains existing cache status and reload functionality

**Enhanced Reload Button:**
- Only visible when EPG is successfully loaded
- Disabled during any EPG operation
- Shows loading state when reload is in progress

### Reset Everything Button

**Placement and Styling:**
- Positioned at bottom of settings dialog
- Styled as a destructive action (red/warning colors)
- Confirmation dialog before execution
- Disabled during EPG operations

## Error Handling

### EPG Loading Errors

**Error Display:**
- Show error messages in EPG configuration section
- Replace loading indicator with error message
- Provide retry option for failed loads
- Clear errors when new EPG URL is entered

**Error Recovery:**
- Allow immediate retry after error
- Preserve EPG URL input on error
- Reset loading state to allow new attempts
- Maintain previous EPG data if available

### Validation Errors

**URL Validation:**
- Basic URL format validation
- Show validation errors inline
- Prevent save of invalid URLs
- Clear validation errors on input change

## Testing Strategy

### Unit Tests

**Settings Component Tests:**
- Button state management (enabled/disabled)
- EPG URL input handling
- Loading state display
- Error state handling
- Reset functionality

**useEpgState Hook Tests:**
- State transitions
- Loading progress tracking
- Error handling
- First-time setup detection

### Integration Tests

**EPG Loading Flow:**
- Complete EPG save and load cycle
- Loading state progression
- Error handling and recovery
- Cache management integration

**Settings Persistence:**
- EPG URL save/load
- Settings reset functionality
- State restoration on component mount

### User Experience Tests

**Loading States:**
- Verify loading indicators appear correctly
- Test button states during operations
- Confirm proper error messaging
- Validate reset functionality

**Conditional Visibility:**
- EPG management section visibility
- Reload button appearance conditions
- Loading indicator timing

## Implementation Phases

### Phase 1: State Management Enhancement
- Implement useEpgState hook
- Add loading state tracking to useEpg
- Update Settings component state structure

### Phase 2: UI Component Updates
- Add Save EPG button with proper states
- Implement loading indicators
- Update EPG management section visibility

### Phase 3: Reset Functionality
- Implement reset everything feature
- Add confirmation dialog
- Integrate with existing cache clearing

### Phase 4: Error Handling and Polish
- Add comprehensive error handling
- Implement retry mechanisms
- Add loading progress indicators
- Final UI polish and testing