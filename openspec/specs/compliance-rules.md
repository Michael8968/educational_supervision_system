# Compliance Rules Engine Specification

## Overview

The Compliance Rules Engine (达标判定规则引擎) provides automated threshold comparison, conditional logic for different institution types, and data validation capabilities for educational supervision assessments.

## Core Concepts

### Rule Types

| Type | Code | Description |
|------|------|-------------|
| Threshold Rule (阈值规则) | threshold | Compare values against pass/fail criteria |
| Conditional Rule (条件规则) | conditional | Apply different rules based on conditions |
| Validation Rule (校验规则) | validation | Validate data format, range, precision |
| Aggregation Rule (聚合规则) | aggregation | Calculate statistics across entities |

### Institution Types (填报对象类型)

| Type | Code | Description |
|------|------|-------------|
| County (县/区) | county | County-level aggregate data |
| Primary School (小学) | primary | Primary schools (grades 1-6) |
| Middle School (初中) | middle | Junior middle schools (grades 7-9) |
| Nine-Year School (九年一贯制) | nine_year | Combined primary and middle |
| Complete Middle (完全中学) | complete | Junior + Senior middle |
| Teaching Point (教学点) | teaching_point | Small teaching points (≥50 students) |

## Data Models

### Rule Definition (规则定义)

```typescript
interface ComplianceRule {
  id: string;
  code: string;                    // e.g., "RULE_001"
  name: string;                    // e.g., "生均教学用房面积达标"
  ruleType: 'threshold' | 'conditional' | 'validation' | 'aggregation';
  indicatorId?: string;            // Linked data indicator
  elementId?: string;              // Linked element
  enabled: boolean;
  priority: number;                // Execution order
  conditions: RuleCondition[];     // When to apply
  actions: RuleAction[];           // What to check/calculate
  createdAt: string;
  updatedAt: string;
}
```

### Rule Condition (规则条件)

```typescript
interface RuleCondition {
  id: string;
  field: string;                   // e.g., "institutionType", "schoolLevel"
  operator: ConditionOperator;
  value: string | number | string[];
  logicalOperator?: 'AND' | 'OR';  // For combining conditions
}

type ConditionOperator =
  | 'equals'           // ==
  | 'not_equals'       // !=
  | 'in'               // IN array
  | 'not_in'           // NOT IN array
  | 'greater_than'     // >
  | 'less_than'        // <
  | 'greater_equal'    // >=
  | 'less_equal'       // <=
  | 'between'          // BETWEEN
  | 'is_null'          // IS NULL
  | 'is_not_null';     // IS NOT NULL
```

### Rule Action (规则动作)

```typescript
interface RuleAction {
  id: string;
  actionType: 'compare' | 'validate' | 'calculate' | 'aggregate';

  // For threshold comparison
  threshold?: {
    operator: ThresholdOperator;
    value: number | string;
    valueType: 'fixed' | 'element' | 'formula';
    elementId?: string;            // Reference another element
    formula?: string;              // Calculate threshold dynamically
  };

  // For validation
  validation?: {
    type: ValidationType;
    params: Record<string, any>;
  };

  // For aggregation
  aggregation?: {
    function: AggregateFunction;
    groupBy?: string[];
    filter?: RuleCondition[];
  };

  // Result
  resultField: string;             // Where to store result
  passMessage?: string;            // Message when pass
  failMessage?: string;            // Message when fail
}

type ThresholdOperator = '>=' | '>' | '<=' | '<' | '==' | '!=' | 'between';
type ValidationType = 'required' | 'range' | 'precision' | 'regex' | 'enum' | 'unique';
type AggregateFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'STDDEV' | 'CV';
```

### Compliance Result (达标结果)

```typescript
interface ComplianceResult {
  id: string;
  ruleId: string;
  entityType: string;              // 'school' | 'county' | 'indicator'
  entityId: string;
  indicatorId?: string;
  value: number | string;          // Actual value
  threshold: number | string;      // Applied threshold
  isCompliant: boolean;            // Pass/Fail
  message: string;                 // Result description
  details?: Record<string, any>;   // Additional context
  calculatedAt: string;
}
```

## Requirements

### Requirement: Threshold Rule Definition

The system SHALL support defining threshold rules for data indicators.

#### Scenario: Create Simple Threshold Rule

**Given** a data indicator "生均教学及辅助用房面积"
**When** creating a threshold rule with:
- Operator: >=
- Value: 4.5
- Institution type: Primary School
**Then** the system SHALL save the rule
**And** apply it when evaluating primary schools

#### Scenario: Create Conditional Threshold Rule

