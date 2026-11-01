import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type {
  DynamicKycGroupResponse,
  DynamicKycQuestion,
  QuestionNodeData,
  DecisionNodeData,
  GroupJumpNodeData,
  ValidationConfig,
} from '../types/survey';

export interface GroupMeta {
  groupNumber: number;
  totalGroups: number;
  hasNextGroup: boolean;
  instruction: string;
  groupJumps: { group_id: string; group_title: string }[];
}

/**
 * Compiles a React Flow visual node-edge graph into the exact Sofol Dynamic KYC Group JSON.
 */
export function compileFlowToSchema(
  nodes: Node[],
  edges: Edge[],
  meta: GroupMeta
): DynamicKycGroupResponse {
  const questionNodes = nodes.filter((n) => n.type === 'question');
  const jumpNodes = nodes.filter((n) => n.type === 'groupJump');

  const questions: DynamicKycQuestion[] = [];

  // Sort nodes by vertical position (Y) to keep a logical top-to-bottom order
  const sortedQuestionNodes = [...questionNodes].sort(
    (a, b) => a.position.y - b.position.y
  );

  for (const qNode of sortedQuestionNodes) {
    const data = qNode.data as unknown as QuestionNodeData;
    const qId = data.question_id;

    const dependsOn: number[] = [];
    const validationMap: Record<string, ValidationConfig> = {};

    // Find incoming edges directly or through decision nodes
    const incomingEdges = edges.filter((e) => e.target === qNode.id);

    for (const inEdge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === inEdge.source);
      if (!sourceNode) continue;

      if (sourceNode.type === 'question') {
        const parentData = sourceNode.data as unknown as QuestionNodeData;
        const parentId = parentData.question_id;
        if (!dependsOn.includes(parentId)) {
          dependsOn.push(parentId);
        }

        // Check if edge carries condition metadata or was connected to a specific option port
        const edgeData = inEdge.data as { validationType?: string; triggerValue?: any } | undefined;
        let optFromHandle: string | null = null;
        if (inEdge.sourceHandle && inEdge.sourceHandle.startsWith('opt-')) {
          optFromHandle = decodeURIComponent(inEdge.sourceHandle.replace('opt-', ''));
        }

        if (optFromHandle) {
          const parentKey = String(parentId);
          const existing = validationMap[parentKey];
          let matches: Record<string, boolean> = {};
          if (
            existing &&
            existing.validation_type === 'match' &&
            typeof existing.validation === 'object' &&
            !Array.isArray(existing.validation)
          ) {
            matches = { ...(existing.validation as Record<string, boolean>) };
          }
          matches[optFromHandle] = true;
          validationMap[parentKey] = {
            validation_type: 'match',
            validation: matches,
          };
        } else if (edgeData?.validationType && edgeData.triggerValue !== undefined) {
          const vType = edgeData.validationType as 'match' | 'greater' | 'less';
          const parentKey = String(parentId);
          if (vType === 'match') {
            const existing = validationMap[parentKey];
            let matches: Record<string, boolean> = {};
            if (
              existing &&
              existing.validation_type === 'match' &&
              typeof existing.validation === 'object' &&
              !Array.isArray(existing.validation)
            ) {
              matches = { ...(existing.validation as Record<string, boolean>) };
            }
            matches[String(edgeData.triggerValue)] = true;
            validationMap[parentKey] = {
              validation_type: 'match',
              validation: matches,
            };
          } else {
            validationMap[String(parentId)] = {
              validation_type: vType,
              validation: Number(edgeData.triggerValue) || 0,
            };
          }
        }
      } else if (sourceNode.type === 'decision') {
        const decData = sourceNode.data as unknown as DecisionNodeData;
        // Trace back who points to this decision node
        const decisionIncoming = edges.filter((e) => e.target === sourceNode.id);
        for (const decInEdge of decisionIncoming) {
          const parentQuestionNode = nodes.find((n) => n.id === decInEdge.source && n.type === 'question');
          if (parentQuestionNode) {
            const parentData = parentQuestionNode.data as unknown as QuestionNodeData;
            const parentId = parentData.question_id;
            if (!dependsOn.includes(parentId)) {
              dependsOn.push(parentId);
            }

            if (decData.conditionType === 'match') {
              const matches: Record<string, boolean> = {};
              matches[String(decData.comparisonValue)] = true;
              validationMap[String(parentId)] = {
                validation_type: 'match',
                validation: matches,
              };
            } else {
              validationMap[String(parentId)] = {
                validation_type: decData.conditionType,
                validation: Number(decData.comparisonValue) || 0,
              };
            }
          }
        }
      }
    }

    const qItem: DynamicKycQuestion = {
      question_id: qId,
      question: data.question || 'Untitled Question',
      question_bn: data.question_bn || data.question || 'প্রশ্ন',
      answer_type: data.answer_type || 'string',
      mandatory: data.mandatory ?? true,
      editable: data.editable ?? true,
      placeholder: data.placeholder || '',
      hint: data.hint || '',
      options: data.options || '',
      value: data.value || '',
    };

    if (dependsOn.length > 0) {
      qItem.depends_on = dependsOn;
    }
    if (Object.keys(validationMap).length > 0) {
      qItem.validation = validationMap;
    }

    questions.push(qItem);
  }

  // Group jumps list
  const groupJumps = [...meta.groupJumps];
  for (const jNode of jumpNodes) {
    const jData = jNode.data as unknown as GroupJumpNodeData;
    if (jData.targetGroupId) {
      const gIdStr = String(jData.targetGroupId);
      if (!groupJumps.some((g) => g.group_id === gIdStr)) {
        groupJumps.push({
          group_id: gIdStr,
          group_title: jData.targetGroupTitle || `Group ${gIdStr}`,
        });
      }
    }
  }

  return {
    current_group: meta.groupNumber,
    total_groups: meta.totalGroups,
    next: meta.hasNextGroup,
    instruction: meta.instruction,
    data: questions,
    groups: groupJumps.length > 0 ? groupJumps : undefined,
  };
}

