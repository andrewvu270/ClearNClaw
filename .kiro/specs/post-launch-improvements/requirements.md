# Requirements Document

## Introduction

Post-Launch Improvements for Clear & Claw — a set of critical retention and usability features targeting ADHD users. The improvements focus on six areas, ordered by implementation dependency: (1) AI-suggested energy-based task tagging with scaled coin rewards (1/2/3 coins for low/medium/high energy), (2) a Low Stimulation Mode that reduces animations, calms colors, and uses a static background for overstimulated users, (3) a first-run onboarding demo task that gives new users an immediate reward loop, (4) an optional Focus Timer with Pomodoro mode that eliminates starting friction on tasks, (5) push notification reminders via the Web Push API for the PWA, and (6) recurring tasks with schedules, streaks, and timed reminders for daily routines.

## Glossary

- **Task Breaker**: The core Clear & Claw system that manages tasks, sub-tasks, coins, and rewards
- **Big Task**: A top-level task entered by the user
- **Sub-Task**: A smaller actionable step belonging to a Big Task
- **Energy Tag**: A label (High ⚡, Medium 🌤, Low 🌙) assigned to a Big Task indicating the energy level required. Initially suggested by the DigitalOcean Agent, editable by the user. Determines coin reward: High = 3 coins, Medium = 2 coins, Low = 1 coin
- **Low Stimulation Mode**: A user-togglable display mode that reduces animations, calms the color palette, and replaces animated backgrounds with static ones
- **Demo Task**: A pre-built Big Task with pre-defined Sub-Tasks automatically created for new users during onboarding
- **Focus Timer**: An optional countdown timer with preset durations (2, 5, 10, 15, 25, 45, 60 minutes) or custom input up to 120 minutes, that highlights the current Sub-Task and dims surrounding UI
- **Pomodoro Mode**: A Focus Timer variant using 25-minute work intervals followed by 5-minute breaks, with a 15-minute break after every 4 work intervals
- **Web Push API**: The browser API used to deliver push notifications to the PWA even when the app is not in the foreground
- **Service Worker**: The background script (provided by vite-plugin-pwa) that handles push notification delivery
- **Recurring Task**: A Big Task that automatically resets to incomplete on a user-defined schedule (daily, weekdays, weekly, or custom days). Each recurrence cycle creates a fresh set of Sub-Tasks
- **Recurrence Schedule**: The frequency at which a Recurring Task resets — options include daily, weekdays (Mon-Fri), weekly, or custom selected days
- **Streak**: A count of consecutive recurrence cycles in which the user completed all Sub-Tasks of a Recurring Task before the next reset
- **Supabase**: The backend-as-a-service platform used for authentication, database, and storage
- **DigitalOcean Agent**: The external AI service that decomposes tasks into sub-tasks and suggests energy levels

## Requirements

### Requirement 1

**User Story:** As a user with ADHD, I want my tasks tagged by energy level with scaled coin rewards, so that I can pick tasks that match how I feel and get rewarded proportionally for harder tasks.

#### Acceptance Criteria

1. WHEN the DigitalOcean Agent returns Sub-Tasks for a new Big Task, THE Task Breaker SHALL also return a suggested Energy Tag (high, medium, or low) for the Big Task
2. WHEN a user creates a Big Task, THE Task Breaker SHALL assign the AI-suggested Energy Tag and display the corresponding emoji (⚡ for high, 🌤 for medium, 🌙 for low) next to the Big Task name
3. WHEN a user taps the Energy Tag on a Big Task, THE Task Breaker SHALL allow the user to change the Energy Tag to any of the three options
4. WHEN no Energy Tag is provided by the DigitalOcean Agent, THE Task Breaker SHALL default the Big Task Energy Tag to Medium (🌤)
5. WHEN a user views the Active tab, THE Task Breaker SHALL display Energy Tag filter buttons that filter Big Tasks by the selected energy level
6. WHEN a user updates a Big Task Energy Tag, THE Task Breaker SHALL persist the change to Supabase immediately
7. WHEN a Big Task was created before the Energy Tag feature existed and has no Energy Tag, THE Task Breaker SHALL treat the Big Task as Medium (🌤) for display and coin reward purposes
8. WHEN a user completes all Sub-Tasks of a Big Task with Energy Tag "low", THE Task Breaker SHALL award the user exactly 1 Coin
9. WHEN a user completes all Sub-Tasks of a Big Task with Energy Tag "medium", THE Task Breaker SHALL award the user exactly 2 Coins
10. WHEN a user completes all Sub-Tasks of a Big Task with Energy Tag "high", THE Task Breaker SHALL award the user exactly 3 Coins

