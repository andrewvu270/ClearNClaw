# Implementation Plan

- [x] 1. Create task grouping utility and compact card component




  - [x] 1.1 Create task grouping utility function (`src/utils/taskGrouping.ts`)


    - Implement `groupTasks(tasks: BigTask[])` returning `{ planned, active, done }`
    - Planned: 0 subtasks complete
    - Active: some but not all subtasks complete
    - Done: all subtasks complete or task.completed = true
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Write property test for task grouping correctness (Property 1)


    - **Property 1: Task grouping correctness**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**

  - [x] 1.3 Create `CompactTaskCard` component (`src/components/CompactTaskCard.tsx`)


    - Single-line layout: emoji, name, progress (X/Y), coins, checkbox
    - Same height and styling as `SubTaskItem` (60-80px)
    - Click card → calls `onCardClick`
    - Click checkbox → calls `onCheckboxClick`
    - Show coin amount from `energyTagToCoins(task.energyTag)`
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 1.4 Create `TaskGroupSection` component (`src/components/TaskGroupSection.tsx`)


    - Section header with emoji and title
    - Renders list of `CompactTaskCard` components
    - Props: title, emoji, tasks array
    - _Requirements: 1.3_

- [x] 2. Create Detail Modal and Quick Complete Modal





  - [x] 2.1 Create `TaskDetailModal` component (`src/components/TaskDetailModal.tsx`)


    - Modal overlay with backdrop
    - Editable task name (click to edit, save on blur/enter)
    - Editable emoji (click to edit, save on blur/enter)
    - Read-only coin reward display
    - Read-only subtask list (no checkboxes, strikethrough for completed)
    - Delete button (left)
    - Start Focus button (right)
    - Close on backdrop click or X button
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.2 Write property test for modal state isolation (Property 5)


    - **Property 5: Modal state isolation**
    - **Validates: Requirements 3.8**

  - [x] 2.3 Create `QuickCompleteModal` component (`src/components/QuickCompleteModal.tsx`)


    - Confirmation dialog: "Complete this task and earn X coins?"
    - Show coin amount based on energy tag
    - Confirm button → calls `onConfirm`
    - Cancel button → calls `onCancel`
    - _Requirements: 2.1, 2.3_

  - [x] 2.4 Implement quick complete logic in `taskService.ts`


    - Create `quickCompleteTask(taskId, userId)` function
    - Mark all subtasks as complete
    - Trigger completion flow (awards coins via RPC)
    - _Requirements: 2.2, 2.4_

  - [x] 2.5 Write property test for quick complete equivalence (Property 2)


    - **Property 2: Quick complete equivalence**
    - **Validates: Requirements 2.2, 2.4**

- [x] 3. Refactor TasksPage with List/Focus tabs







  - [x] 3.1 Update `TasksPage.tsx` to use tab navigation



    - Replace Active/Done tabs with List/Focus tabs
    - Default to List tab on load
    - Preserve scroll position on tab switch
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Implement List tab view in `TasksPage.tsx`


    - Use `groupTasks` utility to group tasks
    - Render three `TaskGroupSection` components (Planned, Active, Done)
    - Handle card click → open Detail Modal
    - Handle checkbox click → open Quick Complete Modal
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 3.3 Create `FocusTabView` component (`src/components/FocusTabView.tsx`)



    - Subscribe to `FocusTimerContext` for active timer state
    - Show task card with "View Focus" button when timer active
    - Show empty state when no timer active
    - "View Focus" button → opens Focus View
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.4 Write property test for focus tab task selection (Property 4)


    - **Property 4: Focus tab task selection**
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

  - [x] 3.5 Integrate Detail Modal into `TasksPage.tsx`

    - Open modal on card click
    - Pass edit handlers (name, emoji)
    - Handle delete → remove task and close modal
    - Handle Start Focus → close modal and open Focus View
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 3.6 Integrate Quick Complete Modal into `TasksPage.tsx`

    - Open modal on checkbox click
    - Handle confirm → call `quickCompleteTask`
    - Handle cancel → close modal
    - Refresh task list after completion
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Remove energy tag UI elements and verify invisibility
  - [ ] 4.1 Remove `EnergyTagPicker` component usage from all views
    - Remove from `TaskInputForm` (keep internal storage)
    - Remove from any task editing interfaces
    - Energy tag still set by agent, just not shown
    - _Requirements: 6.1, 6.4_

  - [ ] 4.2 Update all task displays to show only coin amount
    - `CompactTaskCard`: show `🪙+X` (no energy tag)
    - `TaskDetailModal`: show `🪙+X` (no energy tag)
    - `FocusView`: no changes needed (doesn't show energy tag)
    - _Requirements: 6.2_

  - [ ] 4.3 Write property test for energy tag invisibility (Property 3)
    - **Property 3: Energy tag invisibility**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 5. Clean up and remove old components





  - [x] 5.1 Remove old `TaskCard` component


    - Delete `src/components/TaskCard.tsx`
    - Remove all imports and references
    - _Requirements: 1.1_


  - [x] 5.2 Update `TasksPage.tsx` to remove old card rendering logic

    - Remove large card rendering code
    - Remove inline expansion logic
    - Keep Focus View as-is (preserved)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_


  - [x] 5.3 Verify Focus View remains unchanged

    - Test that Focus View still works with timer
    - Test that editing in Focus View still works
    - Test that completion flow in Focus View still works
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Final checkpoint — Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.