/**
 * Sample Initial Schema: Representative of Sofol's Dynamic Loan Assessment Form (Group 1)
 */
export const SAMPLE_INITIAL_SCHEMA: DynamicKycGroupResponse = {
  current_group: 1,
  total_groups: 3,
  next: true,
  instruction: 'কৃষকের আবাদি জমি ও আয়ের প্রাথমিক তথ্য যাচাই করুন।',
  groups: [
    { group_id: '2', group_title: '2: কৃষি প্রকল্প ও সম্পদ তথ্য' },
    { group_id: '3', group_title: '3: ঋণ পরিশোধ ও জামানত বিবরণ' },
  ],
  data: [
    {
      question_id: 101,
      question: 'Do you own cultivating land?',
      question_bn: 'আপনার কি নিজস্ব আবাদি জমি আছে?',
      answer_type: 'select_one',
      mandatory: true,
      options: 'হ্যাঁ (Yes), না (No)',
      placeholder: 'নির্বাচন করুন',
      hint: 'মালিকানাধীন বা লিজকৃত জমির তথ্য',
    },
    {
      question_id: 102,
      question: 'Total Land Size (Decimals)',
      question_bn: 'মোট জমির পরিমাণ (শতাংশ)',
      answer_type: 'integer',
      mandatory: true,
      placeholder: 'যেমন: ৫০',
      hint: 'সর্বমোট আবাদযোগ্য জমির পরিমাণ শতাংশে লিখুন',
      depends_on: [101],
      validation: {
        '101': {
          validation_type: 'match',
          validation: { 'হ্যাঁ (Yes)': true },
        },
      },
    },
    {
      question_id: 103,
      question: 'Primary Crop Type',
      question_bn: 'প্রধান ফসলের ধরন',
      answer_type: 'dropdown',
      mandatory: true,
      options: 'ধান, ভুট্টা, আলু, সবজি, মাছ চাষ',
      placeholder: 'ফসল নির্বাচন করুন',
      hint: 'যে ফসল সবচেয়ে বেশি চাষ করা হয়',
      depends_on: [101],
      validation: {
        '101': {
          validation_type: 'match',
          validation: { 'হ্যাঁ (Yes)': true },
        },
      },
    },
    {
      question_id: 104,
      question: 'Estimated Monthly Farm Income (BDT)',
      question_bn: 'আনুমানিক মাসিক কৃষি আয় (টাকা)',
      answer_type: 'integer',
      mandatory: true,
      placeholder: 'যেমন: ২৫০০০',
      hint: 'গড় মাসিক কৃষি আয় লিখুন',
    },
    {
      question_id: 105,
      question: 'Farm Geo-tagged Picture',
      question_bn: 'খামারের ছবি (লোকেশনসহ)',
      answer_type: 'image',
      mandatory: true,
      hint: 'ক্যামেরা দিয়ে সরাসরি খামার বা ফসলের ছবি তুলুন',
    },
  ],
};

/**
 * Converts a Dynamic KYC JSON schema into React Flow visual nodes & edges.
 */
