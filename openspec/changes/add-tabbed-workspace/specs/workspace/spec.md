## ADDED Requirements
### Requirement: Tabbed Workspace Navigation
The frontend workspace SHALL render a tabbed container so users can open multiple tools simultaneously without extra browser tabs.

#### Scenario: Open nav item as tab
- **WHEN** a user clicks an enabled item in the left workspace navigation
- **THEN** a tab labeled with that item opens on the right-side tab bar and becomes active, or is focused if it already exists.

#### Scenario: Default home tab on entry
- **WHEN** the workspace is first loaded
- **THEN** a Home tab with platform introduction content is created and active so the main area never renders empty.

#### Scenario: Home tab is not closable
- **WHEN** a user attempts to close the Home tab
- **THEN** the Home tab remains open and stays available as a fallback destination.

#### Scenario: Switch and preserve state
- **WHEN** a user switches between open tabs
- **THEN** each tab retains its in-progress state, inputs, and results until the tab is closed.

#### Scenario: Close tab and fallback
- **WHEN** a user closes a tab
- **THEN** that tab is removed and focus moves to the most recently used remaining tab, defaulting to the initial tab when needed.

#### Scenario: Load existing tools inside tabs
- **WHEN** a tab is active for Subdomain Recon, Wordlist Management, Proxy Management, or Request Tester
- **THEN** the corresponding page component renders within the tab content area without requiring a new browser window.
