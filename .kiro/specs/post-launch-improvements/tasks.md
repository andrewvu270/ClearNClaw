# Implementation Plan

- [x] 1. Energy Tag system — schema, utilities, and agent integration




  - [x] 1.1 Add `energy_tag` column to `big_tasks` table via Supabase migration


    - `ALTER TABLE big_tasks ADD COLUMN energy_tag text DEFAULT 'medium'`
    - Existing tasks get default "medium"
    - _Requirements: 1.6, 1.7_
  - [x] 1.2 Create energy tag utility functions (`src/utils/energyTag.ts`)


    - Implement `energyTagToEmoji`, `energyTagToCoins`, `parseEnergyTag`
    - `parseEnergyTag` returns "medium" for null/undefined/invalid input
    - _Requirements: 1.2, 1.4, 1.7, 1.8, 1.9, 1.10_
  - [x] 1.3 Write property test for energy tag mapping consistency (Property 1)


    - **Property 1: Energy Tag mapping consistency**
    - **Validates: Requirements 1.2, 1.4, 1.7, 1.8, 1.9, 1.10**
  - [x] 1.4 Update `AgentResponse` interface and `breakDownTask` to parse `energyTag` from agent response


    - Add `energyTag` field to `AgentResponse`
    - Parse from agent JSON, default to "medium" if missing
    - _Requirements: 1.1, 1.4_
  - [x] 1.5 Update `complete_subtask_and_check` RPC to award 1/2/3 coins based on energy tag


    - Read `energy_tag` from `big_tasks`, use CASE statement for coin calculation
    - Note: This RPC will be extended again in step 10.8 to add streak increment logic. Step 10.8 builds on this version, not replaces it.
    - _Requirements: 1.8, 1.9, 1.10_
  - [x] 1.6 Update `taskService.ts` to pass energy tag on task creation and read it on fetch


    - Update `createBigTask` to accept and store `energyTag`
    - Update `mapBigTask` to include `energyTag` from DB row
    - Update `BigTask` type to include `energyTag: EnergyTag`
    - _Requirements: 1.2, 1.6_
  - [x] 1.7 Build `EnergyTagPicker` component and integrate into `TaskInputForm` and `FocusView`


    - Inline 3-option selector (⚡🌤🌙)
    - Pre-fill from agent suggestion on task creation
    - Allow editing on existing tasks
    - _Requirements: 1.2, 1.3_
  - [x] 1.8 Build `EnergyFilter` component and integrate into `TasksPage` Active tab


    - Horizontal filter bar with energy tag buttons + "All" option
    - Filter displayed tasks by selected energy tag
    - _Requirements: 1.5_
  - [x] 1.9 Write property test for energy tag filter correctness (Property 2)


    - **Property 2: Energy Tag filter correctness**
    - **Validates: Requirements 1.5**
  - [x] 1.10 Update `TaskCard` coin reward preview to show 1/2/3 based on energy tag


    - Replace hardcoded "+1" with dynamic value from `energyTagToCoins`
    - Display energy tag emoji next to task name
    - _Requirements: 1.2, 1.8, 1.9, 1.10_

- [x] 2. Checkpoint — Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Low Stimulation Mode




  - [x] 3.1 Add `low_stim_mode` column to `profiles` table via Supabase migration


    - `ALTER TABLE profiles ADD COLUMN low_stim_mode boolean DEFAULT false`
    - _Requirements: 2.5_
  - [x] 3.2 Create `StimModeContext` React context (`src/contexts/StimModeContext.tsx`)


    - Expose `isLowStim`, `toggle()`, `setLowStim(boolean)`
    - On mount: read from Supabase profile, check `prefers-reduced-motion` media query for first-time default
    - Toggle adds/removes `low-stim` class on `document.documentElement`
    - Persist changes to Supabase `profiles.low_stim_mode`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 3.3 Write property test for Low Stimulation Mode round-trip (Property 3)



    - **Property 3: Low Stimulation Mode round-trip**
    - **Validates: Requirements 2.4**
  - [x] 3.4 Add Low Stim CSS custom properties to `src/index.css`


    - Define `:root.low-stim` overrides for neon colors → muted pastels, transition-duration → 0
    - _Requirements: 2.2, 2.3_


  - [x] 3.5 Update animated background components to respect `StimModeContext`
    - Aurora, DotGrid, ThreeBackground: render nothing when `isLowStim` is true


    - BottomNavBar, TaskCard, etc.: colors automatically update via CSS variables


    - _Requirements: 2.1, 2.4_
  - [x] 3.6 Add Low Stim Mode toggle to `ProfilePage`
    - Toggle switch with label, uses `StimModeContext.toggle()`
    - _Requirements: 2.1, 2.5_
  - [x] 3.7 Wrap `App` component with `StimModeProvider`
    - _Requirements: 2.1_