**Given** a data indicator with different thresholds by institution type
**When** creating conditional threshold rules:
- Primary School: >= 4.5 ㎡
- Middle School: >= 5.0 ㎡
**Then** the system SHALL:
- Apply 4.5 threshold to primary schools
- Apply 5.0 threshold to middle schools

#### Scenario: Define Threshold by Element Reference

**Given** a derived element "省定标准值"
**When** creating a threshold rule referencing this element
**Then** the system SHALL:
- Fetch the element value dynamically
- Compare against the fetched value
- Update results when the reference value changes

### Requirement: Conditional Logic Engine

The system SHALL support conditional rule application based on institution characteristics.

#### Scenario: Apply Rules by Institution Type

**Given** compliance rules with institution type conditions
**When** evaluating a school
**Then** the system SHALL:
1. Identify the school's institution type (primary/middle/etc.)
2. Filter applicable rules by condition matching
3. Apply only matching rules
4. Skip non-applicable rules

#### Scenario: Apply Rules by Multiple Conditions

**Given** a rule with multiple conditions:
- Institution type: Primary School
- Urban/Rural: Rural
- Student count: >= 100
**When** evaluating schools
**Then** the system SHALL:
- Apply rule only to rural primary schools with 100+ students
- Use AND logic by default for combining conditions

#### Scenario: Handle Nine-Year Schools

**Given** a nine-year unified school (九年一贯制)
**When** evaluating compliance
**Then** the system SHALL:
- Split evaluation into primary and middle segments
- Apply primary school rules to grades 1-6 data
- Apply middle school rules to grades 7-9 data
- Report combined and segmented results

### Requirement: Data Validation Rules

The system SHALL validate data entries against defined rules.

#### Scenario: Validate Required Fields

**Given** a data entry form with required fields
**When** submitting incomplete data
**Then** the system SHALL:
- Identify missing required fields
- Display validation errors with field names
- Prevent submission until resolved

#### Scenario: Validate Numeric Range

**Given** a numeric field with range constraints:
- Minimum: 0
- Maximum: 100
**When** entering a value outside the range
**Then** the system SHALL:
- Display error: "值必须在 0-100 之间"
- Highlight the invalid field
- Prevent form submission

#### Scenario: Validate Decimal Precision

**Given** a field requiring 2 decimal places
**When** entering "12.345"
**Then** the system SHALL:
- Either round to "12.35"
- Or display error: "最多保留2位小数"
- Based on configuration (auto-round vs strict)

#### Scenario: Validate Data Consistency

**Given** related fields:
- Total teachers count
- Qualified teachers count
**When** qualified > total
**Then** the system SHALL:
- Display error: "具有资质教师数不能超过教师总数"
- Reference both fields in the error

### Requirement: Compliance Calculation

The system SHALL calculate compliance status automatically.

#### Scenario: Calculate Single Indicator Compliance

**Given** a school with data indicator value 4.8
**And** threshold rule: >= 4.5 for primary schools
**When** calculating compliance
**Then** the system SHALL:
- Compare 4.8 >= 4.5
- Mark as compliant (达标)
- Store result with actual value and threshold

#### Scenario: Calculate Aggregate Compliance

**Given** 31 primary schools in a county
**When** calculating county-level compliance for an indicator
**Then** the system SHALL:
- Count schools where indicator is compliant
- Calculate compliance rate: compliant/total * 100%
- Store both count and percentage

#### Scenario: Calculate Coefficient of Variation

**Given** per-school values for an indicator
**When** calculating inter-school balance (校际均衡)
**Then** the system SHALL:
- Calculate mean: μ = Σx / n
- Calculate standard deviation: σ = √(Σ(x-μ)² / n)
- Calculate coefficient of variation: CV = σ / μ
- Compare CV against threshold (typically <= 0.65)

### Requirement: Rule Management UI

The system SHALL provide UI for managing compliance rules.

#### Scenario: View Rules List

**Given** a user with rule management permissions
**When** accessing the rules management page
**Then** the system SHALL display:
- Rule code and name
- Rule type (threshold/conditional/validation)
- Linked indicator/element
- Status (enabled/disabled)
- Last updated time
- Action buttons (edit/toggle/delete)

#### Scenario: Create New Rule

**Given** a user on the rules management page
**When** clicking "Create Rule"
**Then** the system SHALL display a form with:
- Basic info: code, name, type
- Condition builder (visual)
- Threshold/validation configuration
- Test execution option

#### Scenario: Test Rule Execution

**Given** a draft rule
**When** clicking "Test Rule"
**Then** the system SHALL:
- Execute rule against sample data
- Display which entities would pass/fail
- Show detailed calculation steps
- Allow adjustment before saving

## Threshold Reference Table

Based on national standards for balanced compulsory education:

### Resource Allocation Indicators (资源配置指标)

