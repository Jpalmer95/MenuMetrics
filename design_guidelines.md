# Restaurant Recipe Cost Analysis - Design Guidelines

## Design Approach
**System-Based Approach**: Material Design principles adapted for data-intensive applications, inspired by ChefTec and Recipe Costing Calculator interfaces with emphasis on spreadsheet clarity and professional financial software aesthetics.

## Core Design Principles
1. **Data Primacy**: Information architecture prioritizes quick scanning, data entry, and cost visibility
2. **Professional Credibility**: Business tool aesthetic that conveys accuracy and trustworthiness
3. **Cognitive Ease**: Reduce mental load through consistent patterns and clear visual hierarchy

---

## Typography System

**Font Families**: 
- Primary: Open Sans (body, data tables, forms)
- Secondary: Roboto (headings, labels)

**Type Scale**:
- H1: 32px/bold - Page titles
- H2: 24px/semibold - Section headers  
- H3: 18px/semibold - Card titles, table headers
- Body Large: 16px/regular - Primary content
- Body: 14px/regular - Table cells, form inputs
- Small: 12px/regular - Helper text, metadata
- Numeric Data: 16px/medium, tabular-nums - All cost values

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Micro spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, gap-4 (between elements)
- Section spacing: p-6, py-8 (containers, cards)
- Page spacing: p-8, py-12 (major sections)

**Grid Structure**:
- Dashboard: Two-column layout (70% data table / 30% summary sidebar)
- Recipe Builder: Split view with ingredient selection (left) and recipe preview (right)
- Mobile: Single column stack with collapsible sections

---

## Color Application

**Backgrounds**:
- Primary surface: #FFF8DC (cream)
- Cards/elevated: #FFFFFF with subtle shadow
- Table headers: #F5F5DC (lighter cream)
- Hover states: rgba(139, 69, 19, 0.05)

**Interactive Elements**:
- Primary actions: #8B4513 (coffee brown)
- Secondary actions: #D2691E (chocolate)
- Success indicators: #228B22 (cost savings, valid data)
- Warning alerts: #FF8C00 (missing ingredients, price increases)
- Destructive: #DC143C (delete actions)

**Text Hierarchy**:
- Primary text: #2F4F4F (dark slate)
- Secondary text: rgba(47, 79, 79, 0.7)
- Disabled: rgba(47, 79, 79, 0.4)
- Links: #8B4513 with underline on hover

**Data Visualization**:
- Cost values: #DC143C (red for expenses)
- Profit margins: #228B22 (green for gains)
- Neutral metrics: #2F4F4F

---

## Component Library

### Navigation
**Top Bar**: Fixed header with logo (left), main navigation tabs (center: Ingredients, Recipes, Reports), action button "Import Excel" (right)

### Data Tables
**Spreadsheet Style**:
- Sticky header row with sort indicators
- Alternating row backgrounds (white/cream-5%)
- Inline editing with click-to-edit cells
- Right-aligned numeric columns
- Action column (right-most) with edit/delete icons
- Pagination footer showing "X-Y of Z entries"
- Search bar and filter dropdowns above table

**Key Columns**:
- Ingredient tables: Name | Category | Quantity | Unit | Cost/Unit | Last Updated | Actions
- Recipe tables: Recipe Name | Servings | Ingredients | Total Cost | Cost/Serving | Margin % | Actions

### Cards
**Recipe Cards**: 
- White background with 1px border (#E5E5E5)
- Header: Recipe name + edit icon
- Body: Ingredient list with quantities and individual costs
- Footer: Total cost badge (large, prominent) + cost per serving

**Summary Cards**:
- Compact stat displays for dashboard
- Icon (coffee cup, calculator, trending) + metric + label
- Background tint using theme colors at 10% opacity

### Forms
**Ingredient Entry**:
- Two-column layout (desktop)
- Labels above inputs
- Dropdown for units with searchable options
- Number inputs with increment/decrement buttons
- Auto-calculate cost per alternative units

**Recipe Builder**:
- Left panel: Searchable ingredient list with "Add" buttons
- Right panel: Added ingredients table with quantity adjusters
- Live cost calculation display (sticky at bottom)

### Modal Dialogs
**Quick Add Ingredient**: 
- Appears when missing ingredient detected
- Compact form with essential fields only
- "Add & Continue" primary action

**Excel Import**:
- Drag-and-drop zone with file icon
- Column mapping interface (Excel column → Database field)
- Preview table showing first 5 rows
- Validation warnings before import

### Buttons
**Hierarchy**:
- Primary: Solid coffee brown, white text, medium shadow
- Secondary: Outlined chocolate, transparent background
- Ghost: Text-only with hover background
- Icon buttons: 40x40px touch target, circular hover state

**Sizes**: Large (px-6 py-3), Medium (px-4 py-2), Small (px-3 py-1.5)

### Inputs & Controls
- Height: 40px for all form controls
- Border: 1px solid #D3D3D3, focus ring in primary color
- Backgrounds: White with slight inset shadow
- Dropdowns: Chevron icon, full-width mobile
- Checkboxes/Radio: Custom styled with theme colors

---

## Layout Patterns

### Dashboard View
Three-zone layout:
1. **Top Stats Bar**: 4 summary cards in row (Total Ingredients | Active Recipes | Avg Cost/Recipe | Monthly Trend)
2. **Main Content**: Full-width data table with filters
3. **Sidebar** (optional toggle): Quick actions + recent activity

### Recipe Detail Page
- Breadcrumb navigation
- Hero section: Recipe name, image placeholder, key metrics (cost, servings, margin)
- Ingredients table (editable)
- Cost breakdown chart (pie chart showing ingredient cost distribution)
- Action bar: Edit | Duplicate | Export PDF | Delete

---

## Images
No hero images required. This is a data-focused application where photography would distract from core functionality. Use:
- Icons throughout (Heroicons - solid for primary actions, outline for secondary)
- Optional: Small recipe thumbnail placeholders in cards (150x150px, rounded corners)
- Charts/graphs for cost visualization (use Chart.js with theme colors)

---

## Interaction Patterns

**Editing Flow**:
- Click cell → inline edit mode → Enter to save, Esc to cancel
- Autosave with subtle success indicator (green checkmark flash)

**Cost Updates**:
- Real-time recalculation when ingredient prices change
- Highlight affected recipes with warning badge
- Batch update confirmation dialog

**Animations**: Minimal
- Table row hover: 150ms ease background transition
- Modal entry: 200ms scale + fade
- Success states: Brief (300ms) green flash

---

## Responsive Behavior

**Desktop (>1024px)**: Side-by-side layouts, full tables visible
**Tablet (768-1024px)**: Collapsible sidebar, horizontal scrolling for tables
**Mobile (<768px)**: 
- Stack all layouts
- Card view for recipes instead of table
- Bottom sheet for forms
- Floating action button for primary actions