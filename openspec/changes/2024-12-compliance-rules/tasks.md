# Compliance Rules Engine - Implementation Tasks

## Phase 1: Core Infrastructure

### Database Schema
- [x] Add `compliance_rules` table to schema.sql
- [x] Add `rule_conditions` table
- [x] Add `rule_actions` table
- [x] Add `compliance_results` table
- [x] Add `validation_configs` table
- [x] Add `threshold_standards` table
- [x] Add necessary indexes
- [ ] Run migration on dev database

### Backend - Rule Service
- [x] Create `/backend/services/ruleService.js`
  - [x] `parseCondition(condition, entity)` - Evaluate single condition
  - [x] `evaluateConditions(conditions, entity)` - Evaluate all conditions
  - [x] `compareThreshold(value, operator, threshold)` - Threshold comparison
  - [x] `executeRule(rule, entity)` - Full rule execution
  - [x] `batchEvaluate(ruleId, entities)` - Batch processing
  - [x] `evaluateProject(projectId)` - Project-wide evaluation
  - [x] `saveResults(results)` - Persist results to database

### Backend - Validation Service
- [x] Create `/backend/services/validationService.js`
  - [x] `validateRequired(value)` - Required field check
  - [x] `validateRange(value, min, max)` - Range validation
  - [x] `validatePrecision(value, decimals)` - Decimal precision
  - [x] `validateRegex(value, pattern)` - Pattern matching
  - [x] `validateEnum(value, allowedValues)` - Enum validation
  - [x] `validateCrossField(data, config)` - Cross-field validation
  - [x] `validateForm(data, schema)` - Full form validation
  - [x] `loadValidationRules(db, targetType, targetId)` - Load rules from DB
  - [x] `VALIDATION_PRESETS` - Predefined validation rule templates

### Backend - Aggregation Service
- [x] Create `/backend/services/aggregationService.js`
  - [x] `sum(values)` - Sum calculation
  - [x] `avg(values)` - Average calculation
  - [x] `count(values)` - Count calculation
  - [x] `min(values)` - Minimum value
  - [x] `max(values)` - Maximum value
  - [x] `stddev(values)` - Standard deviation
  - [x] `cv(values)` - Coefficient of variation (CV = stddev/mean)
  - [x] `aggregateByGroup(data, config)` - Grouped aggregation
  - [x] `calculateDistrictCV()` - District-level CV calculation
  - [x] `calculateCompositeCV()` - Composite CV for multiple indicators
  - [x] `calculateDistrictComplianceRate()` - District compliance rate
  - [x] `generateDistrictReport()` - Generate district report data

### Backend - API Routes
- [x] Create `/backend/routes/compliance.js`
  - [x] `GET /compliance-rules` - List rules
  - [x] `GET /compliance-rules/:id` - Get rule detail
  - [x] `POST /compliance-rules` - Create rule
  - [x] `PUT /compliance-rules/:id` - Update rule
  - [x] `DELETE /compliance-rules/:id` - Delete rule
  - [x] `POST /compliance-rules/:id/test` - Test execution
  - [x] `POST /compliance-rules/:id/toggle` - Enable/disable
  - [x] `POST /projects/:id/evaluate` - Run evaluation
  - [x] `GET /projects/:id/compliance-results` - Get results
  - [x] `GET /schools/:id/compliance-summary` - School compliance summary
  - [x] `GET /threshold-standards` - List threshold standards
  - [x] `POST /threshold-standards` - Save threshold standard
  - [x] `POST /validate` - Validate form data
  - [x] `GET /districts/:id/cv` - District CV calculation
  - [x] `GET /districts/:id/compliance-rate` - District compliance rate
  - [x] `GET /districts/:id/report` - District report
- [x] Register routes in `/backend/index.js`

## Phase 2: Frontend - Services & Types

### TypeScript Types
- [x] Create types in `/frontend/src/services/complianceService.ts`
  - [x] `ComplianceRule` interface
  - [x] `RuleCondition` interface
  - [x] `RuleAction` interface
  - [x] `ComplianceResult` interface
  - [x] `ThresholdStandard` interface
  - [x] `ValidationError` interface
  - [x] `CVResult` interface
  - [x] Operator and type enums (RuleType, InstitutionType, ConditionOperator, etc.)

