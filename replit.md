# Trading Dashboard Application

## Overview

This is a comprehensive trading dashboard application built with React, Express, and PostgreSQL. The application provides a systematic workflow for stock trading through six distinct phases: scanning, chart analysis, pre-entry setup, trade entry, position management, and post-trading analysis. It features real-time market data, watchlist management, trade tracking, and risk management tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **Automatic Trade Management System Fully Operational** (June 25, 2025): System now monitors positions every 30 seconds and auto-closes trades at profit targets or stop losses with email notifications
- **Real Market Data Integration Complete**: Fixed hardcoded price bug - each stock now uses authentic market pricing for entry/exit calculations instead of fallback values
- **Paper Trading System Active**: Created test positions (CVS, TSLA, AMD) with automatic monitoring - TSLA position auto-closed at stop loss with email notification
- Email Alert System Fully Operational: Resolved Mailjet API permissions and sender validation issues. Trading alerts now successfully deliver from alerts@trezian.com
- Fixed registration system by correcting API request format, enabling successful user account creation with configurable trading bankrolls  
- Stock scanning system operational with 48 qualifying stocks identified in latest scan
- Technical analysis scoring system working (NVDA: 95%, GOOGL: 80%, TSLA: 65%)
- Price alert creation and management system functional

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite with hot module replacement
- **Theme Support**: Dark/light mode toggle with system preference detection

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **API Style**: RESTful API with JSON responses
- **Database Integration**: Drizzle ORM for type-safe database operations
- **Error Handling**: Centralized error middleware with structured responses
- **Development**: Hot reload with tsx for TypeScript execution

### Database Schema
The application uses PostgreSQL with the following core entities:
- **Users**: Authentication and user management
- **Stocks**: Real-time stock data with pricing and volume information
- **Watchlists**: User-created lists for tracking stocks (focus/flagged types)
- **Trades**: Active and historical trade records with P&L tracking
- **Price Alerts**: Automated notifications for price targets
- **Scan Results**: Stock scanning results for technical analysis

## Key Components

### Trading Workflow System
The application implements a six-phase trading methodology:
1. **Scanning Phase**: Stock screening and identification tools
2. **Chart Setup Phase**: Technical analysis and setup validation
3. **Pre-Entry Phase**: Alert setup and watchlist management
4. **Entry Phase**: Position sizing and trade execution
5. **Management Phase**: Active trade monitoring and position adjustments
6. **Analysis Phase**: Post-trade performance review and statistics

### Risk Management
- **Position Sizing Calculator**: Automatic calculation based on risk percentage and stop loss
- **Account Balance Integration**: Real-time portfolio value tracking
- **Risk Monitoring**: Total risk exposure across all active positions

### Real-time Features
- **Market Data**: Live updates for major indices (SPY, NASDAQ, VIX)
- **Price Alerts**: Configurable breakout/breakdown notifications
- **Trade Monitoring**: Active position tracking with P&L calculations

## Data Flow

1. **Client Requests**: React components use TanStack Query for data fetching
2. **API Layer**: Express routes handle CRUD operations with validation
3. **Database Layer**: Drizzle ORM manages PostgreSQL interactions
4. **State Management**: Client-side caching with automatic invalidation
5. **Real-time Updates**: Polling-based updates for market data and positions

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React with TypeScript support
- **Component Library**: Radix UI primitives with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Styling**: Tailwind CSS with custom trading-specific color scheme
- **Icons**: Lucide React and Font Awesome integration

### Backend Dependencies
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with Zod schema validation
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **Utilities**: Date-fns for date manipulation, various utility libraries

### Development Tools
- **Build System**: Vite with React plugin and runtime error overlay
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESLint and Prettier integration
- **Database Migrations**: Drizzle Kit for schema management

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 and PostgreSQL 16 modules
- **Hot Reload**: Vite development server with Express middleware integration
- **Database**: Local PostgreSQL instance with automatic provisioning
- **Port Configuration**: Development server on port 5000

### Production Build
- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: ESBuild compiles TypeScript server to `dist/index.js`
- **Assets**: Static file serving through Express middleware
- **Environment**: Production environment variables for database connections

### Deployment Configuration
- **Target**: Autoscale deployment on Replit infrastructure
- **Build Process**: Two-stage build (frontend + backend compilation)
- **Port Mapping**: Internal port 5000 mapped to external port 80
- **Database**: Environment variable-based PostgreSQL connection string

The application is designed for rapid development and deployment while maintaining type safety and performance through modern tooling and architectural patterns.