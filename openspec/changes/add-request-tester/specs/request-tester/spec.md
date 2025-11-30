## ADDED Requirements
### Requirement: Request Tester
System SHALL provide a “请求测试” entry in the workspace to paste and execute HTTP requests.

#### Scenario: Open request tester
- **WHEN** user opens the request tester
- **THEN** a form is shown to paste/edit a curl command and configure request count and proxy

### Requirement: Execute requests
System SHALL allow users to paste a curl request, optionally edit it, set a request count (default 1), and execute, returning each response.

#### Scenario: Single request success
- **WHEN** user pastes a valid curl and clicks execute with count=1
- **THEN** the system performs the request and shows status, headers, and body

#### Scenario: Multiple requests
- **WHEN** user sets count > 1
- **THEN** the system executes sequentially the specified number of times and shows each result separately

#### Scenario: Parallel execution
- **WHEN** user chooses parallel mode
- **THEN** the system executes the specified number of requests in parallel and returns each result

#### Scenario: Proxy selection
- **WHEN** user selects an existing proxy
- **THEN** the system executes the request via that proxy and surfaces errors if the proxy fails

#### Scenario: Editable command
- **WHEN** user edits the pasted curl before executing
- **THEN** the edited content is used for execution