### Frontend Service
- [x] Create `/frontend/src/services/complianceService.ts`
  - [x] `getComplianceRules()` - Fetch all rules
  - [x] `getComplianceRule(id)` - Fetch single rule
  - [x] `createComplianceRule(data)` - Create rule
  - [x] `updateComplianceRule(id, data)` - Update rule
  - [x] `deleteComplianceRule(id)` - Delete rule
  - [x] `toggleComplianceRule(id)` - Toggle enabled state
  - [x] `testComplianceRule(id, testData)` - Test rule
  - [x] `evaluateProject(projectId)` - Run evaluation
  - [x] `getProjectComplianceResults(projectId)` - Get results
  - [x] `getSchoolComplianceSummary(schoolId, projectId)` - School summary
  - [x] `getThresholdStandards()` - Get threshold standards
  - [x] `saveThresholdStandard(data)` - Save threshold standard
  - [x] `validateFormData(data)` - Validate form data
  - [x] `getDistrictCV()` - Get district CV
  - [x] `getDistrictComplianceRate()` - Get district compliance rate
  - [x] Helper functions for labels and formatting

## Phase 3: Frontend - Components

### Rule Management
- [ ] Create `/frontend/src/pages/ComplianceRules/index.tsx`
  - [ ] Rule list with filtering
  - [ ] Create/Edit rule modal
  - [ ] Enable/disable toggle
  - [ ] Delete confirmation

### Rule Builder Component
- [ ] Create `/frontend/src/components/RuleBuilder/index.tsx`
  - [ ] Condition group builder
  - [ ] Operator selector
  - [ ] Value input (with type support)
  - [ ] Threshold configurator
  - [ ] Test execution panel

### Condition Builder
- [ ] Create `/frontend/src/components/RuleBuilder/ConditionBuilder.tsx`
  - [ ] Field selector dropdown
  - [ ] Operator selector
  - [ ] Value input (text/number/select)
  - [ ] Add/remove condition buttons
  - [ ] AND/OR toggle

### Compliance Display Components
- [ ] Create `/frontend/src/components/ComplianceIndicator/index.tsx`
  - [ ] Pass/Fail icon
  - [ ] Value display
  - [ ] Threshold display
  - [ ] Tooltip with details

- [ ] Create `/frontend/src/components/ComplianceSummaryCard/index.tsx`
  - [ ] Statistics display
  - [ ] Progress bar
  - [ ] Drill-down link

## Phase 4: Integration

### Indicator Tree Integration
- [ ] Update `IndicatorTab.tsx`
  - [ ] Show compliance status on data indicators
  - [ ] Add "Evaluate" button
  - [ ] Display compliance summary card

### Data Entry Integration
- [ ] Update form components
  - [ ] Real-time validation feedback
  - [ ] Error message display
  - [ ] Disable submit on validation errors

### Project Dashboard
- [ ] Add compliance summary to project detail
  - [ ] Overall compliance rate
  - [ ] Per-indicator breakdown
  - [ ] School compliance list

## Phase 5: Mock Data & Testing

### Mock Data
- [ ] Add sample rules to `/frontend/src/mock/data.ts`
  - [ ] Resource allocation threshold rules
  - [ ] Validation rules
  - [ ] Aggregation rules

### Unit Tests
- [ ] Test rule evaluation logic
- [ ] Test validation functions
- [ ] Test aggregation calculations
- [ ] Test CV calculation accuracy

### Integration Tests
- [ ] Test rule CRUD API
- [ ] Test batch evaluation
- [ ] Test results retrieval

## Completion Criteria

- [ ] All 7 resource allocation indicators have threshold rules
- [ ] Primary/Middle school conditions work correctly
- [ ] CV calculation matches manual calculation
- [ ] Validation prevents invalid data entry
- [ ] Results display correctly in UI
- [ ] Performance acceptable for 100+ schools
