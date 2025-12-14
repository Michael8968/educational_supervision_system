# Compliance Rules Engine - Feature Proposal

## Summary

Implement a compliance rules engine to support automated threshold comparison, conditional logic for different institution types, and data validation for educational supervision assessments.

## Problem Statement

The current system lacks:
1. Automated compliance checking against thresholds
2. Conditional rule application based on institution type (primary/middle school)
3. Data validation rules for precision, range, and format
4. Aggregation calculations for county-level statistics

## Proposed Solution

### Phase 1: Core Rule Engine

1. **Rule Definition Model**
   - Support threshold, conditional, validation, and aggregation rules
   - Store rules in database with conditions and actions
   - Link rules to data indicators and elements

2. **Condition Evaluation**
   - Evaluate conditions based on entity properties
   - Support multiple operators (equals, greater_than, between, etc.)
   - Combine conditions with AND/OR logic

3. **Threshold Comparison**
   - Compare actual values against fixed or dynamic thresholds
   - Support different thresholds by institution type
   - Store and display compliance results

### Phase 2: Validation Rules

1. **Field-Level Validation**
   - Required field checking
   - Numeric range validation
   - Decimal precision enforcement
   - Pattern matching (regex)

2. **Cross-Field Validation**
   - Consistency checks between related fields
   - Sum validation (parts <= total)
   - Ratio constraints

### Phase 3: Aggregation & Statistics

1. **Aggregate Functions**
   - SUM, AVG, COUNT, MIN, MAX
   - Standard deviation (STDDEV)
   - Coefficient of variation (CV)

2. **County-Level Calculations**
   - Compliance rate by indicator
   - Inter-school balance coefficient
   - Group-by calculations

## Implementation Tasks

### Database
- [ ] Create `compliance_rules` table
- [ ] Create `rule_conditions` table
- [ ] Create `rule_actions` table
- [ ] Create `compliance_results` table
- [ ] Add indexes for query performance

### Backend API
- [ ] CRUD endpoints for rules
- [ ] Rule evaluation service
- [ ] Validation service
- [ ] Aggregation service
- [ ] Results storage and retrieval

### Frontend Components
- [ ] RuleBuilder - Visual rule construction
- [ ] RuleList - Rule management page
- [ ] ComplianceIndicator - Pass/fail display
- [ ] ComplianceSummaryCard - Statistics display
- [ ] ValidationErrors - Error display component

### Integration
- [ ] Hook into data entry forms
- [ ] Real-time validation feedback
- [ ] Batch evaluation for projects
- [ ] Results display in indicator tree

## Success Criteria

1. Rules can be defined for all 7 resource allocation indicators
2. Different thresholds apply correctly to primary vs middle schools
3. Validation prevents invalid data entry
4. Compliance results accurately match manual calculations
5. Coefficient of variation calculates correctly

## Dependencies

- Data indicator model (existing)
- Element library (existing)
- School/institution data model (to be enhanced)

## Risks

1. **Performance**: Large datasets may slow evaluation
   - Mitigation: Batch processing, caching, indexed queries

2. **Complexity**: Rule combinations may have edge cases
   - Mitigation: Comprehensive test suite, preview functionality

## Timeline Estimate

- Phase 1: 2-3 weeks
- Phase 2: 1-2 weeks
- Phase 3: 1-2 weeks
- Total: 4-7 weeks
