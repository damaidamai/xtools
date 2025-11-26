## ADDED Requirements
### Requirement: Next.js Frontend Shell
The system SHALL provide a Next.js (App Router) frontend with a left navigation sidebar and right-hand workspace using the Minimal Dark theme and semantic red/blue accents.

#### Scenario: Render app shell
- **WHEN** the user opens the frontend
- **THEN** the layout shows a persistent left navigation highlighting Subdomain Enumeration
- **AND** the main area uses dark background, flat cards, and semantic accent colors per the design tokens

### Requirement: Subdomain Enumeration Page
The system SHALL expose a page where users can input a domain, choose/upload/set a default wordlist, trigger an enumeration run, and view status/logs/results with consistent UI styling.

#### Scenario: Trigger and track enumeration
- **WHEN** the user submits a valid domain and selects a wordlist (or default)
- **THEN** the UI calls the backend to start a run, shows loading/feedback, polls status and logs
- **AND** displays the resulting subdomains in a table once the run completes

### Requirement: API Client Configuration
The system SHALL centralize backend API configuration (e.g., base URL via environment) and handle errors/loading/empty states for enumeration and wordlist operations.

#### Scenario: Configure API base and handle errors
- **WHEN** the frontend loads
- **THEN** it reads the API base URL from configuration/environment
- **AND** API calls surface errors and loading states in the UI while avoiding hard-coded endpoints
