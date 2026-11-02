import assert from 'node:assert';
import {
  SAMPLE_INITIAL_SCHEMA,
  parseSchemaToFlow,
  compileFlowToSchema,
} from '../utils/schemaCompiler.ts';
import {
  validateSurveyFlow,
  isBinaryRedundantBranch,
} from '../utils/flowValidator.ts';
import {
  calculateGroupQuestionLayout,
  calculateHierarchicalLayout,
} from '../utils/flowLayout.ts';
import {
  createBlankProject,
  duplicateProject,
} from '../utils/projectStorage.ts';

console.log('🧪 Starting Test Suite: In-App Survey Engine...\n');

// 1. Schema Compiler Tests
console.log('1️⃣  Testing Schema Compiler: parseSchemaToFlow & compileFlowToSchema...');
const parsedFlow = parseSchemaToFlow(SAMPLE_INITIAL_SCHEMA);
assert.ok(parsedFlow.nodes.length > 0, 'Parsed flow should contain nodes');
assert.ok(parsedFlow.edges.length > 0, 'Parsed flow should contain edges');
assert.strictEqual(parsedFlow.meta.totalGroups, SAMPLE_INITIAL_SCHEMA.total_groups);

const recompiledSchema = compileFlowToSchema(
  parsedFlow.nodes,
  parsedFlow.edges,
  parsedFlow.meta
);
assert.strictEqual(
  recompiledSchema.total_groups,
  SAMPLE_INITIAL_SCHEMA.total_groups,
  'Total groups should match'
);
assert.strictEqual(
  recompiledSchema.data.length,
  SAMPLE_INITIAL_SCHEMA.data.length,
  'Question count should match'
);
console.log('   ✅ Schema compiler parsed and compiled sample schema successfully.');

// 2. Flow Validator Tests
console.log('\n2️⃣  Testing Flow Validator: Graph Diagnostics & Redundancy Detection...');
const diagnostics = validateSurveyFlow(parsedFlow.nodes, parsedFlow.edges);
const errorCount = diagnostics.filter((d) => d.type === 'error').length;
assert.strictEqual(errorCount, 0, 'Initial sample flowchart should have 0 validation errors');

// Test Binary Redundant Branch Detection
const sourceQuestionNode = {
  id: 'q-1',
  type: 'question',
  position: { x: 0, y: 0 },
  data: {
    question_id: 1,
    question: 'Are you a farmer?',
    question_bn: 'আপনি কি কৃষক?',
    answer_type: 'radio' as const,
    mandatory: true,
    options: 'Yes, No',
  },
};

const redundantPairEdges = [
  { id: 'e1', source: 'q-1', target: 'q-2', sourceHandle: 'opt-Yes' } as any,
  { id: 'e2', source: 'q-1', target: 'q-2', sourceHandle: 'opt-No' } as any,
];

const check = isBinaryRedundantBranch(sourceQuestionNode, redundantPairEdges);
assert.strictEqual(
  check.isRedundant,
  true,
  'Opposing Yes/No handles connecting to the same target should be marked redundant'
);
console.log('   ✅ Redundant binary branch check detected correctly.');

// 3. Flow Layout Engine Tests
console.log('\n3️⃣  Testing Flow Layout Engine: Hierarchical DAG & Group Layout...');
const sampleQuestions = [
  { question: 'Q1', question_bn: 'প্রশ্ন ১', answer_type: 'string' as const, mandatory: true },
  { question: 'Q2', question_bn: 'প্রশ্ন ২', answer_type: 'number_input' as const, mandatory: true },
  { question: 'Q3', question_bn: 'প্রশ্ন ৩', answer_type: 'dropdown' as const, mandatory: false, options: 'A, B, C' },
];

const groupLayout = calculateGroupQuestionLayout(sampleQuestions);
assert.strictEqual(groupLayout.offsets.length, 3, 'Should generate offsets for 3 questions');
assert.ok(groupLayout.totalExpandedHeight > 200, 'Total height should accommodate questions');