| Indicator | Primary School | Middle School | Unit |
|-----------|---------------|---------------|------|
| 每百名学生拥有高于规定学历教师数 | >= 4.2 | >= 5.3 | 人 |
| 每百名学生拥有县级及以上骨干教师数 | >= 1 | >= 1 | 人 |
| 每百名学生拥有体育、艺术专任教师数 | >= 0.9 | >= 0.9 | 人 |
| 生均教学及辅助用房面积 | >= 4.5 | >= 5.8 | ㎡ |
| 生均体育运动场馆面积 | >= 7.5 | >= 10.2 | ㎡ |
| 生均教学仪器设备值 | >= 2000 | >= 2500 | 元 |
| 每百名学生拥有网络多媒体教室数 | >= 2.3 | >= 2.4 | 间 |

### Balance Coefficient Thresholds (均衡系数阈值)

| Metric | Threshold | Description |
|--------|-----------|-------------|
| 综合差异系数 (小学) | <= 0.50 | All 7 indicators |
| 综合差异系数 (初中) | <= 0.45 | All 7 indicators |
| 单项差异系数 | <= 0.65 | Per indicator |

### Government Guarantee Indicators (政府保障指标)

| Indicator | Threshold | Type |
|-----------|-----------|------|
| 学校规模 (小学/初中) | <= 2000 | 人 |
| 学校规模 (九年一贯制) | <= 2500 | 人 |
| 班额 (小学) | <= 45 | 人 |
| 班额 (初中) | <= 50 | 人 |
| 特教生均公用经费 | >= 6000 | 元 |
| 教师培训完成率 | >= 100% | % |
| 教师交流比例 | >= 10% | % |
| 骨干教师交流比例 | >= 20% | % |

## Database Schema

```sql
-- 规则定义表
CREATE TABLE compliance_rules (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,          -- threshold/conditional/validation/aggregation
  indicator_id TEXT,
  element_id TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  description TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (indicator_id) REFERENCES data_indicators(id),
  FOREIGN KEY (element_id) REFERENCES elements(id)
);

-- 规则条件表
CREATE TABLE rule_conditions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT NOT NULL,               -- JSON encoded for arrays
  logical_operator TEXT DEFAULT 'AND',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (rule_id) REFERENCES compliance_rules(id) ON DELETE CASCADE
);

-- 规则动作表
CREATE TABLE rule_actions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  action_type TEXT NOT NULL,         -- compare/validate/calculate/aggregate
  config TEXT NOT NULL,              -- JSON configuration
  result_field TEXT,
  pass_message TEXT,
  fail_message TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (rule_id) REFERENCES compliance_rules(id) ON DELETE CASCADE
);

-- 达标结果表
CREATE TABLE compliance_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,         -- school/county/indicator
  entity_id TEXT NOT NULL,
  indicator_id TEXT,
  actual_value TEXT,
  threshold_value TEXT,
  is_compliant INTEGER,
  message TEXT,
  details TEXT,                      -- JSON
  calculated_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (rule_id) REFERENCES compliance_rules(id)
);

-- Indexes
CREATE INDEX idx_rules_type ON compliance_rules(rule_type);
CREATE INDEX idx_rules_indicator ON compliance_rules(indicator_id);
CREATE INDEX idx_conditions_rule ON rule_conditions(rule_id);
CREATE INDEX idx_actions_rule ON rule_actions(rule_id);
CREATE INDEX idx_results_project ON compliance_results(project_id);
CREATE INDEX idx_results_entity ON compliance_results(entity_type, entity_id);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /compliance-rules | List all rules |
| GET | /compliance-rules/:id | Get rule details |
| POST | /compliance-rules | Create new rule |
| PUT | /compliance-rules/:id | Update rule |
| DELETE | /compliance-rules/:id | Delete rule |
| POST | /compliance-rules/:id/test | Test rule execution |
| POST | /compliance-rules/:id/toggle | Enable/disable rule |
| POST | /projects/:id/evaluate | Run compliance evaluation |
| GET | /projects/:id/compliance-results | Get evaluation results |
| GET | /schools/:id/compliance-summary | Get school compliance summary |

## UI Components

### RuleBuilder (规则构建器)

Visual rule builder component with:
- Condition groups (AND/OR)
- Drag-drop condition ordering
- Threshold comparison configurator
- Validation rule configurator
- Preview and test functionality

### ComplianceIndicator (达标指示器)

Display component showing:
- Pass/Fail status icon
- Actual vs threshold values
- Progress bar for percentage-based
- Tooltip with details

### ComplianceSummaryCard (达标汇总卡片)

Summary component showing:
- Total indicators count
- Compliant count and percentage
- Non-compliant count
- Pending evaluation count