### Requirement 2

**User Story:** As a user with ADHD, I want to toggle a low stimulation mode, so that I can use the app on days when my brain cannot handle intense visuals.

#### Acceptance Criteria

1. WHEN a user enables Low Stimulation Mode from the Profile page, THE Task Breaker SHALL replace all animated backgrounds (Aurora, DotGrid, Three.js) with a static solid-color background
2. WHEN Low Stimulation Mode is active, THE Task Breaker SHALL reduce all Framer Motion transition durations to 0 milliseconds
3. WHEN Low Stimulation Mode is active, THE Task Breaker SHALL switch the color palette from neon accents to muted pastel tones
4. WHEN a user disables Low Stimulation Mode, THE Task Breaker SHALL restore the original animated backgrounds, transition durations, and neon color palette
5. WHEN a user enables or disables Low Stimulation Mode, THE Task Breaker SHALL persist the preference to Supabase so the setting survives across sessions
6. WHEN the operating system reports a prefers-reduced-motion preference, THE Task Breaker SHALL default Low Stimulation Mode to enabled on first sign-in

### Requirement 3

**User Story:** As a new user with ADHD, I want to see a pre-built demo task when I first sign up, so that I can experience the reward loop immediately without having to think of a task.

#### Acceptance Criteria

1. WHEN a user signs in for the first time and has zero Big Tasks, THE Task Breaker SHALL automatically create a Demo Task named "🎮 Build Your First Win" with four pre-defined Sub-Tasks: "Press Start", "Complete 1 action", "Win your first coin", and "Play claw machine"
2. WHEN the Demo Task is created, THE Task Breaker SHALL display the Demo Task on the Active tab identically to any user-created Big Task
3. WHEN a user completes all Sub-Tasks of the Demo Task, THE Task Breaker SHALL award the user coins based on the Demo Task Energy Tag using the standard completion flow

### Requirement 4

**User Story:** As a user with ADHD, I want an optional focus timer on my tasks with Pomodoro support, so that I can start working with zero friction and a built-in time constraint when I choose to use one.

#### Acceptance Criteria

1. WHEN a user taps the "Start Timer" button on a Big Task card, THE Task Breaker SHALL display a duration picker with preset options of 2, 5, 10, 15, 25, 45, and 60 minutes, plus a custom input field accepting values from 1 to 120 minutes, defaulting to 2 minutes
2. WHEN a user selects the 25-minute preset, THE Task Breaker SHALL display a "Pomodoro Mode" toggle option
3. WHEN a user confirms a timer duration, THE Task Breaker SHALL open the Focus View, highlight the first incomplete Sub-Task, and start a visible countdown timer for the selected duration
4. WHILE the Focus Timer is running, THE Task Breaker SHALL dim all UI elements except the currently highlighted Sub-Task and the timer display
5. WHEN the Focus Timer reaches zero in standard mode, THE Task Breaker SHALL play a gentle notification sound and display a prompt with two options: "Keep going" and "Take a break"
6. WHEN a user selects "Keep going" after the timer ends, THE Task Breaker SHALL restart the timer with the same duration
7. WHEN Pomodoro Mode is active and a 25-minute work interval ends, THE Task Breaker SHALL start a 5-minute break timer with a calming break screen
8. WHEN Pomodoro Mode completes 4 work intervals, THE Task Breaker SHALL suggest a 15-minute break instead of the standard 5-minute break
9. WHEN a user is on a Pomodoro break, THE Task Breaker SHALL allow the user to skip the break and resume work immediately
10. WHEN a user completes the highlighted Sub-Task while the Focus Timer is running, THE Task Breaker SHALL automatically advance the highlight to the next incomplete Sub-Task
11. WHEN a user taps the stop button during an active Focus Timer, THE Task Breaker SHALL stop the timer and restore the normal Focus View without any penalty or negative messaging
12. WHEN all Sub-Tasks are completed while the Focus Timer is running, THE Task Breaker SHALL stop the timer and trigger the standard Big Task completion and coin award flow
13. WHEN a user navigates away from the Focus View while the Focus Timer is running, THE Task Breaker SHALL pause the timer and display a "Resume timer?" prompt when the user returns to the task
14. WHEN the app returns from background while a Focus Timer was running, THE Task Breaker SHALL continue the timer from where it left off based on elapsed wall-clock time