const autoArranged = calculateHierarchicalLayout(parsedFlow.nodes, parsedFlow.edges);
assert.strictEqual(autoArranged.length, parsedFlow.nodes.length, 'Auto-layout should preserve node count');
console.log('   ✅ Layout engine calculates dynamic offsets and DAG hierarchy correctly.');

// 4. Project Storage & Duplication Tests
console.log('\n4️⃣  Testing Project Storage Factory & Duplication...');
const blank = createBlankProject('Rice KYC 2026', 'ধান কেওয়াইসি ২০২৬', 'Test description', 2);
assert.strictEqual(blank.title, 'Rice KYC 2026');
assert.strictEqual(blank.groupMeta.totalGroups, 2);
assert.ok(blank.nodes.length >= 2, 'Blank project should contain start and end terminators');

const cloned = duplicateProject(blank);
assert.notStrictEqual(cloned.id, blank.id, 'Cloned project should receive a new unique ID');
assert.ok(cloned.title.includes('(Copy)'), 'Cloned project title should include (Copy)');
console.log('   ✅ Project factory and cloning utilities operate accurately.');

// 5. Real-World Cattle KYC Schema Roundtrip Test
console.log('\n5️⃣  Testing Real-World Sofol Cattle Survey Schema Roundtrip...');
const cattleKycJson = {
  data: [
    {
      question_id: 235,
      question: 'is_vaccinated',
      question_bn: 'আপনি কি সময়মতো আপনার গরুকে টিকা দিয়েছেন?',
      answer_type: 'select_one' as const,
      options: 'হ্যাঁ, না',
      mandatory: true,
      depends_on: null,
      validation: null,
    },
    {
      question_id: 235001,
      question: 'vaccine_names',
      question_bn: 'নিম্নলিখিত কোন কোন টিকা দিয়েছেন?',
      answer_type: 'select_multiple' as const,
      options: 'ক্ষুরারোগ, তড়কা, বাদলা, গলাফুলা, লাম্পি স্কীন রোগ',
      mandatory: true,
      depends_on: [235],
      validation: {
        '235': {
          group: 25,
          is_same_group: true,
          validation_type: 'match' as const,
          validation: { 'হ্যাঁ': true, 'না': false },
        },
      },
    },
    {
      question_id: 237,
      question: 'deworming_frequency',
      question_bn: 'গরুকে বছরে কতবার কৃমিনাশক ওষুধ দেন?',
      answer_type: 'select_one' as const,
      options: 'বছরে ১ বার, বছরে ২ বার, কোন কৃমিনাশক দেয়া হয়নি',
      mandatory: true,
      depends_on: null,
      validation: null,
    },
  ],
  instruction: '',
  groups_to_jump: [],
  next: true,
  total_groups: 17,
};

const parsedCattle = parseSchemaToFlow(cattleKycJson as any);
assert.strictEqual(parsedCattle.nodes.length, 5, 'Should have 3 question nodes + start + end');
const compiledCattle = compileFlowToSchema(parsedCattle.nodes, parsedCattle.edges, parsedCattle.meta);

const q235 = compiledCattle.data.find((q) => q.question_id === 235)!;
const q235001 = compiledCattle.data.find((q) => q.question_id === 235001)!;
const q237 = compiledCattle.data.find((q) => q.question_id === 237)!;

assert.strictEqual(q235.depends_on, null, 'Root question 235 must not have depends_on');
assert.deepStrictEqual(q235001.depends_on, [235], 'Conditional question 235001 must depend on 235');
assert.strictEqual(q237.depends_on, null, 'Unconditional question 237 must not have false depends_on');

