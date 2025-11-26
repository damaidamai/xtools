## ADDED Requirements
### Requirement: Trigger Subdomain Enumeration Runs
The system SHALL accept a root domain input to start a subdomain enumeration run via a configured discovery tool (e.g., Subfinder) and return a run identifier with an initial status.

#### Scenario: Start enumeration run
- **WHEN** a user submits a valid root domain for enumeration
- **THEN** the system creates a run record with status queued or running
- **AND** returns the run identifier for follow-up queries

### Requirement: Track Run Status and Logs
The system SHALL track enumeration run lifecycle states (pending, running, succeeded, failed) and expose status plus recent output/log snippets for clients to poll without blocking execution.

#### Scenario: Poll run status
- **WHEN** a client requests status for an enumeration run
- **THEN** the system returns the current state with timestamps
- **AND** includes recent output/log details to reflect progress or failure reasons

### Requirement: Persist and Serve Enumerated Subdomains
The system SHALL persist deduplicated subdomains produced by a run, tagged with the originating run identifier and timestamps, and provide an API to fetch the result set for a given run.

#### Scenario: Retrieve results after completion
- **WHEN** a run completes successfully
- **THEN** the client can request its results
- **AND** receive the list of discovered subdomains with metadata (e.g., source, collected time)

### Requirement: Manage Enumeration Wordlists
The system SHALL allow users to upload, list, and set a default wordlist for subdomain enumeration, validating size and format, and enabling runs to specify which wordlist to use.

#### Scenario: Upload and select wordlist
- **WHEN** a user uploads a valid text-based wordlist within allowed size limits
- **THEN** the system stores it safely and records metadata (name, size, created time)
- **AND** a user can select this wordlist (or default) when triggering an enumeration run

### Requirement: UI Flow for Subdomain Enumeration
The system SHALL provide a frontend view that allows users to submit a domain, observe run progress, and view the resulting subdomain list using the Minimal Dark theme with red/blue semantics.

#### Scenario: Use UI to enumerate subdomains
- **WHEN** a user opens the subdomain enumeration view and submits a domain
- **THEN** the UI triggers a run and shows in-progress status updates
- **AND** renders the resulting subdomain list with the established dark theme styling once available
