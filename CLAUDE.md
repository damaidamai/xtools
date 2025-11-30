# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XTools is a subdomain enumeration tool for security researchers, consisting of a FastAPI backend and Next.js frontend. It's designed for legitimate security testing and vulnerability assessments.

## Development Commands

### Backend (Python/FastAPI)
```bash
cd backend
uv pip install -r <(uv pip compile pyproject.toml)  # Install dependencies
uv run uvicorn app.main:app --reload --port 8000   # Start development server
uv run pytest                                     # Run tests
```

### Frontend (TypeScript/Next.js)
```bash
cd frontend
pnpm install       # Install dependencies
pnpm dev           # Start development server (http://localhost:3000)
pnpm build         # Build for production
pnpm lint          # Run linting
```

## Architecture

### Backend Structure
- **FastAPI application** with async/await patterns
- **SQLModel/SQLite** database with WAL mode for performance
- **Pure Python HTTP enumeration**: HEAD/OPTIONS/limited GET without external binaries
- **Real-time logging** streamed to frontend during enumeration

Key files:
- `backend/app/main.py` - FastAPI routes and CORS setup
 - `backend/app/enumeration_service.py` - Core enumeration orchestrator (HTTP enumerator)
- `backend/app/models.py` - SQLModel database schemas (SubdomainRun, Subdomain, Wordlist)
- `backend/app/schemas.py` - Pydantic request/response models

### Frontend Structure
- **Next.js 14 App Router** with TypeScript
- **Tailwind CSS** dark theme with custom Shadcn-style components
- **Real-time polling** (2.5s intervals) for run status updates
- **API client** centralized in `lib/api.ts`

Key files:
- `frontend/app/page.tsx` - Main enumeration interface with real-time updates
- `frontend/components/dashboard-shell.tsx` - Main layout wrapper
- `frontend/lib/api.ts` - All API communication functions
- `frontend/lib/types.ts` - TypeScript type definitions

## Core Functionality

### Database Models
- **SubdomainRun**: Tracks enumeration tasks (status, logs, domain, wordlist)
- **Subdomain**: Discovered subdomains with source tracking
- **Wordlist**: Dictionary management (subdomain/username/password types)

### API Endpoints
- `POST /runs` - Start subdomain enumeration
- `GET /runs/{run_id}` - Check run status
- `GET /runs/{run_id}/results` - Get enumeration results
- `GET /wordlists` - List available dictionaries
- `POST /wordlists` - Upload new dictionary

## Environment Configuration
- `ENABLE_HTTP_ENUM`: Toggle HTTP enumerator (default: "true")
- `MAX_CONCURRENT_REQUESTS`: Concurrency for HTTP checks (default: 100)
- `REQUEST_TIMEOUT`: Per-request timeout in seconds (default: 5)
- `VERIFY_SSL`: Whether to verify SSL certificates (default: "false")
- `ENABLE_GET_FALLBACK`: Enable limited GET fallback when HEAD/OPTIONS fail (default: "true")
- `USER_AGENT`: Custom User-Agent for HTTP enumeration requests
- `NEXT_PUBLIC_API_BASE`: Backend API URL (default: "http://localhost:8000")

## Key Implementation Details

### Enumeration Strategy (`enumeration_service.py`)
1. **HTTP-first**: Enumerate by issuing HEAD/OPTIONS requests (optional limited GET) against candidates.
2. **Wordlist-driven**: Uses uploaded/默认子域字典，批次并发控制。
3. **Error handling**: In-run logging with progress tracking and graceful cancellation.
4. **Real-time streaming**: Outputs progress during execution

### Frontend State Management
- **Custom hooks** in `lib/hooks.ts` for API calls
- **Real-time polling** with automatic cleanup on component unmount
- **Error boundaries** and comprehensive error display
- **File upload** component for wordlist management

### Database Setup
- **Auto-initialization**: Creates SQLite DB on first startup
- **WAL mode**: Enabled for better concurrent performance
- **Async patterns**: All database operations use async/await