- [x] 4. Onboarding Demo Task




  - [x] 4.1 Create `createDemoTaskIfNeeded` function in `taskService.ts`


    - Check if user has zero big tasks, create demo task with 4 sub-tasks and "low" energy tag
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Call `createDemoTaskIfNeeded` from `ensureProfile` (single trigger point)


    - _Requirements: 3.1_
  - [x] 4.3 Write unit test for demo task creation


    - Verify demo task has correct name, 4 sub-tasks, and "low" energy tag
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Checkpoint — Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Focus Timer and Pomodoro Mode




  - [x] 6.1 Create focus timer utility functions (`src/utils/focusTimer.ts`)


    - Implement `createTimerState`, `getRemainingMs`, `isTimerExpired`, `pauseTimer`, `resumeTimer`, `restartTimer`
    - Implement `getBreakDuration(pomodoroCount)` — 5 min normally, 15 min after every 4 intervals
    - Implement `getNextIncompleteSubTask(subTasks)` — returns first incomplete by sort order
    - All timer logic uses `Date.now()` wall-clock for background resilience
    - _Requirements: 4.3, 4.6, 4.7, 4.8, 4.10, 4.13, 4.14_
  - [x] 6.2 Write property test for timer remaining time correctness (Property 4)


    - **Property 4: Timer remaining time correctness**
    - **Validates: Requirements 4.3, 4.13, 4.14**
  - [x] 6.3 Write property test for timer restart preserves duration (Property 5)


    - **Property 5: Timer restart preserves duration**
    - **Validates: Requirements 4.6**
  - [x] 6.4 Write property test for Pomodoro break duration (Property 6)


    - **Property 6: Pomodoro break duration**
    - **Validates: Requirements 4.7, 4.8**
  - [x] 6.5 Write property test for next incomplete Sub-Task selection (Property 7)


    - **Property 7: Next incomplete Sub-Task selection**
    - **Validates: Requirements 4.10**
  - [x] 6.6 Create `FocusTimerContext` React context (`src/contexts/FocusTimerContext.tsx`)


    - Manage timer state: `remainingSeconds`, `isRunning`, `isPaused`, `isPomodoro`, `pomodoroCount`, `isBreak`
    - Expose `start(durationMs, pomodoro?)`, `stop()`, `pause()`, `resume()`
    - Use `requestAnimationFrame` or 1-second interval for UI updates, but `getRemainingMs` for actual time
    - _Requirements: 4.3, 4.4, 4.11, 4.13, 4.14_
  - [x] 6.7 Build `DurationPicker` modal component


    - Preset buttons: 2, 5, 10, 15, 25, 45, 60 min
    - Custom input field: 1-120 min (clamped)
    - Pomodoro toggle visible when 25 is selected
    - _Requirements: 4.1, 4.2_
  - [x] 6.8 Build `TimerDisplay` component


    - Circular countdown with mm:ss, progress ring, stop button
    - Overlaid on Focus View
    - _Requirements: 4.3, 4.4_
  - [x] 6.9 Build `BreakScreen` component


    - Calming full-screen overlay during Pomodoro breaks
    - Break timer, "Skip break" button
    - Uses Low Stim palette
    - _Requirements: 4.7, 4.9_
  - [x] 6.10 Integrate Focus Timer into `FocusView` in `TasksPage`


    - Add "Start Timer" button to task cards
    - When timer active: dim non-highlighted sub-tasks, show TimerDisplay
    - Auto-advance highlight on sub-task completion
    - Handle timer expiry: show "Keep going" / "Take a break" prompt
    - Handle all-complete during timer: stop timer, trigger completion flow
    - Handle navigation away: pause timer, show "Resume?" on return
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.10, 4.11, 4.12, 4.13_
  - [x] 6.11 Wrap `App` component with `FocusTimerProvider`


    - _Requirements: 4.3_