### Requirement 5

**User Story:** As a user with ADHD, I want push notification reminders for my tasks, so that the app can nudge me back when I drift away.

#### Acceptance Criteria

1. WHEN a user enables push notifications from the Profile page, THE Task Breaker SHALL request Web Push API permission through the browser and register the push subscription with Supabase
2. WHEN a user has active Big Tasks and has not opened the app for 1 hour, THE Task Breaker SHALL send a push notification with an encouraging message and the name of the Big Task with the fewest remaining Sub-Tasks
3. WHEN a user taps a push notification, THE Task Breaker SHALL open the app and navigate to the Focus View of the referenced Big Task
4. WHEN a user disables push notifications from the Profile page, THE Task Breaker SHALL unsubscribe from Web Push and remove the subscription from Supabase
5. WHEN the browser does not support the Web Push API, THE Task Breaker SHALL hide the push notification toggle and rely on in-app engagement only
6. WHEN a user sets a reminder schedule, THE Task Breaker SHALL allow the user to choose notification frequency from options: "Every hour", "Every 2 hours", "3 times a day", and "Once a day"

### Requirement 6

**User Story:** As a user with ADHD, I want to create recurring tasks with schedules, so that daily routines like taking medication or exercising are tracked automatically without me having to recreate them.

#### Acceptance Criteria

1. WHEN a user creates a Big Task, THE Task Breaker SHALL offer a "Make recurring" toggle that reveals schedule options: daily, weekdays (Mon-Fri), weekly, or custom days
2. WHEN a Recurring Task reaches its next scheduled reset time, THE Task Breaker SHALL mark all Sub-Tasks as incomplete and reset the Big Task completion status, creating a new recurrence cycle
3. WHEN a user completes all Sub-Tasks of a Recurring Task before the next reset, THE Task Breaker SHALL award coins based on the Energy Tag and increment the Streak count by 1
4. WHEN a user fails to complete a Recurring Task before the next reset, THE Task Breaker SHALL reset the task without penalty and set the Streak count to 0
5. WHEN a user views a Recurring Task on the Active tab, THE Task Breaker SHALL display a recurring icon and the current Streak count next to the Big Task name
6. WHEN a user views the Active tab, THE Task Breaker SHALL display Recurring Tasks that are due for the current day based on their Recurrence Schedule
7. WHEN a user edits the Recurrence Schedule of a Recurring Task, THE Task Breaker SHALL persist the updated schedule to Supabase immediately
8. WHEN a user removes the recurring setting from a Recurring Task, THE Task Breaker SHALL convert the task to a standard one-time Big Task and preserve the current Sub-Task states
9. WHEN a user sets a reminder time on a Recurring Task, THE Task Breaker SHALL send a push notification at the specified time on each scheduled day (requires push notifications from Requirement 5 to be enabled)
