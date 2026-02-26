# Implementation Plan

- [x] 1. Remove tab navigation and render task list directly

  - [x] 1.1 Update `TasksPage.tsx` to remove List/Focus tab state and tab buttons
    - Remove `Tab` type, `tab` state, and tab button rendering
    - Remove the tab underline animation
    - Render the grouped task list directly (no conditional on `tab`)
    - Remove `FocusTabView` usage and import
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Delete `FocusTabView` component
    - Delete `src/components/FocusTabView.tsx`
    - Delete `src/components/__tests__/FocusTabView.test.tsx`
    - Remove all imports and references
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Write unit tests for tab removal
    - Verify Tasks page renders grouped list without tab buttons
    - _Requirements: 1.1, 1.2_

- [x] 2. Convert Task Detail Modal to full-screen animated sheet

  - [x] 2.1 Refactor `TaskDetailModal` into a full-screen slide-up sheet
    - Replace centered modal layout with full-screen overlay
    - Add framer-motion slide-up animation (`translateY(100%) → translateY(0)`, ~300ms)
    - Add slide-down animation on dismiss
    - Add close button (X) at top
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 Write property test for Detail Sheet required elements (Property 5)
    - **Property 5: Detail Sheet contains all required elements**
    - **Validates: Requirements 2.4**

- [x] 3. Simplify Compact Task Card (remove checkbox, add info icon)





  - [x] 3.1 Update `CompactTaskCard` to remove checkbox and add settings icon


    - Remove checkbox from the card
    - Add a settings (info) icon button on the right side
    - Keep emoji and task name display
    - Split click handlers: card area → `onCardClick`, info icon → `onSettingsClick`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Write property test for Compact Task Card elements (Property 4)


    - **Property 4: Compact Task Card contains correct elements and no checkbox**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Repurpose TaskDetailModal as Task Settings Sheet





  - [x] 4.1 Refactor `TaskDetailModal` into Task Settings Sheet


    - Remove name/emoji editing, subtask list, and Start Focus button
    - Add reminder toggle with date/time picker (when enabled)
    - Add repeat option selector (None/Daily/Weekly/Custom)
    - Keep delete task button
    - Display task name as read-only label at top
    - _Requirements: 3.3, 3.5, 3.6_

  - [x] 4.2 Add `reminderAt` and `repeatSchedule` fields to BigTask


    - Update `BigTask` type in `src/types/index.ts`
    - Update task service to handle new fields
    - Add database migration for new columns (if using Supabase)
    - _Requirements: 3.5, 3.6_

  - [x] 4.3 Write property test for Task Settings Sheet elements (Property 5)


    - **Property 5: Task Settings Sheet contains required settings**
    - **Validates: Requirements 3.3**

- [x] 5. Update task card click handlers and remove QuickCompleteModal





  - [x] 5.1 Update `TasksPage.tsx` card click handlers


    - Tap card area → open Focus View (`setFocusedTask(task)`)
    - Tap info icon → open Task Settings Sheet (`setDetailModalTask(task)`)
    - Remove `QuickCompleteModal` usage and state
    - Remove `handleCheckboxClick` and `handleQuickCompleteConfirm`
    - _Requirements: 2.3, 2.4, 4.1, 4.2_

  - [x] 5.2 Update `TaskGroupSection` to pass new card click handlers


    - Replace `onCheckboxClick` with `onSettingsClick`
    - Ensure `onCardClick` triggers Focus View
    - _Requirements: 2.3, 2.4_

- [x] 6. Checkpoint - Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update Focus View for read-only done tasks


  - [x] 7.1 Update `FocusView` to support read-only mode for completed tasks


    - When `task.completed` is true: display name and emoji as read-only, hide timer controls entirely, make subtask checkboxes non-interactive
    - When `task.completed` is false: keep editable name/emoji, timer controls, and interactive subtask checkboxes (current behavior)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Write property test for Focus View non-completed task (Property 6)





    - **Property 6: Focus View for non-completed task has editable fields and all elements**
    - **Validates: Requirements 4.1, 4.3, 7.1**

  - [x] 7.3 Write property test for Focus View completed task (Property 7)




    - **Property 7: Focus View for completed task is fully read-only with timer disabled**
    - **Validates: Requirements 4.2, 4.4**

- [x] 8. Create Now-Active Bar component and integrate into Tasks page





  - [x] 8.1 Create `NowActiveBar` component (`src/components/NowActiveBar.tsx`)


    - Fixed position bar above bottom navigation
    - Display: task emoji, task name (truncated), remaining time, play/pause icon
    - Tap anywhere opens Focus View (calls `onClick`)
    - Styled to match app theme (glassmorphism, neon accents)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Integrate `NowActiveBar` into `TasksPage.tsx`


    - Render bar conditionally when `timer.isRunning || timer.isPaused`
    - Pass active timer task, remaining seconds, and click handler
    - Position above `BottomNavBar`
    - Add bottom padding to task list to account for bar height
    - Hide bar when no timer is active
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 8.3 Write property test for Now-Active Bar visibility (Property 1)


    - **Property 1: Now-Active Bar visibility is equivalent to timer active state**
    - **Validates: Requirements 5.1, 5.4**

  - [x] 8.4 Write property test for Now-Active Bar content (Property 2)


    - **Property 2: Now-Active Bar displays correct task information**
    - **Validates: Requirements 5.2**

- [ ] 9. Implement auto-swap timer behavior
  - [ ] 9.1 Update `TasksPage.tsx` to auto-swap timers
    - When Focus View is opened on a new task while a timer is active, stop the existing timer first
    - Update `focusedTask` and `activeTimerTask` to the new task
    - Show toast notification "Switched focus to [task name]"
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 9.2 Write property test for auto-swap single timer (Property 3)
    - **Property 3: Auto-swap enforces single active timer**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 10. Clean up and verify Focus View preservation
  - [ ] 10.1 Verify Focus View still works correctly for active tasks
    - Test timer controls (start, pause, resume, reset)
    - Test subtask checkbox toggling
    - Test completion flow
    - Test back button returns to task list
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 10.2 Remove unused code
    - Remove `QuickCompleteModal` component if no longer used
    - Clean up dead imports across all modified files
    - _Requirements: 2.2_

- [ ] 11. Final checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