- [x] 7. Checkpoint — Make sure all tests are passing




  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Push Notifications





  - [x] 8.1 Create `push_subscriptions` table via Supabase migration


    - Table with `user_id`, `endpoint`, `p256dh`, `auth` columns
    - RLS policy: users manage own subscriptions
    - Add `push_enabled`, `push_frequency` columns to `profiles`
    - Add `last_session_date` as `timestamp with time zone` (not `date`) to `profiles` — hourly frequency checks need time-of-day precision
    - _Requirements: 5.1, 5.4_
  - [x] 8.2 Create push notification service (`src/services/pushService.ts`)


    - `isPushSupported()` — checks for `serviceWorkerRegistration.pushManager`
    - `subscribePush(userId, subscription)` — stores subscription in Supabase
    - `unsubscribePush(userId)` — removes subscription from Supabase and unsubscribes browser
    - _Requirements: 5.1, 5.4, 5.5_
  - [x] 8.3 Generate VAPID keys and configure service worker for push events


    - Add push event listener to service worker (via vite-plugin-pwa custom SW)
    - Handle notification click: open app and navigate to task
    - _Requirements: 5.3_
  - [x] 8.4 Create Supabase Edge Function for sending push notifications


    - Accepts user_id, finds active tasks, picks task with fewest remaining sub-tasks
    - Sends push via Web Push protocol using VAPID keys
    - Cleans up stale subscriptions on 410 response
    - _Requirements: 5.2_
  - [x] 8.5 Write property test for notification task selection (Property 8)


    - **Property 8: Notification task selection**
    - **Validates: Requirements 5.2**
  - [x] 8.6 Add push notification toggle and reminder schedule picker to `ProfilePage`


    - Toggle: requests permission, subscribes/unsubscribes
    - Schedule picker: "Every hour", "Every 2 hours", "3 times a day", "Once a day"
    - Hide toggle if `isPushSupported()` returns false
    - _Requirements: 5.1, 5.4, 5.5, 5.6_
  - [x] 8.7 Set up Supabase pg_cron or Edge Function scheduler for periodic notification checks


    - Check users who haven't opened app within their configured frequency
    - Trigger push notification Edge Function
    - Scheduler logic: compare `profiles.last_session_date` against current time and `push_frequency` value. For "hourly" → check if last_session_date > 1 hour ago. For "2hours" → > 2 hours. For "3daily" → divide waking hours (8am-10pm) into 3 slots. For "daily" → > 24 hours.
    - _Requirements: 5.2, 5.6_
  - [x] 8.8 Wire up `last_session_date` update on app open


    - Update `profiles.last_session_date` to current timestamp when Tasks page loads (or on auth session restore)
    - _Requirements: 5.2_

- [x] 9. Checkpoint — Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Recurring Tasks





  - [x] 10.1 Create `recurring_tasks` table via Supabase migration


    - Table with `big_task_id`, `recurrence_type`, `custom_days`, `reminder_time`, `streak`, `last_completed_at`, `last_reset_at`
    - RLS policy: users manage own recurring tasks (via big_tasks join)
    - _Requirements: 6.1, 6.7_
  - [x] 10.2 Create recurrence utility functions (`src/utils/recurrence.ts`)


    - `isDueToday(config, dayOfWeek)` — checks if task should show today based on schedule
    - `getNextResetDate(config)` — calculates next reset timestamp
    - _Requirements: 6.2, 6.6_
  - [x] 10.3 Write property test for recurrence schedule "due today" correctness (Property 11)


    - **Property 11: Recurrence schedule "due today" correctness**
    - **Validates: Requirements 6.6**
  - [x] 10.4 Create recurrence service (`src/services/recurrenceService.ts`)


    - `setRecurrence`, `removeRecurrence`, `getRecurringTasksDueToday`
    - `checkAndResetRecurringTasks` — on app open, reset overdue tasks, handle streak
    - Uses client local date for timezone correctness
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_
  - [x] 10.5 Write property test for recurring task reset (Property 9)


    - **Property 9: Recurring task reset clears all Sub-Tasks**
    - **Validates: Requirements 6.2**
  - [x] 10.6 Write property test for streak consistency (Property 10)


    - **Property 10: Streak consistency**
    - **Validates: Requirements 6.3, 6.4**
  - [x] 10.7 Write property test for remove recurrence preserves state (Property 12)


    - **Property 12: Remove recurrence preserves Sub-Task states**
    - **Validates: Requirements 6.8**
  - [x] 10.8 Extend `complete_subtask_and_check` RPC to handle recurring task streak increment


    - Add streak increment logic to the existing RPC from step 1.5 (do not replace, extend)
    - Check if big_task has a recurring_tasks entry, increment streak on completion
    - _Requirements: 6.3_
  - [x] 10.9 Build `RecurrenceConfig` component


    - "Make recurring" toggle + schedule picker (daily/weekdays/weekly/custom days)
    - Optional reminder time input
    - _Requirements: 6.1, 6.9_
  - [x] 10.10 Build `StreakBadge` component


    - Small badge showing 🔥 + streak count
    - _Requirements: 6.5_
  - [x] 10.11 Integrate recurring task UI into `TaskInputForm`, `TaskCard`, and `TasksPage`


    - TaskInputForm: add RecurrenceConfig below energy tag picker
    - TaskCard: show recurring icon + StreakBadge
    - TasksPage: call `checkAndResetRecurringTasks` on mount, filter recurring tasks due today
    - _Requirements: 6.1, 6.5, 6.6_
  - [x] 10.12 Integrate recurring task reminders with push notification system


    - When reminder_time is set, schedule push notification via Edge Function
    - _Requirements: 6.9_

- [ ] 11. Final Checkpoint — Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
