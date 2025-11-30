## ADDED Requirements
### Requirement: Proxy Management
System SHALL provide a proxy management UI entry under the left menu above the system settings group.

#### Scenario: Open proxy management page
- **WHEN** user clicks the proxy management menu item
- **THEN** a page displays the proxy list and actions for create, edit, delete, enable/disable, and test connectivity

### Requirement: Proxy CRUD
System SHALL support create, read, update, delete, and enable/disable operations for proxies with fields: name, type (http|https|socks5), host, port, username, password, note, enabled flag.

#### Scenario: Create proxy
- **WHEN** user submits a new proxy with valid fields
- **THEN** the proxy is persisted with password stored and returned in plaintext

#### Scenario: Edit proxy
- **WHEN** user updates an existing proxy
- **THEN** changes (including plaintext password) are saved and reflected in the list

#### Scenario: Delete proxy
- **WHEN** user deletes a proxy
- **THEN** the proxy is removed from storage and list refreshes

#### Scenario: Toggle enabled
- **WHEN** user toggles a proxy enabled flag
- **THEN** the status is persisted and visible in the list

### Requirement: Proxy connectivity test
System SHALL provide a “test connectivity” action per proxy to validate reachability through the configured proxy.

#### Scenario: Test success
- **WHEN** user triggers a test on a reachable proxy
- **THEN** the system returns a success indication

#### Scenario: Test failure
- **WHEN** user triggers a test on an unreachable or invalid proxy
- **THEN** the system returns a failure indication with error message
