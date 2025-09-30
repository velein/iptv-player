# Implementation Plan

- [x] 1. Create EPG state management hook
  - Implement useEpgState hook with loading state tracking ('idle' | 'loading' | 'parsing' | 'complete' | 'error')
  - Add methods for state transitions and error handling
  - Include first-time setup detection logic
  - Write unit tests for state transitions and error scenarios
  - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.3_

- [x] 2. Enhance useEpg hook with loading progress
  - Add epgLoadingState return value to useEpg hook
  - Implement loadEpgWithProgress method that provides loading state callbacks
  - Update existing loadEpg method to emit loading and parsing states
  - Add isFirstTimeSetup boolean return value
  - Write unit tests for enhanced EPG loading with state tracking
  - _Requirements: 3.1, 3.2, 3.3, 5.1_

- [x] 3. Update Settings component state structure
  - Add unsavedEpgUrl state variable separate from saved settings
  - Add epgLoadingState tracking to Settings component
  - Add isFirstTimeEpgSetup boolean state
  - Implement getEpgButtonState method to determine save button enabled/disabled state
  - Write unit tests for Settings component state management
  - _Requirements: 1.2, 1.3, 3.3, 5.3_

- [x] 4. Implement Save EPG button with proper states
  - Add "Save EPG" button positioned inline next to EPG URL input field
  - Implement button enabled/disabled logic based on input changes and loading state
  - Add handleSaveEpg method that saves URL and initiates EPG loading
  - Update handleEpgUrlChange to only update input without saving
  - Write unit tests for Save EPG button state management and click handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Add loading indicators and progress feedback
  - Implement loading indicator component that shows "Loading EPG..." and "Parsing EPG..." messages
  - Add loading indicator below EPG input field during EPG operations
  - Disable EPG input field and save button during loading/parsing
  - Update loading indicator based on epgLoadingState from useEpgState hook
  - Write unit tests for loading indicator display and state synchronization
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. Implement conditional EPG management section visibility
  - Add logic to hide EPG management section when no EPG URL is saved
  - Show EPG management section only when savedEpgUrl exists in settings
  - Update existing cache status and reload functionality to respect visibility rules
  - Write unit tests for EPG management section conditional rendering
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Update Reload EPG button visibility and states
  - Modify existing "Reload EPG" button to only appear when EPG is successfully loaded
  - Disable reload button during any EPG loading operations
  - Update canReload logic in useEpg to consider loading states
  - Add loading state display for reload operations
  - Write unit tests for reload button visibility and state management
  - _Requirements: 3.4, 3.5_

- [x] 8. Implement Reset Everything functionality
  - Add "Reset Everything" button at bottom of settings dialog with destructive styling
  - Implement handleResetEverything method that clears M3U playlist data from localStorage
  - Add EPG cache clearing using existing clearParsedEpgCache utility
  - Reset EPG URL to empty string and clear all EPG-related state
  - Add confirmation dialog before executing reset operation
  - Write unit tests for reset functionality and state clearing
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 9. Add comprehensive error handling and recovery
  - Implement error display in EPG configuration section
  - Add retry functionality for failed EPG loads
  - Clear errors when new EPG URL is entered or save is attempted
  - Preserve EPG URL input value on error scenarios
  - Add URL validation with inline error messages
  - Write unit tests for error handling, recovery, and validation
  - _Requirements: 5.2, 5.4_

- [x] 10. Integrate and test complete EPG settings workflow
  - Test complete EPG save and load cycle with all new components
  - Verify loading state progression from save through parsing to completion
  - Test error scenarios and recovery mechanisms
  - Validate reset functionality clears all application state correctly
  - Test conditional visibility and button states across all scenarios
  - Write integration tests for complete EPG settings workflow
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4_