# Implementation Plan

- [x] 1. Set up project structure and configuration





  - [x] 1.1 Initialize React + TypeScript project with Vite, install dependencies (Tailwind CSS, Framer Motion, React Router, @supabase/supabase-js, fast-check, vitest, React Testing Library, @react-three/fiber, @react-three/drei, react-bits)




    - Configure Tailwind with the cozy pixel / retro arcade theme (dark teal/navy base, neon accent colors)
    - Set up pixel font (e.g., Press Start 2P) for headings and Inter for body text


    - Configure Vitest with fast-check support
    - _Requirements: 5.1, 5.2_


  - [ ] 1.2 Set up Supabase client configuration and TypeScript types
    - Create `src/lib/supabase.ts` with Supabase client initialization
    - Create `src/types/index.ts` with BigTask, SubTask, UserProfile, Toy, UserToy interfaces
    - _Requirements: 6.1, 6.2_
  - [ ] 1.3 Set up React Router with route definitions and ProtectedRoute component
    - Define routes: `/sign-in`, `/tasks`, `/claw-machine`, `/profile`
    - Implement `ProtectedRoute` wrapper that checks Supabase auth session and redirects to `/sign-in`
    - _Requirements: 5.1, 6.1_
  - [ ]* 1.4 Write property test for protected route redirect (Property 7)
    - **Property 7: Protected route redirect**
    - **Validates: Requirements 6.1**

- [x] 2. Implement validation and progress utilities




  - [x] 2.1 Create input validation utility (`src/utils/validation.ts`)

    - Implement `isValidTaskDescription(input: string): boolean` that rejects empty and whitespace-only strings
    - _Requirements: 1.3_
  - [ ]* 2.2 Write property test for whitespace-only task rejection (Property 1)
    - **Property 1: Whitespace-only task rejection**
    - **Validates: Requirements 1.3**


  - [ ] 2.3 Create progress calculation utility (`src/utils/progress.ts`)
    - Implement `calculateProgress(subTasks: SubTask[]): number` returning completed/total ratio, 0 for empty list
    - _Requirements: 2.3, 8.4, 8.5_
  - [x]* 2.4 Write property test for progress invariant (Property 3)


    - **Property 3: Progress invariant**
    - **Validates: Requirements 2.3, 8.4, 8.5**
  - [ ] 2.5 Create task filter/sort utilities (`src/utils/filters.ts`)
    - Implement `getActiveTasks(tasks: BigTask[]): BigTask[]` — filters to tasks with at least one incomplete sub-task, sorted by createdAt descending
    - Implement `getDoneTasks(tasks: BigTask[]): BigTask[]` — filters to fully completed tasks, sorted by completedAt descending
    - _Requirements: 7.2, 7.3_
  - [ ]* 2.6 Write property test for active tab filter correctness (Property 8)
    - **Property 8: Active tab filter correctness**
    - **Validates: Requirements 7.2**
  - [ ]* 2.7 Write property test for done tab filter correctness (Property 9)
    - **Property 9: Done tab filter correctness**
    - **Validates: Requirements 7.3**

- [x] 3. Checkpoint - Make sure all tests are passing


  - Ensure all tests pass, ask the user if questions arise.






- [x] 4. Implement Supabase database schema and RPC functions







  - [ ] 4.1 Create Supabase migration for profiles, big_tasks, sub_tasks, user_toys tables with Row Level Security policies
    - Create tables matching the ER diagram in the design document


    - Enable RLS on all tables, add policies so users can only access their own data
    - _Requirements: 2.4, 6.1, 8.1, 8.2_
  - [ ] 4.2 Create Supabase RPC function `complete_subtask_and_check` for atomic sub-task completion + coin award
    - Atomically marks sub-task complete, checks if all siblings are done, marks big task complete and awards coin if so
    - _Requirements: 2.2, 2.4_



