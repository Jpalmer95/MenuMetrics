# Recipe Cost Analysis Application

## Overview

A professional recipe cost analysis tool designed for coffee shops, cafes, and restaurants. The application enables users to track ingredient inventory, build recipes, calculate accurate COGS (Cost of Goods Sold), and optimize menu pricing with real-time cost updates. Built with a focus on data clarity and spreadsheet-like precision, inspired by professional tools like ChefTec and Recipe Costing Calculator.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: 
- Shadcn/ui component library built on Radix UI primitives
- Material Design principles adapted for data-intensive applications
- Tailwind CSS for styling with custom design tokens
- Theme support (light/dark mode) via context provider

**State Management**:
- TanStack Query (React Query) for server state and data fetching
- React Hook Form with Zod validation for form state
- URL-based routing with Wouter (lightweight React router)

**Design System**:
- Typography: Open Sans (body/data), Roboto (headings)
- Color scheme: Cream background (#FFF8DC) with warm earth tones
- Spacing: Tailwind utility-based (2, 4, 6, 8 unit scale)
- Professional, spreadsheet-inspired layout for data clarity

**Key UI Features**:
- Dashboard with statistics and charts (Recharts for data visualization)
- Ingredient management with inline editing and Excel import
- Recipe builder with drag-and-drop ingredient selection
- Real-time cost calculations with unit conversion support

### Backend Architecture

**Runtime**: Node.js with Express.js server

**API Design**:
- RESTful API structure
- JSON-based request/response
- Session-based approach (infrastructure present via connect-pg-simple)

**Data Layer**:
- Drizzle ORM for type-safe database operations
- PostgreSQL database (via @neondatabase/serverless)
- Schema-first design with Zod validation
- In-memory storage fallback (MemStorage class) for development

**Core Data Models**:
- Ingredients: name, category, quantity, unit, cost per unit
- Recipes: name, servings, total cost (calculated)
- RecipeIngredients: junction table linking recipes to ingredients with quantities
- Supports 13 measurement units with conversion logic

**File Processing**:
- Multer for file uploads (Excel import functionality)
- XLSX library for spreadsheet parsing
- Server-side validation of imported data

### External Dependencies

**AI Integration** (planned/partial):
- OpenAI API integration for recipe recommendations
- Google Gemini API as alternative AI provider
- Rate limiting and retry logic implemented
- Used for suggesting recipes based on available ingredients and cost constraints

**Database**:
- PostgreSQL via Neon serverless platform
- Connection string configured via DATABASE_URL environment variable
- Drizzle Kit for schema migrations

**Third-Party Libraries**:
- `date-fns` for date formatting and manipulation
- `class-variance-authority` and `clsx` for dynamic styling
- `nanoid` for unique ID generation
- `p-limit` and `p-retry` for concurrency control and error handling

**Development Tools**:
- Replit-specific plugins for development experience
- TypeScript for type safety across the stack
- ESBuild for server-side bundling

**Chart Visualization**:
- Recharts library for dashboard analytics
- Displays ingredient category distribution and cost breakdowns

### Key Architectural Decisions

**Monorepo Structure**: Client and server code in single repository with shared TypeScript types via `/shared` directory, enabling type safety across the full stack.

**Type Safety**: End-to-end TypeScript with Zod schemas for runtime validation, Drizzle for compile-time database type safety, and shared type definitions between frontend and backend.

**Component Architecture**: Shadcn/ui pattern allowing components to be copied into the project rather than installed as dependencies, providing full customization while maintaining consistency.

**Unit Conversion System**: Custom conversion logic supporting 13 different measurement units (grams, ounces, cups, etc.) with accurate cost calculations when recipe units differ from ingredient storage units.

**Real-time Cost Calculation**: Recipe costs automatically recalculated when ingredient prices or quantities change, ensuring accurate COGS at all times.

**Excel Import Workflow**: Column mapping interface allows users to import existing ingredient databases from spreadsheets with flexible field mapping.

**Design-First Approach**: Dedicated design guidelines document ensures consistent Material Design-inspired aesthetic optimized for data-heavy interfaces.