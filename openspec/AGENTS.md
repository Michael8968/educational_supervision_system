# OpenSpec Agent Instructions

## Overview

This project uses OpenSpec for spec-driven development. Before implementing any feature, review the relevant specification in `openspec/specs/`.

## Directory Structure

```
openspec/
├── specs/              # Source of truth - current specifications
│   ├── system-overview.md
│   ├── element-library.md
│   ├── tool-library.md
│   ├── indicator-library.md
│   ├── project-management.md
│   └── compliance-rules.md
├── changes/            # Proposed changes (organized by feature)
│   ├── 2024-12-element-association/
│   └── 2024-12-compliance-rules/
└── AGENTS.md           # This file
```

## Specification Format

Each spec file follows this structure:

- **Overview**: Module description and purpose
- **Requirements**: Formal requirements using SHALL/MUST
- **Scenarios**: Given/When/Then behavior descriptions
- **Data Models**: Types, enums, and structures

## Workflow

### Before Implementation

1. Read the relevant spec in `openspec/specs/`
2. Ensure you understand all requirements and scenarios
3. If requirements are unclear, ask for clarification

### Proposing Changes

1. Create a folder in `openspec/changes/[feature-name]/`
2. Add `proposal.md` with rationale
3. Add `tasks.md` with implementation checklist
4. Add `specs/` folder with delta files showing changes

### Delta Format

When proposing spec changes, use:

```markdown
## ADDED Requirements
[New requirements with scenarios]

## MODIFIED Requirements
[Updated requirements with full text]

## REMOVED Requirements
[Deprecated requirements]
```

## Key Modules

| Module | Spec File | Description |
|--------|-----------|-------------|
| System | system-overview.md | Core architecture and roles |
| Element Library | element-library.md | Assessment data elements |
| Tool Library | tool-library.md | Data collection tools |
| Indicator Library | indicator-library.md | Evaluation indicator systems |
| Project Management | project-management.md | Assessment projects |
| Compliance Rules | compliance-rules.md | Threshold comparison, validation, aggregation |

## Technology Context

- **Frontend**: React 19 + TypeScript + Ant Design 6
- **Backend**: Node.js + Express 5
- **Database**: SQLite (better-sqlite3)
- **State Management**: Zustand + React hooks
- **Language**: Chinese UI (zh_CN locale)
- **Routing**: React Router DOM 7
- **Build Tools**: Vite, ESLint, Prettier

## Recent Implementation Notes

### Data Indicator - Element Association (2024-12)

The system now supports associating data indicators with assessment elements:

1. **Database**: `data_indicator_elements` table with many-to-many relationship
2. **API**: CRUD endpoints under `/data-indicators/:id/elements`
3. **UI Components**:
   - `ElementAssociationDrawer` - Edit associations for a data indicator
   - `ElementSelector` - Reusable element picker modal
   - `IndicatorTab` - Shows element counts on data indicator nodes

### Project Configuration Tabs

Project configuration uses a multi-tab interface:
- Basic Information (基本信息)
- Indicator System (指标体系) - with element association
- Data Entry (数据填报) - tool management with drag-sort
- Expert Review (专家评审) - submission management

### Mock Data Support

Development uses mock data when `USE_MOCK = true`:
- `indicatorTrees` - hierarchical indicator structures
- `dataIndicatorElements` - element associations
- Located in `/frontend/src/mock/data.ts`

### Compliance Rules Engine (Planned)

The system will support automated compliance checking:

1. **Threshold Rules**: Compare values against pass/fail criteria
   - Different thresholds for primary (小学) vs middle (初中) schools
   - Support for fixed values and dynamic element references

2. **Conditional Logic**: Apply rules based on institution type
   - Institution types: county, primary, middle, nine_year, teaching_point
   - AND/OR condition combinations

3. **Data Validation**: Validate entries before submission
   - Required fields, numeric ranges, decimal precision
   - Cross-field consistency checks

4. **Aggregation**: Calculate county-level statistics
   - SUM, AVG, COUNT, STDDEV functions
   - Coefficient of variation (差异系数) calculation

Reference thresholds (per national standards):
| Indicator | Primary | Middle |
|-----------|---------|--------|
| 生均教学用房面积 | ≥4.5㎡ | ≥5.8㎡ |
| 生均体育场馆面积 | ≥7.5㎡ | ≥10.2㎡ |
| 生均教学仪器设备值 | ≥2000元 | ≥2500元 |