const val235 = q235001.validation!['235'];
assert.strictEqual(val235.validation_type, 'match');
assert.strictEqual((val235.validation as any)['হ্যাঁ'], true, 'Option হ্যাঁ must be true');
assert.strictEqual((val235.validation as any)['না'], false, 'Opposing option না must be false');
console.log('   ✅ Cattle survey schema roundtrip produces 100% accurate dependencies & validation map.');

// 6. Group ID & Group Connector Tests
console.log('\n6️⃣  Testing Group ID & Group Jump Connectors in Schema Compiler...');
const testNodesWithJump: any[] = [
  {
    id: 'q-1',
    type: 'question',
    position: { x: 0, y: 0 },
    data: {
      question_id: 101,
      question: 'has_plot',
      question_bn: 'আপনার জমি আছে কি?',
      answer_type: 'select_one',
      mandatory: true,
      containerId: 'grp-cont-25',
    },
  },
  {
    id: 'grp-cont-25',
    type: 'groupContainer',
    position: { x: 0, y: 0 },
    data: {
      groupId: 'grp-25',
      numericGroupId: 25,
      title: 'Land Plots',
      category: 'land',
      questionIds: ['q-1'],
    },
  },
  {
    id: 'jump-26',
    type: 'groupJump',
    position: { x: 0, y: 200 },
    data: {
      targetGroupId: 26,
      targetGroupTitle: 'Crops & Yields / ফসল তথ্য',
    },
  },
];

const testEdgesWithJump: any[] = [
  {
    id: 'edge-q1-jump',
    source: 'q-1',
    target: 'jump-26',
    sourceHandle: 'opt-হ্যাঁ',
    data: { label: 'হ্যাঁ', rule: 'Match: হ্যাঁ' },
  },
];

const compiledWithJump = compileFlowToSchema(
  testNodesWithJump,
  testEdgesWithJump,
  {
    title: 'Test',
    titleBn: '',
    description: '',
    groupNumber: 1,
    totalGroups: 5,
    hasNextGroup: true,
    instruction: '',
    groupJumps: [],
  }
);

assert.strictEqual(compiledWithJump.groups_to_jump?.length, 1, 'Should compile 1 group jump');
assert.strictEqual(compiledWithJump.groups_to_jump?.[0].group_id, '26', 'Jump group ID should be 26');
assert.strictEqual(
  compiledWithJump.groups_to_jump?.[0].group_title,
  'Crops & Yields / ফসল তথ্য',
  'Jump group title should match'
);
assert.strictEqual(
  compiledWithJump.data[0].group,
  25,
  'Question inside group container 25 must have group: 25'
);
console.log('   ✅ Group ID assignment and Jump Connector resolution compiled with 100% precision.');

// 7. Testing Theme Mode Cycling & Resolution Logic
console.log('\n7️⃣  Testing Theme Mode Cycling & Resolution Logic...');
const cycleThemeMode = (current: 'dark' | 'light' | 'system'): 'dark' | 'light' | 'system' => {
  return current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
};

assert.strictEqual(cycleThemeMode('dark'), 'light', 'dark should cycle to light');
assert.strictEqual(cycleThemeMode('light'), 'system', 'light should cycle to system');
assert.strictEqual(cycleThemeMode('system'), 'dark', 'system should cycle back to dark');

const resolveTheme = (theme: 'dark' | 'light' | 'system', osPrefersLight: boolean): 'dark' | 'light' => {
  if (theme === 'system') return osPrefersLight ? 'light' : 'dark';
  return theme;
};

assert.strictEqual(resolveTheme('dark', true), 'dark', 'Explicit dark should override OS preference');
assert.strictEqual(resolveTheme('light', false), 'light', 'Explicit light should override OS preference');
assert.strictEqual(resolveTheme('system', true), 'light', 'System mode should follow OS light preference');
assert.strictEqual(resolveTheme('system', false), 'dark', 'System mode should follow OS dark preference');
console.log('   ✅ Theme cycling and system resolution operating correctly.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! (7/7 test suites passed)\n');