- [ ] 5. Implement service layer
  - [ ] 5.1 Implement Agent Service (`src/services/agentService.ts`)
    - `breakDownTask(description: string)` — calls DigitalOcean Agent endpoint with 10-second timeout, returns emoji + sub-tasks
    - Handle timeout with AbortController
    - _Requirements: 1.1, 1.4_
  - [ ] 5.2 Implement Task Service (`src/services/taskService.ts`)
    - `createBigTask`, `getBigTasks`, `updateBigTaskName`, `deleteBigTask`, `toggleSubTask`, `updateSubTaskName`, `deleteSubTask`, `addSubTask`


    - Use Supabase client for all CRUD operations
    - `deleteBigTask` cascades to delete all associated sub-tasks
    - _Requirements: 1.1, 2.1, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x]* 5.3 Write property test for Big Task deletion cascades (Property 4)












    - **Property 4: Big Task deletion cascades to Sub-Tasks**

    - **Validates: Requirements 8.3**
  - [x] 5.4 Implement Coin Service (`src/services/coinService.ts`)



    - `getCoinBalance`, `spendCoin` (deducts 1, returns false if balance is 0), `awardCoin`
    - _Requirements: 2.2, 3.1, 3.2_
  - [x]* 5.5 Write property test for coin deduction on play (Property 5)



    - **Property 5: Coin deduction on Claw Machine play**
    - **Validates: Requirements 3.1**



  - [ ]* 5.6 Write property test for Big Task completion awards coin (Property 2)
    - **Property 2: Big Task completion awards exactly 1 Coin**


    - **Validates: Requirements 2.2**


  - [-] 5.7 Implement Claw Machine Service (`src/services/clawMachineService.ts`)

    - `getAvailableToys`, `awardToy` — reads from toys table, inserts into user_toys
    - _Requirements: 3.3_
  - [ ]* 5.8 Write property test for toy collection grows on win (Property 6)
    - **Property 6: Toy Collection grows on win**
    - **Validates: Requirements 3.3**
  - [ ] 5.9 Implement Profile Service (`src/services/profileService.ts`)
    - `getProfile`, `getToyCollection` — reads from profiles and user_toys tables
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement shared UI components
  - [ ] 7.1 Build `CircularProgressEmoji` component
    - SVG-based circular progress bar wrapping an emoji
    - Props: `emoji: string`, `progress: number (0-1)`, `size: number`
    - Emoji minimum size 32px, smooth animated progress transitions
    - _Requirements: 1.2, 2.3, 5.4_
  - [ ] 7.2 Build `BottomNavBar` component
    - 3 tabs: Tasks, Claw Machine, Profile with icons
    - Highlights active route, minimum 44x44px touch targets
    - Mobile-responsive, fixed to bottom of viewport
    - _Requirements: 5.1, 5.5, 5.6_
  - [ ] 7.3 Build `EmptyState` component
    - Reusable component with encouraging message and optional action button
    - Pixel-art styled with neon accents
    - _Requirements: 4.4, 7.5, 7.6_
  - [ ] 7.4 Build `TaskCard` component
    - Expandable card showing Big Task name + CircularProgressEmoji
    - Expands to show Sub-Task list on click
    - Edit Big Task name inline, delete Big Task button
    - _Requirements: 7.4, 8.1, 8.3_
  - [ ] 7.5 Build `SubTaskItem` component
    - Checkbox + editable name + delete button
    - Visual distinction for completed vs incomplete (strikethrough, opacity)
    - Minimum 44x44px touch targets
    - _Requirements: 2.1, 8.2, 8.4, 5.6_
  - [ ] 7.6 Build `TaskInputForm` component with voice input
    - Text input + mic button + submit button
    - Mic button uses Web Speech API for voice transcription, hidden if unsupported
    - Client-side validation rejects whitespace-only input
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

- [x] 8. Implement pages





  - [ ] 8.1 Build `SignInPage` with Three.js animated background
    - Lazy-load React Three Fiber scene (floating pixel characters or subtle 3D elements)
    - Supabase Auth UI for sign-in


    - Redirect to `/tasks` on successful auth
    - _Requirements: 6.1, 6.2_
  - [ ] 8.2 Build `TasksPage` with Active/Done tabs
    - Task input form at top
    - Tab switcher: Active / Done
    - List of TaskCards filtered by active tab using filter utilities


    - "Add Sub-Task" button on expanded TaskCards
    - Empty states for each tab
    - Smooth animated transitions between tabs (200-400ms)
    - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.5_


  - [ ] 8.3 Build `ClawMachinePage` integrating existing claw machine component
    - Display current coin balance
    - Play button (disabled when 0 coins, shows insufficient coins message)
    - Integrate existing claw machine React component
    - On game end: deduct coin, award toy on win, show animated outcome
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 8.4 Build `ProfilePage` with stats and toy collection
    - Display completed Big Tasks count and coin balance
    - Toy Collection gallery grid with pixel-art styled cards
    - Empty state when no toys
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Implement auth flow and session management





  - [ ] 9.1 Wire up Supabase auth listener for session management
    - On sign-in: create or retrieve profile, redirect to `/tasks`




    - On sign-out: clear session, redirect to `/sign-in`
    - On session expired: redirect to `/sign-in`
    - _Requirements: 6.1, 6.2, 6.3_



- [x] 10. Polish and responsive design



  - [ ] 10.1 Apply responsive layout across all pages (320px to 1440px)
    - Test and adjust layouts for mobile, tablet, and desktop breakpoints
    - Ensure all touch targets are minimum 44x44px
    - Verify emoji sizes are minimum 32px
    - _Requirements: 5.3, 5.4, 5.5, 5.6_
  - [ ] 10.2 Add page transition animations with Framer Motion
    - Smooth transitions between routes (200-400ms)
    - Micro-interactions on task completion, coin award, toy win
    - _Requirements: 5.3_

- [ ] 11. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
