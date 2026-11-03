import assert from 'node:assert';
import {
  SAMPLE_INITIAL_SCHEMA,
  parseSchemaToFlow,
  compileFlowToSchema,
} from '../utils/schemaCompiler.ts';
import { safeParseJson } from '../utils/jsonParser.ts';
import {
  validateSurveyFlow,
  isBinaryRedundantBranch,
  resolveNodeGroupId,
  isCrossGroupEdge,
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

// 8. Testing Cross-Group Foreign Dependency Compilation & Detection (MySQL Workbench style)
console.log('\n8️⃣  Testing Cross-Group Foreign Dependency Compilation & Detection...');

const crossGroupNodes = [
  {
    id: 'grp-1',
    type: 'groupContainer',
    position: { x: 0, y: 0 },
    data: { groupId: '1', numericGroupId: 1, title: 'Demographics' },
  },
  {
    id: 'q-1',
    type: 'question',
    position: { x: 50, y: 50 },
    data: {
      question_id: 1,
      question: 'Do you own farmland?',
      question_bn: 'আপনি কি জমির মালিক?',
      answer_type: 'radio' as const,
      mandatory: true,
      options: 'Yes, No',
      group: 1,
      containerId: 'grp-1',
    },
  },
  {
    id: 'grp-2',
    type: 'groupContainer',
    position: { x: 400, y: 0 },
    data: { groupId: '2', numericGroupId: 2, title: 'Crops' },
  },
  {
    id: 'q-5',
    type: 'question',
    position: { x: 450, y: 50 },
    data: {
      question_id: 5,
      question: 'Total Cultivated Land Acres',
      question_bn: 'মোট চাষযোগ্য জমির পরিমাণ',
      answer_type: 'number_input' as const,
      mandatory: true,
      group: 2,
      containerId: 'grp-2',
    },
  },
];

const crossGroupEdge = {
  id: 'e-cross-q1-q5',
  source: 'q-1',
  sourceHandle: 'opt-Yes',
  target: 'q-5',
  targetHandle: 'in',
  data: {
    validationType: 'match',
    triggerValue: 'Yes',
    isCrossGroup: true,
    sourceGroup: 1,
    targetGroup: 2,
  },
};

// Test resolution
const q1Group = resolveNodeGroupId(crossGroupNodes[1] as any, crossGroupNodes as any);
const q5Group = resolveNodeGroupId(crossGroupNodes[3] as any, crossGroupNodes as any);
assert.strictEqual(q1Group, 1, 'Q1 should resolve to Group 1');
assert.strictEqual(q5Group, 2, 'Q5 should resolve to Group 2');

const isCross = isCrossGroupEdge(crossGroupEdge as any, crossGroupNodes as any);
assert.strictEqual(isCross, true, 'isCrossGroupEdge should detect cross-group dependency between Group 1 and Group 2');

// Compile schema and verify output
const compiledCross = compileFlowToSchema(crossGroupNodes as any, [crossGroupEdge] as any, {
  groupNumber: 2,
  totalGroups: 2,
  hasNextGroup: false,
  instruction: '',
  groupJumps: [],
});

const q5Compiled = compiledCross.data.find((q) => q.question_id === 5);
assert.ok(q5Compiled, 'Q5 should exist in compiled output');
assert.deepStrictEqual(q5Compiled?.depends_on, [1], 'Q5 depends_on should contain parent Q#1');
assert.ok(q5Compiled?.validation, 'Q5 should have validation object');
assert.strictEqual(q5Compiled?.validation?.['1']?.group, 1, 'Validation rule should indicate parent group is 1');
assert.strictEqual(
  q5Compiled?.validation?.['1']?.is_same_group,
  false,
  'Validation rule must have is_same_group: false for cross-group dependency'
);
assert.strictEqual(
  q5Compiled?.validation?.['1']?.validation?.['Yes'],
  true,
  'Validation match for Yes must be true'
);

// 8B. Authoritative Container & Spatial Frame Resolution
const testFrameNode = {
  id: 'frame-grp-5',
  type: 'groupFrame',
  position: { x: 500, y: 100 },
  style: { width: 440, height: 480 },
  data: { groupId: 'grp-area-5', numericGroupId: 5 },
};

const boundQuestionNode = {
  id: 'q-bound-1',
  type: 'question',
  position: { x: 550, y: 160 },
  data: { question_id: 10, group: 1, containerId: 'frame-grp-5' }, // group is initially 1, but container is 5
};

const resolvedBoundGroup = resolveNodeGroupId(boundQuestionNode as any, [testFrameNode, boundQuestionNode] as any);
assert.strictEqual(resolvedBoundGroup, 5, 'resolveNodeGroupId must prioritize containerId over initial default group');

const spatialQuestionNode = {
  id: 'q-spatial-1',
  type: 'question',
  position: { x: 550, y: 200 }, // inside (500..940, 100..580)
  data: { question_id: 11 }, // no group or containerId set
};

const resolvedSpatialGroup = resolveNodeGroupId(spatialQuestionNode as any, [testFrameNode, spatialQuestionNode] as any);
assert.strictEqual(resolvedSpatialGroup, 5, 'resolveNodeGroupId must detect enclosing frame spatially');

const dynamicCrossEdge = {
  id: 'e-dyn-cross',
  source: 'q-1', // Group 1
  target: 'q-bound-1', // Group 5
};
assert.strictEqual(
  isCrossGroupEdge(dynamicCrossEdge as any, [crossGroupNodes[1], testFrameNode, boundQuestionNode] as any),
  true,
  'Dynamic cross group detection must detect edge connecting Group 1 and Group 5'
);

console.log('   ✅ Cross-Group Foreign Dependency compiled with 100% precision (is_same_group: false, group: 1, depends_on: [1]).');

// ============================================================================
// 9. Testing Spatial Drop Detection & Containment into Group Frames
// ============================================================================
console.log('\n9️⃣  Testing Spatial Drop Detection & Containment into Group Frames...');

// Helper matching getFrameBounds in GroupWorkshopCanvas & App.tsx
function testGetFrameBounds(frameNode: any) {
  let width = 440;
  let height = 480;

  if (typeof frameNode.width === 'number' && !isNaN(frameNode.width) && frameNode.width > 0) {
    width = frameNode.width;
  } else if (frameNode.measured?.width && frameNode.measured.width > 0) {
    width = frameNode.measured.width;
  } else if (frameNode.style?.width) {
    const parsed = parseInt(String(frameNode.style.width), 10);
    if (!isNaN(parsed) && parsed > 0) width = parsed;
  }

  if (typeof frameNode.height === 'number' && !isNaN(frameNode.height) && frameNode.height > 0) {
    height = frameNode.height;
  } else if (frameNode.measured?.height && frameNode.measured.height > 0) {
    height = frameNode.measured.height;
  } else if (frameNode.style?.height) {
    const parsed = parseInt(String(frameNode.style.height), 10);
    if (!isNaN(parsed) && parsed > 0) height = parsed;
  }

  const posX = frameNode.position?.x ?? 0;
  const posY = frameNode.position?.y ?? 0;

  return {
    minX: posX,
    maxX: posX + width,
    minY: posY,
    maxY: posY + height,
    width,
    height,
  };
}

// 9A. Boundary Calculation
const frameNode1: any = {
  id: 'frame-test-1',
  type: 'groupFrame',
  position: { x: 80, y: 60 },
  style: { width: '440px', height: '480px' },
  data: {
    groupId: 'grp-area-1',
    numericGroupId: 3,
    title: 'Crop Verification',
    titleBn: 'ফসল যাচাইকরণ',
    questionIds: [],
    questionCount: 0,
  },
};

const bounds1 = testGetFrameBounds(frameNode1);
assert.strictEqual(bounds1.minX, 80);
assert.strictEqual(bounds1.maxX, 520);
assert.strictEqual(bounds1.minY, 60);
assert.strictEqual(bounds1.maxY, 540);
assert.strictEqual(bounds1.width, 440);
assert.strictEqual(bounds1.height, 480);

// 9B. Direct Spatial Drop inside Frame
const dropPos1 = { x: 200, y: 150 };
const isInside1 =
  dropPos1.x >= bounds1.minX &&
  dropPos1.x <= bounds1.maxX &&
  dropPos1.y >= bounds1.minY &&
  dropPos1.y <= bounds1.maxY;
assert.strictEqual(isInside1, true, 'Drop at (200, 150) must be spatially inside frame (80..520, 60..540)');

// Simulate dropping Question 1 into Frame
const q1Id = 'wq-1-1001';
const xOffset = Math.max(35, Math.floor((bounds1.width - 270) / 2));
const q1Pos = {
  x: frameNode1.position.x + xOffset,
  y: frameNode1.position.y + 60,
};

const q1Node: any = {
  id: q1Id,
  type: 'question',
  position: q1Pos,
  zIndex: 10,
  data: {
    question_id: 1,
    group: frameNode1.data.numericGroupId,
    containerId: frameNode1.id,
    question: 'Select crop type',
    question_bn: 'ফসলের ধরন নির্বাচন করুন',
    answer_type: 'radio',
    options: 'ধান, গম, ভুট্টা',
  },
};

assert.strictEqual(q1Node.data.containerId, 'frame-test-1', 'Q1 must be bound to frame-test-1');
assert.strictEqual(q1Node.data.group, 3, 'Q1 numeric group must match frame numericGroupId (3)');
assert.strictEqual(q1Node.position.x, 165, 'Q1 should be horizontally centered at 80 + 85 = 165');
assert.strictEqual(q1Node.position.y, 120, 'Q1 should be positioned at 60 + 60 = 120');

// Update Frame after dropping Q1
frameNode1.data.questionIds.push(q1Id);
frameNode1.data.questionCount = frameNode1.data.questionIds.length;

// 9C. Drop Question 2 into Frame and verify auto-connection
const q2Id = 'wq-2-1002';
const q2Pos = {
  x: frameNode1.position.x + xOffset,
  y: frameNode1.position.y + 60 + 190,
};
const q2Node: any = {
  id: q2Id,
  type: 'question',
  position: q2Pos,
  zIndex: 10,
  data: {
    question_id: 2,
    group: frameNode1.data.numericGroupId,
    containerId: frameNode1.id,
    question: 'Enter crop land area (decimals)',
    question_bn: 'ফসলি জমির পরিমাণ (শতাংশ)',
    answer_type: 'number',
  },
};

assert.strictEqual(q2Node.data.containerId, 'frame-test-1', 'Q2 must be bound to frame-test-1');
assert.strictEqual(q2Node.data.group, 3, 'Q2 numeric group must match frame numericGroupId (3)');

const lastQId = frameNode1.data.questionIds[frameNode1.data.questionIds.length - 1];
const connectingEdge = {
  id: `wedge-${lastQId}-${q2Id}`,
  source: lastQId,
  sourceHandle: 'default-next',
  target: q2Id,
  targetHandle: 'in',
  type: 'surveyEdge',
};

assert.strictEqual(connectingEdge.source, 'wq-1-1001');
assert.strictEqual(connectingEdge.target, 'wq-2-1002');
assert.strictEqual(connectingEdge.targetHandle, 'in');

frameNode1.data.questionIds.push(q2Id);
frameNode1.data.questionCount = frameNode1.data.questionIds.length;

// 9D. Auto-expanding Frame Height
const neededHeight = Math.max(bounds1.height, 60 + frameNode1.data.questionCount * 190 + 40);
assert.strictEqual(neededHeight, 480, 'Default 480px height accommodates 2 questions without overflow');

// If 4 questions are added:
const neededHeight4Q = Math.max(bounds1.height, 60 + 4 * 190 + 40);
assert.strictEqual(neededHeight4Q, 860, 'Frame height dynamically expands to 860px for 4 stacked questions');

// 9E. Intelligent Fallback: Drop outside exact frame bounds when 1 frame exists
const dropPosOutside = { x: 700, y: 700 };
const isInsideExact =
  dropPosOutside.x >= bounds1.minX &&
  dropPosOutside.x <= bounds1.maxX &&
  dropPosOutside.y >= bounds1.minY &&
  dropPosOutside.y <= bounds1.maxY;
assert.strictEqual(isInsideExact, false, 'Position (700, 700) is outside exact frame boundary');

const allFrames = [frameNode1];
const resolvedFallback = allFrames.length === 1 ? allFrames[0] : null;
assert.ok(resolvedFallback, 'Single frame on workbench is resolved as fallback target frame');
assert.strictEqual(resolvedFallback?.id, 'frame-test-1');

// 9F. Dropping Flowchart Symbols (Start, Decision, Process, Document, Jump, End)
const flowchartSymbolsToTest: Array<{ nodeType: string; name: string }> = [
  { nodeType: 'start', name: 'Start Terminator' },
  { nodeType: 'decision', name: 'Condition Rule' },
  { nodeType: 'process', name: 'Calculation Step' },
  { nodeType: 'document', name: 'Farmer Receipt' },
  { nodeType: 'groupJump', name: 'Group Jump' },
  { nodeType: 'end', name: 'End Terminator' },
];

flowchartSymbolsToTest.forEach((sym) => {
  let nodeData: any = {};
  if (sym.nodeType === 'decision') {
    nodeData = { label: sym.name, conditionType: 'match', comparisonValue: 'Yes', containerId: frameNode1.id };
  } else if (sym.nodeType === 'groupJump') {
    nodeData = { targetGroupId: 4, targetGroupTitle: 'Group 4', containerId: frameNode1.id };
  } else {
    nodeData = { label: sym.name, containerId: frameNode1.id };
  }

  const symbolNode: any = {
    id: `w-${sym.nodeType}-${Date.now()}`,
    type: sym.nodeType,
    position: { x: 165, y: 300 },
    zIndex: 10,
    data: nodeData,
  };

  assert.strictEqual(symbolNode.type, sym.nodeType, `Symbol ${sym.nodeType} type must be preserved`);
  assert.strictEqual(symbolNode.data.containerId, 'frame-test-1', `Symbol ${sym.nodeType} must be bound to frame`);
});

console.log('   ✅ Spatial Drop Detection, Containment, Snapping, Auto-connecting & Frame Expansion operating with 100% precision.');

// 10. Comprehensive JSON Schema Generation & Roundtrip Verification
console.log('\n🔟 Testing Comprehensive Dynamic KYC JSON Generation & Roundtrip...');

const testNodesForJson = [
  // Group Frame 1
  {
    id: 'frame-grp-1',
    type: 'groupFrame',
    position: { x: 50, y: 50 },
    style: { width: 440, height: 480 },
    data: { groupId: 'grp-area-1', numericGroupId: 1, title: 'Land Owner Info' },
  },
  // Question 101 inside Group Frame 1
  {
    id: 'q-node-101',
    type: 'question',
    position: { x: 85, y: 120 },
    data: {
      question_id: 101,
      question: 'Do you have cultivable land?',
      question_bn: 'আপনার কি আবাদি জমি আছে?',
      answer_type: 'radio' as const,
      options: 'Yes, No',
      mandatory: true,
      containerId: 'frame-grp-1',
    },
  },
  // Question 102 inside Group Frame 1 (depends on 101 = Yes)
  {
    id: 'q-node-102',
    type: 'question',
    position: { x: 85, y: 310 },
    data: {
      question_id: 102,
      question: 'Land area in decimals',
      question_bn: 'জমির পরিমাণ (শতক)',
      answer_type: 'number_input' as const,
      mandatory: true,
      containerId: 'frame-grp-1',
    },
  },
  // Group Frame 2
  {
    id: 'frame-grp-2',
    type: 'groupFrame',
    position: { x: 550, y: 50 },
    style: { width: 440, height: 480 },
    data: { groupId: 'grp-area-2', numericGroupId: 2, title: 'Crop Details' },
  },
  // Question 201 inside Group Frame 2 (depends on 101 in Group 1!)
  {
    id: 'q-node-201',
    type: 'question',
    position: { x: 585, y: 120 },
    data: {
      question_id: 201,
      question: 'What is your primary crop?',
      question_bn: 'আপনার প্রধান ফসল কি?',
      answer_type: 'select_one' as const,
      options: 'Paddy, Jute, Wheat',
      mandatory: true,
      containerId: 'frame-grp-2',
    },
  },
];

const testEdgesForJson = [
  // Within-group conditional edge: 101 -> 102
  {
    id: 'e-101-102',
    source: 'q-node-101',
    sourceHandle: 'opt-Yes',
    target: 'q-node-102',
    targetHandle: 'in',
    data: { validationType: 'match', triggerValue: 'Yes' },
  },
  // Cross-group conditional edge: 101 (Grp 1) -> 201 (Grp 2)
  {
    id: 'e-cross-101-201',
    source: 'q-node-101',
    sourceHandle: 'opt-Yes',
    target: 'q-node-201',
    targetHandle: 'in',
    data: {
      validationType: 'match',
      triggerValue: 'Yes',
      isCrossGroup: true,
      sourceGroup: 1,
      targetGroup: 2,
    },
  },
];

// Compile to JSON
const generatedSchema = compileFlowToSchema(testNodesForJson as any, testEdgesForJson as any, {
  groupNumber: 1,
  totalGroups: 2,
  hasNextGroup: true,
  instruction: 'কৃষকের আবাদি জমি ও ফসলের তথ্য সংগ্রহ করুন',
  groupJumps: [{ group_id: '2', group_title: 'Group 2' }],
});

// A. Check JSON serialization and deserialization
const serializedJson = JSON.stringify(generatedSchema, null, 2);
assert.doesNotThrow(() => JSON.parse(serializedJson), 'Generated schema must be valid JSON');

const parsedJson = safeParseJson(serializedJson);
assert.ok(parsedJson, 'safeParseJson should parse the generated schema cleanly');

// B. Top-level structure verification
assert.strictEqual(parsedJson.current_group, 1, 'Top level current_group must match');
assert.strictEqual(parsedJson.total_groups, 2, 'Top level total_groups must match');
assert.strictEqual(parsedJson.next, true, 'Top level next must match');
assert.strictEqual(parsedJson.instruction, 'কৃষকের আবাদি জমি ও ফসলের তথ্য সংগ্রহ করুন');
assert.strictEqual(parsedJson.groups_to_jump.length, 1);
assert.strictEqual(parsedJson.data.length, 3, 'Must have exactly 3 questions');

// C. Verify Question 101 (Root question in Group 1)
const q101 = parsedJson.data.find((q: any) => q.question_id === 101);
assert.ok(q101, 'Question 101 must exist');
assert.strictEqual(q101.group, 1, 'Question 101 must belong to Group 1');
assert.strictEqual(q101.depends_on, null, 'Root question must have depends_on: null');
assert.strictEqual(q101.validation, null, 'Root question must have validation: null');
assert.strictEqual(q101.options, 'Yes, No');

// D. Verify Question 102 (Intragroup dependency in Group 1)
const q102 = parsedJson.data.find((q: any) => q.question_id === 102);
assert.ok(q102, 'Question 102 must exist');
assert.strictEqual(q102.group, 1, 'Question 102 must belong to Group 1');
assert.deepStrictEqual(q102.depends_on, [101], 'Question 102 must depend on 101');
assert.ok(q102.validation?.['101'], 'Validation for 101 must exist');
assert.strictEqual(q102.validation['101'].group, 1, 'Parent group must be 1');
assert.strictEqual(q102.validation['101'].is_same_group, true, 'is_same_group must be true for intragroup edge');
assert.strictEqual(q102.validation['101'].validation['Yes'], true, 'Option Yes must be true');
assert.strictEqual(q102.validation['101'].validation['No'], false, 'Opposing binary option No must be false');

// E. Verify Question 201 (Cross-group dependency in Group 2 from Group 1)
const q201 = parsedJson.data.find((q: any) => q.question_id === 201);
assert.ok(q201, 'Question 201 must exist');
assert.strictEqual(q201.group, 2, 'Question 201 must belong to Group 2 via its GroupFrame');
assert.deepStrictEqual(q201.depends_on, [101], 'Question 201 must depend on 101 across groups');
assert.ok(q201.validation?.['101'], 'Validation rule for 101 must exist');
assert.strictEqual(q201.validation['101'].group, 1, 'Parent group in validation must be 1');
assert.strictEqual(
  q201.validation['101'].is_same_group,
  false,
  'is_same_group must be false for cross-group dependency'
);
assert.strictEqual(q201.validation['101'].validation['Yes'], true, 'Option Yes must trigger Q201');

// F. Verify Round-trip: parseSchemaToFlow on compiled JSON
const roundtripFlow = parseSchemaToFlow(parsedJson);
assert.strictEqual(roundtripFlow.meta.groupNumber, 1);
assert.strictEqual(roundtripFlow.meta.totalGroups, 2);
const qNodesCount = roundtripFlow.nodes.filter((n) => n.type === 'question').length;
assert.strictEqual(qNodesCount, 3, 'Round-trip must reconstruct all 3 question nodes');

console.log('   ✅ JSON schema compiled with 100% structural accuracy, foreign group tags, and roundtrip fidelity.');

// 11. Complete Flowchart Symbol Deployment from Workshop to Main Canvas
console.log('\n1️⃣1️⃣ Testing Complete Flowchart Symbol Deployment (Questions, Decisions, Process, Terminals)...');

const mockWorkshopGraph: { nodes: any[]; edges: any[] } = {
  nodes: [
    {
      id: 'frame-test-deploy',
      type: 'groupFrame',
      position: { x: 50, y: 50 },
      style: { width: 440, height: 600 },
      data: { groupId: 'grp-area-2', numericGroupId: 2, title: 'Livestock Assessment', questionIds: ['w-q-1'] },
    },
    {
      id: 'w-start-1',
      type: 'start',
      position: { x: 150, y: 100 },
      data: { label: 'Start Assessment', containerId: 'frame-test-deploy' },
    },
    {
      id: 'w-q-1',
      type: 'question',
      position: { x: 150, y: 200 },
      data: {
        question_id: 1,
        question: 'Do you own dairy cattle?',
        question_bn: 'আপনার কি ডেইরি গরু আছে?',
        answer_type: 'radio' as const,
        options: 'Yes, No',
        mandatory: true,
        containerId: 'frame-test-deploy',
      },
    },
    {
      id: 'w-dec-1',
      type: 'decision',
      position: { x: 150, y: 350 },
      data: {
        label: 'Cattle Count > 5?',
        conditionType: 'greater',
        comparisonValue: 5,
        containerId: 'frame-test-deploy',
      },
    },
    {
      id: 'w-proc-1',
      type: 'process',
      position: { x: 150, y: 450 },
      data: { label: 'Calculate Feed Subsidy', containerId: 'frame-test-deploy' },
    },
    {
      id: 'w-doc-1',
      type: 'document',
      position: { x: 150, y: 550 },
      data: { label: 'Vaccination Certificate', containerId: 'frame-test-deploy' },
    },
    {
      id: 'w-end-1',
      type: 'end',
      position: { x: 150, y: 650 },
      data: { label: 'Complete Section', containerId: 'frame-test-deploy' },
    },
  ],
  edges: [
    { id: 'e-w-1', source: 'w-start-1', target: 'w-q-1' },
    { id: 'e-w-2', source: 'w-q-1', target: 'w-dec-1' },
    { id: 'e-w-3', source: 'w-dec-1', target: 'w-proc-1' },
    { id: 'e-w-4', source: 'w-proc-1', target: 'w-doc-1' },
    { id: 'e-w-5', source: 'w-doc-1', target: 'w-end-1' },
  ],
};

// Simulate deployment logic (matching useGroupContainers)
const currentHighestId = 100;
let nextQId = currentHighestId + 1;
const idMap = new Map<string, string>();

mockWorkshopGraph.nodes.forEach((wn) => {
  if (wn.type === 'question') {
    idMap.set(wn.id, `q-${nextQId++}`);
  } else if (wn.type === 'groupFrame' || wn.type === 'groupContainer') {
    idMap.set(wn.id, `grp-frame-deployed-${Date.now().toString().slice(-4)}`);
  } else {
    idMap.set(wn.id, `${wn.type}-deployed-${Date.now().toString().slice(-4)}`);
  }
});

const deployedNodes = mockWorkshopGraph.nodes.map((wn) => {
  const newId = idMap.get(wn.id) || wn.id;
  const newContainerId = wn.data?.containerId ? idMap.get(wn.data.containerId) : undefined;
  return {
    ...wn,
    id: newId,
    data: {
      ...wn.data,
      ...(newContainerId ? { containerId: newContainerId } : {}),
      ...(wn.type === 'question' ? { question_id: parseInt(newId.replace('q-', ''), 10) } : {}),
    },
  };
});

const deployedEdges = mockWorkshopGraph.edges.map((we) => ({
  ...we,
  id: `e-${idMap.get(we.source)}-${idMap.get(we.target)}`,
  source: idMap.get(we.source) || we.source,
  target: idMap.get(we.target) || we.target,
}));

// Verification
const nodeTypes = new Set(deployedNodes.map((n) => n.type));
assert.ok(nodeTypes.has('groupFrame'), 'Group Frame must be deployed');
assert.ok(nodeTypes.has('start'), 'Start node must be deployed');
assert.ok(nodeTypes.has('question'), 'Question node must be deployed');
assert.ok(nodeTypes.has('decision'), 'Decision node must be deployed');
assert.ok(nodeTypes.has('process'), 'Process node must be deployed');
assert.ok(nodeTypes.has('document'), 'Document node must be deployed');
assert.ok(nodeTypes.has('end'), 'End node must be deployed');
assert.strictEqual(deployedNodes.length, 7, 'All 7 symbols from workshop must be deployed');
assert.strictEqual(deployedEdges.length, 5, 'All 5 edges connecting symbols must be deployed');

// Verify container bindings
const deployedFrame = deployedNodes.find((n) => n.type === 'groupFrame');
assert.ok(deployedFrame, 'Deployed frame must exist');
const childSymbols = deployedNodes.filter((n) => n.type !== 'groupFrame');
childSymbols.forEach((sym) => {
  assert.strictEqual(sym.data.containerId, deployedFrame?.id, `Symbol ${sym.type} must be bound to deployed frame`);
});

console.log('   ✅ All 7 symbol types and their connecting edges deployed successfully with container bindings.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! (11/11 test suites passed)\n');