export function parseSchemaToFlow(schema: DynamicKycGroupResponse | any[] | any): {
  nodes: Node[];
  edges: Edge[];
  meta: GroupMeta;
} {
  // Normalize schema input if raw array or wrapped object passed
  let rawQuestions: any[] = [];
  let metaRaw: any = {};

  if (Array.isArray(schema)) {
    rawQuestions = schema;
  } else if (schema && typeof schema === 'object') {
    if (Array.isArray(schema.data)) {
      rawQuestions = schema.data;
      metaRaw = schema;
    } else if (Array.isArray(schema.questions)) {
      rawQuestions = schema.questions;
      metaRaw = schema;
    } else if (schema.result && Array.isArray(schema.result.data)) {
      rawQuestions = schema.result.data;
      metaRaw = schema.result;
    } else {
      // Find first array property
      for (const key of Object.keys(schema)) {
        if (Array.isArray(schema[key])) {
          rawQuestions = schema[key];
          metaRaw = schema;
          break;
        }
      }
    }
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const meta: GroupMeta = {
    groupNumber: Number(metaRaw.current_group) || 1,
    totalGroups: Number(metaRaw.total_groups) || 1,
    hasNextGroup: metaRaw.next ?? metaRaw.hasNextGroup ?? false,
    instruction: metaRaw.instruction || '',
    groupJumps: Array.isArray(metaRaw.groups) ? metaRaw.groups : [],
  };

  // 1. Add Start Node
  nodes.push({
    id: 'start-node',
    type: 'start',
    position: { x: 300, y: 40 },
    data: { label: `Group ${meta.groupNumber} Start` },
  });

  let currentY = 160;
  const questionIdToNodeId: Record<string, string> = {};
  const questionNodes: Node[] = [];
  const rootQuestionIds: string[] = [];

  // 2. Generate Question Nodes
  rawQuestions.forEach((item, index) => {
    const qId = item.question_id !== undefined ? Number(item.question_id) : index + 101;
    const nodeId = `q-${qId}`;
    questionIdToNodeId[String(qId)] = nodeId;

    // Normalize options (could be string, array, object, or JSON-encoded)
    let normalizedOptions = '';
    if (typeof item.options === 'string') {
      const trimmed = item.options.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          const parsedOpt = JSON.parse(trimmed);
          if (Array.isArray(parsedOpt)) {
            normalizedOptions = parsedOpt
              .map((o: any) =>
                typeof o === 'object' && o !== null
                  ? o.name || o.value || o.label || o.title || JSON.stringify(o)
                  : String(o)
              )
              .join(', ');
          } else if (typeof parsedOpt === 'object' && parsedOpt !== null) {
            normalizedOptions = Object.values(parsedOpt)
              .map((v: any) =>
                typeof v === 'object' && v !== null ? v.name || v.label || String(v) : String(v)
              )
              .join(', ');
          } else {
            normalizedOptions = item.options;
          }
        } catch {
          normalizedOptions = item.options;
        }
      } else {
        normalizedOptions = item.options;
      }
    } else if (Array.isArray(item.options)) {
      normalizedOptions = item.options
        .map((o: any) =>
          typeof o === 'object' && o !== null
            ? o.name || o.value || o.label || o.title || JSON.stringify(o)
            : String(o)
        )
        .join(', ');
    } else if (item.options && typeof item.options === 'object') {
      normalizedOptions = Object.values(item.options)
        .map((v: any) =>
          typeof v === 'object' && v !== null ? v.name || v.label || String(v) : String(v)
        )
        .join(', ');
    } else if (item.options) {
      normalizedOptions = String(item.options);
    }

    const hasDependsOn =
      item.depends_on &&
      (Array.isArray(item.depends_on)
        ? item.depends_on.length > 0
        : Boolean(item.depends_on));

    if (!hasDependsOn) {
      rootQuestionIds.push(nodeId);
    }

    // Branch nodes are placed to the right, root nodes in main column
    const posX = hasDependsOn ? 560 : 260;
    const posY = currentY;

    const qNode: Node = {
      id: nodeId,
      type: 'question',
      position: { x: posX, y: posY },
      data: {
        question_id: qId,
        question: item.question || item.title || `Question ${qId}`,
        question_bn: item.question_bn || item.title_bn || item.question || 'প্রশ্ন',
        answer_type: item.answer_type || 'string',
        mandatory: Boolean(item.mandatory),
        editable: item.editable ?? true,
        placeholder: item.placeholder || '',
        hint: item.hint || '',
        options: normalizedOptions,
        value: item.value || '',
      },
    };

    questionNodes.push(qNode);
    nodes.push(qNode);

    currentY += 190;
  });

  // 3. Connect Start Node to first question
  if (questionNodes.length > 0) {
    const firstNode = rootQuestionIds.length > 0 ? rootQuestionIds[0] : questionNodes[0].id;
    edges.push({
      id: 'e-start-first',
      source: 'start-node',
      target: firstNode,
      type: 'surveyEdge',
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#10b981',
      },
    });
  }

  // 4. Connect sequential root flow between independent questions
  for (let i = 0; i < rootQuestionIds.length - 1; i++) {
    edges.push({
      id: `e-seq-${rootQuestionIds[i]}-${rootQuestionIds[i + 1]}`,
      source: rootQuestionIds[i],
      sourceHandle: 'default-next',
      target: rootQuestionIds[i + 1],
      type: 'surveyEdge',
      style: { stroke: '#475569', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#475569',
      },
    });
  }

  // 5. Generate Condition Edges from `depends_on` and `validation`
  rawQuestions.forEach((item, index) => {
    const qId = item.question_id !== undefined ? Number(item.question_id) : index + 101;
    const targetId = `q-${qId}`;

    if (item.depends_on) {
      const depList: any[] = Array.isArray(item.depends_on)
        ? item.depends_on
        : [item.depends_on];

      depList.forEach((parent) => {
        const parentKey = String(parent);
        const sourceId = questionIdToNodeId[parentKey];
        if (!sourceId) return;

        let ruleLabel = 'Depends On';
        let valType: 'match' | 'greater' | 'less' = 'match';
        let triggerVal = '';

        if (item.validation && item.validation[parentKey]) {
          const rule: any = item.validation[parentKey];
          if (typeof rule === 'object' && rule !== null) {
            valType = rule.validation_type || 'match';
            if (rule.validation && typeof rule.validation === 'object' && !Array.isArray(rule.validation)) {
              triggerVal = Object.keys(rule.validation).join(', ');
            } else if (rule.validation !== undefined) {
              triggerVal = String(rule.validation);
            }
          } else {
            valType = 'match';
            triggerVal = String(rule);
          }

          if (valType === 'match') {
            ruleLabel = triggerVal ? `IF "${triggerVal}"` : 'IF Match';
          } else if (valType === 'greater') {
            ruleLabel = `IF > ${triggerVal}`;
          } else if (valType === 'less') {
            ruleLabel = `IF < ${triggerVal}`;
          }
        }

        let sourceHandle: string | undefined = undefined;
        if (valType === 'match' && triggerVal) {
          sourceHandle = `opt-${encodeURIComponent(triggerVal.trim())}`;
        }

        edges.push({
          id: `e-dep-${parentKey}-${qId}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          source: sourceId,
          sourceHandle,
          target: targetId,
          type: 'surveyEdge',
          label: ruleLabel,
          animated: true,
          style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 4' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: '#f59e0b',
          },
          data: {
            validationType: valType,
            triggerValue: triggerVal,
          },
        });
      });
    }
  });

  // 6. Add Group Jump Nodes if present
  if (Array.isArray(schema.groups) && schema.groups.length > 0) {
    schema.groups.forEach((jump: any, jIdx: number) => {
      const jumpNodeId = `jump-${jump.group_id}`;
      nodes.push({
        id: jumpNodeId,
        type: 'groupJump',
        position: { x: 620, y: 160 + jIdx * 140 },
        data: {
          targetGroupId: parseInt(jump.group_id) || 1,
          targetGroupTitle: jump.group_title || `Group ${jump.group_id}`,
        },
      });
    });
  }

  // 7. Add End Node
  nodes.push({
    id: 'end-node',
    type: 'end',
    position: { x: 300, y: currentY + 40 },
    data: { label: meta.hasNextGroup ? 'Next Group' : 'Submit Survey' },
  });

  if (rootQuestionIds.length > 0) {
    const lastRootId = rootQuestionIds[rootQuestionIds.length - 1];
    edges.push({
      id: 'e-last-end',
      source: lastRootId,
      sourceHandle: 'default-next',
      target: 'end-node',
      type: 'surveyEdge',
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#6366f1',
      },
    });
  } else if (questionNodes.length > 0) {
    const lastNode = questionNodes[questionNodes.length - 1];
    edges.push({
      id: 'e-last-end',
      source: lastNode.id,
      target: 'end-node',
      type: 'surveyEdge',
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#6366f1',
      },
    });
  }

  return { nodes, edges, meta };
}
