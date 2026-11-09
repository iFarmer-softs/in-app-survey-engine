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
import { resolveNodeGroupId } from './flowValidator';

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

  const getNodeGroup = (node?: Node, nodeData?: any): number => {
    if (node) {
      return resolveNodeGroupId(node, nodes, meta.groupNumber);
    }
    if (nodeData?.containerId) {
      const container = nodes.find((n) => n.id === nodeData.containerId);
      if (container) return resolveNodeGroupId(container, nodes, meta.groupNumber);
    }
    if (typeof nodeData?.group === 'number' && !isNaN(nodeData.group) && nodeData.group > 0) {
      return nodeData.group;
    }
    return meta.groupNumber;
  };

  const questions: DynamicKycQuestion[] = [];

  // Precompute downstream questions within the same group for each question
  const downstreamMap: Record<number, number[]> = {};
  for (const qNode of questionNodes) {
    const qId = (qNode.data as any)?.question_id;
    if (!qId) continue;
    const qGroup = getNodeGroup(qNode, qNode.data);
    const visited = new Set<string>();
    const queue = [qNode.id];
    const downstream: number[] = [];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      if (visited.has(currId)) continue;
      visited.add(currId);

      const outEdges = edges.filter((e) => e.source === currId);
      for (const e of outEdges) {
        const tgtNode = nodes.find((n) => n.id === e.target);
        if (!tgtNode) continue;
        if (tgtNode.type === 'question') {
          const tgtGroup = getNodeGroup(tgtNode, tgtNode.data);
          if (tgtGroup === qGroup) {
            const tgtQId = (tgtNode.data as any)?.question_id;
            if (tgtQId && !downstream.includes(tgtQId)) {
              downstream.push(tgtQId);
            }
            if (!visited.has(tgtNode.id)) {
              queue.push(tgtNode.id);
            }
          }
        } else if (tgtNode.type === 'decision' || tgtNode.type === 'process') {
          if (!visited.has(tgtNode.id)) {
            queue.push(tgtNode.id);
          }
        }
      }
    }
    downstreamMap[qId] = downstream;
  }

  // Sort nodes by vertical position (Y) to keep a logical top-to-bottom order
  const sortedQuestionNodes = [...questionNodes].sort(
    (a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)
  );

  for (const qNode of sortedQuestionNodes) {
    const data = qNode.data as unknown as QuestionNodeData;
    const qId = data.question_id;

    const dependsOn: number[] = [];
    const validationMap: Record<string, ValidationConfig> = {};

    // Find incoming edges directly or through container / decision nodes
    const incomingToNode = edges.filter((e) => e.target === qNode.id);
    const myGroup = getNodeGroup(qNode, data);
    const containerId = data.containerId;
    const containerNode = nodes.find(
      (n) =>
        (n.type === 'groupFrame' || n.type === 'groupContainer') &&
        (n.id === containerId || (n.data as any)?.numericGroupId === myGroup)
    );
    const containerIncoming = containerNode
      ? edges.filter((e) => e.target === containerNode.id)
      : [];

    const hasInternalIncoming = incomingToNode.some((e) => {
      const src = nodes.find((n) => n.id === e.source);
      return src && getNodeGroup(src, src.data) === myGroup;
    });

    const incomingEdges = [...incomingToNode];
    if (!hasInternalIncoming && containerIncoming.length > 0) {
      for (const ce of containerIncoming) {
        if (!incomingEdges.some((ie) => ie.id === ce.id)) {
          incomingEdges.push(ce);
        }
      }
    }

    for (const inEdge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === inEdge.source);
      if (!sourceNode) continue;

      if (sourceNode.type === 'question') {
        const parentData = sourceNode.data as unknown as QuestionNodeData;
        const parentId = parentData.question_id;

        // Check if edge carries condition metadata or was connected to a specific option port
        const edgeData = inEdge.data as { validationType?: string; triggerValue?: any } | undefined;
        let optFromHandle: string | null = null;
        if (inEdge.sourceHandle && inEdge.sourceHandle.startsWith('opt-')) {
          optFromHandle = decodeURIComponent(inEdge.sourceHandle.replace('opt-', ''));
        }

        const isConditional =
          Boolean(optFromHandle) ||
          Boolean(edgeData?.validationType && edgeData.triggerValue !== undefined);

        // Only add depends_on and validation if this edge represents an actual conditional branch!
        // Unconditional progression (e.g. 'default-next') must NOT create a dependency.
        if (isConditional) {
          if (!dependsOn.includes(parentId)) {
            dependsOn.push(parentId);
          }

          const parentKey = String(parentId);
          const parentGroup = getNodeGroup(sourceNode, parentData);
          const currentGroup = getNodeGroup(qNode, data);
          const isSameGroup = parentGroup === currentGroup;

          if (optFromHandle) {
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

            // For binary questions (e.g. হ্যাঁ / না), set the opposing option to false
            const parentOpts = (parentData.options || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (parentOpts.length === 2 && parentOpts.includes(optFromHandle)) {
              parentOpts.forEach((opt) => {
                if (opt !== optFromHandle) {
                  matches[opt] = false;
                }
              });
            }

            validationMap[parentKey] = {
              group: parentGroup,
              is_same_group: isSameGroup,
              validation_type: 'match',
              validation: matches,
            };
          } else if (edgeData?.validationType && edgeData.triggerValue !== undefined) {
            const vType = edgeData.validationType as 'match' | 'greater' | 'less';
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
              const trigStr = String(edgeData.triggerValue);
              matches[trigStr] = true;

              const parentOpts = (parentData.options || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              if (parentOpts.length === 2 && parentOpts.includes(trigStr)) {
                parentOpts.forEach((opt) => {
                  if (opt !== trigStr) {
                    matches[opt] = false;
                  }
                });
              }

              validationMap[parentKey] = {
                group: parentGroup,
                is_same_group: isSameGroup,
                validation_type: 'match',
                validation: matches,
              };
            } else {
              validationMap[parentKey] = {
                group: parentGroup,
                is_same_group: isSameGroup,
                validation_type: vType,
                validation: Number(edgeData.triggerValue) || 0,
              };
            }
          }
        }
      } else if (sourceNode.type === 'decision') {
        const decData = sourceNode.data as unknown as DecisionNodeData;
        const decisionIncoming = edges.filter((e) => e.target === sourceNode.id);
        const isElse =
          inEdge.sourceHandle === 'else' ||
          (typeof inEdge.label === 'string' && inEdge.label.toUpperCase().includes('ELSE'));

        for (const decInEdge of decisionIncoming) {
          const parentQuestionNode = nodes.find((n) => n.id === decInEdge.source && n.type === 'question');
          if (parentQuestionNode) {
            const parentData = parentQuestionNode.data as unknown as QuestionNodeData;
            const parentId = parentData.question_id;
            if (!dependsOn.includes(parentId)) {
              dependsOn.push(parentId);
            }

            const parentGroup = getNodeGroup(parentQuestionNode, parentData);
            const currentGroup = getNodeGroup(qNode, data);
            const condType = decData.conditionType || 'match';

            if (condType === 'match') {
              if (isElse) {
                validationMap[String(parentId)] = {
                  group: parentGroup,
                  is_same_group: parentGroup === currentGroup,
                  validation_type: 'not_match',
                  validation: String(decData.comparisonValue || ''),
                };
              } else {
                const matches: Record<string, boolean> = {};
                matches[String(decData.comparisonValue || '')] = true;
                validationMap[String(parentId)] = {
                  group: parentGroup,
                  is_same_group: parentGroup === currentGroup,
                  validation_type: 'match',
                  validation: matches,
                };
              }
            } else if (condType === 'greater') {
              validationMap[String(parentId)] = {
                group: parentGroup,
                is_same_group: parentGroup === currentGroup,
                validation_type: isElse ? 'less_or_equal' : 'greater',
                validation: Number(decData.comparisonValue) || 0,
              };
            } else if (condType === 'less') {
              validationMap[String(parentId)] = {
                group: parentGroup,
                is_same_group: parentGroup === currentGroup,
                validation_type: isElse ? 'greater_or_equal' : 'less',
                validation: Number(decData.comparisonValue) || 0,
              };
            }
          }
        }
      }
    }

    const rawAny = data as any;
    const qItem: DynamicKycQuestion = {
      question_id: qId,
      question: data.question || 'Untitled Question',
      question_bn: data.question_bn || data.question || 'প্রশ্ন',
      answer_type: data.answer_type || 'string',
      placeholder: data.placeholder ?? null,
      options: data.options || undefined,
      group: getNodeGroup(qNode, rawAny),
      group_display_order:
        rawAny.group_display_order ??
        (sortedQuestionNodes.indexOf(qNode) + 1) * 2 - 1,
      mandatory: data.mandatory ?? true,
      active: rawAny.active ?? true,
      hint: data.hint ?? null,
      auto_filled: rawAny.auto_filled ?? false,
      value: data.value ?? null,
      editable: data.editable ?? true,
      depends_on: dependsOn.length > 0 ? dependsOn : null,
      cross_group_dependency: rawAny.cross_group_dependency ?? [],
      validation: Object.keys(validationMap).length > 0 ? validationMap : null,
      hidden: rawAny.hidden ?? (dependsOn.length > 0),
      subsequent_questions:
        downstreamMap[qId] && downstreamMap[qId].length > 0 ? downstreamMap[qId] : undefined,
    };

    questions.push(qItem);
  }

  // Group jumps list with explicit conditional bindings
  const groupJumps: {
    group_id: string;
    group_title: string;
    source_question_id?: number;
    trigger_value?: string;
    trigger_type?: string;
    source_handle?: string;
    source_group?: number;
    target_question_id?: number;
  }[] = [];

  if (Array.isArray(meta.groupJumps)) {
    groupJumps.push(...meta.groupJumps);
  }

  // 1. Process group jumps from jump nodes
  for (const jNode of jumpNodes) {
    const jData = jNode.data as unknown as GroupJumpNodeData;
    if (jData.targetGroupId) {
      const gIdStr = String(jData.targetGroupId);
      const targetTitle = jData.targetGroupTitle || `Group ${gIdStr}`;
      const jumpInEdges = edges.filter((e) => e.target === jNode.id);
      const jOutEdge = edges.find((e) => e.source === jNode.id);
      let targetQId: number | undefined = (jData as any)?.targetQuestionId;
      if (!targetQId && jOutEdge) {
        const outNode = nodes.find((n) => n.id === jOutEdge.target);
        if (outNode?.type === 'question') {
          targetQId = (outNode.data as any)?.question_id;
        }
      }

      if (jumpInEdges.length > 0) {
        for (const jEdge of jumpInEdges) {
          const srcNode = nodes.find((n) => n.id === jEdge.source);
          let triggerVal: string | null = null;
          let triggerType = 'match';
          const isElse =
            jEdge.sourceHandle === 'else' ||
            (typeof jEdge.label === 'string' && jEdge.label.toUpperCase().includes('ELSE'));

          if (jEdge.sourceHandle && jEdge.sourceHandle.startsWith('opt-')) {
            triggerVal = decodeURIComponent(jEdge.sourceHandle.replace('opt-', '')).trim();
          } else if ((jEdge.data as any)?.triggerValue) {
            triggerVal = String((jEdge.data as any).triggerValue).trim();
          } else if (typeof jEdge.label === 'string' && !jEdge.label.startsWith('Cross-Group:')) {
            triggerVal = jEdge.label.replace(/^IF\s*["']?|["']?$/g, '').trim();
          }

          let sourceQId: number | undefined = undefined;
          let sourceG: number | undefined = undefined;

          if (srcNode?.type === 'question') {
            sourceQId = (srcNode.data as any)?.question_id;
            sourceG = getNodeGroup(srcNode, srcNode.data);
            if (isElse) {
              triggerType = 'else';
            }
          } else if (srcNode?.type === 'decision') {
            const decData = srcNode.data as unknown as DecisionNodeData;
            const dEdges = edges.filter((e) => e.target === srcNode.id);
            for (const de of dEdges) {
              const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
              if (dSrc) {
                sourceQId = (dSrc.data as any)?.question_id;
                sourceG = getNodeGroup(dSrc, dSrc.data);
                triggerVal = String(decData.comparisonValue || 'Yes');
                const condType = decData.conditionType || 'match';
                if (isElse) {
                  triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
                } else {
                  triggerType = condType;
                }
                break;
              }
            }
          }

          const existingIdx = groupJumps.findIndex(
            (g) =>
              g.group_id === gIdStr &&
              (!g.source_question_id || g.source_question_id === sourceQId) &&
              (!g.trigger_value || g.trigger_value === triggerVal) &&
              (!g.trigger_type || g.trigger_type === triggerType)
          );

          const jumpEntry = {
            group_id: gIdStr,
            group_title: targetTitle,
            source_question_id: sourceQId,
            trigger_value: triggerVal || undefined,
            trigger_type: triggerType,
            source_handle: jEdge.sourceHandle || undefined,
            source_group: sourceG,
            target_question_id: targetQId,
          };

          if (existingIdx >= 0) {
            groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
          } else {
            groupJumps.push(jumpEntry);
          }
        }
      } else {
        if (!groupJumps.some((g) => g.group_id === gIdStr)) {
          groupJumps.push({
            group_id: gIdStr,
            group_title: targetTitle,
            target_question_id: targetQId,
          });
        }
      }
    }
  }

  // 2. Process conditional edges directly targeting a groupFrame or groupContainer
  for (const edge of edges) {
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!targetNode) continue;
    if (targetNode.type === 'groupFrame' || targetNode.type === 'groupContainer') {
      const targetG =
        (targetNode.data as any)?.numericGroupId ||
        parseInt(String((targetNode.data as any)?.groupId).replace(/\D+/g, ''), 10);
      if (!targetG || isNaN(targetG)) continue;
      const gIdStr = String(targetG);
      const targetTitle =
        (targetNode.data as any)?.title || (targetNode.data as any)?.titleBn || `Group ${targetG}`;

      const srcNode = nodes.find((n) => n.id === edge.source);
      let triggerVal: string | null = null;
      let triggerType = 'match';
      const isElse =
        edge.sourceHandle === 'else' ||
        (typeof edge.label === 'string' && edge.label.toUpperCase().includes('ELSE'));

      if (edge.sourceHandle && edge.sourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(edge.sourceHandle.replace('opt-', '')).trim();
      } else if ((edge.data as any)?.triggerValue) {
        triggerVal = String((edge.data as any).triggerValue).trim();
      }

      let sourceQId: number | undefined = undefined;
      let sourceG: number | undefined = undefined;

      if (srcNode?.type === 'question') {
        sourceQId = (srcNode.data as any)?.question_id;
        sourceG = getNodeGroup(srcNode, srcNode.data);
        if (isElse) {
          triggerType = 'else';
        }
      } else if (srcNode?.type === 'decision') {
        const decData = srcNode.data as unknown as DecisionNodeData;
        const dEdges = edges.filter((e) => e.target === srcNode.id);
        for (const de of dEdges) {
          const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
          if (dSrc) {
            sourceQId = (dSrc.data as any)?.question_id;
            sourceG = getNodeGroup(dSrc, dSrc.data);
            triggerVal = String(decData.comparisonValue || 'Yes');
            const condType = decData.conditionType || 'match';
            if (isElse) {
              triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
            } else {
              triggerType = condType;
            }
            break;
          }
        }
      }

      if (sourceQId !== undefined && triggerVal !== null) {
        const existingIdx = groupJumps.findIndex(
          (g) =>
            g.group_id === gIdStr &&
            (!g.source_question_id || g.source_question_id === sourceQId) &&
            (!g.trigger_value || g.trigger_value === triggerVal) &&
            (!g.trigger_type || g.trigger_type === triggerType)
        );
        const jumpEntry = {
          group_id: gIdStr,
          group_title: targetTitle,
          source_question_id: sourceQId,
          trigger_value: triggerVal,
          trigger_type: triggerType,
          source_handle: edge.sourceHandle || undefined,
          source_group: sourceG,
        };
        if (existingIdx >= 0) {
          groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
        } else {
          groupJumps.push(jumpEntry);
        }
      }
    }
  }

  // 3. Process conditional cross-group edges between questions or decisions from an option/decision port
  for (const edge of edges) {
    const srcNode = nodes.find((n) => n.id === edge.source);
    const tgtNode = nodes.find((n) => n.id === edge.target);
    if (!srcNode || !tgtNode) continue;

    let sourceQId: number | undefined = undefined;
    let sourceG: number | undefined = undefined;
    let triggerVal: string | null = null;
    let triggerType = 'match';
    const isElse =
      edge.sourceHandle === 'else' ||
      (typeof edge.label === 'string' && edge.label.toUpperCase().includes('ELSE'));

    if (srcNode.type === 'question') {
      sourceQId = (srcNode.data as any)?.question_id;
      sourceG = getNodeGroup(srcNode, srcNode.data);
      if (edge.sourceHandle && edge.sourceHandle.startsWith('opt-')) {
        triggerVal = decodeURIComponent(edge.sourceHandle.replace('opt-', '')).trim();
      } else if (isElse) {
        triggerType = 'else';
        triggerVal = String((edge.data as any)?.triggerValue || 'else').trim();
      } else if ((edge.data as any)?.triggerValue) {
        triggerVal = String((edge.data as any).triggerValue).trim();
      }
    } else if (srcNode.type === 'decision') {
      const decData = srcNode.data as unknown as DecisionNodeData;
      const dEdges = edges.filter((e) => e.target === srcNode.id);
      for (const de of dEdges) {
        const dSrc = nodes.find((n) => n.id === de.source && n.type === 'question');
        if (dSrc) {
          sourceQId = (dSrc.data as any)?.question_id;
          sourceG = getNodeGroup(dSrc, dSrc.data);
          triggerVal = String(decData.comparisonValue || 'Yes');
          const condType = decData.conditionType || 'match';
          if (isElse) {
            triggerType = condType === 'match' ? 'not_match' : (condType === 'greater' ? 'less_or_equal' : 'greater_or_equal');
          } else {
            triggerType = condType;
          }
          break;
        }
      }
    }

    if (sourceQId !== undefined && triggerVal !== null) {
      const tgtGroup =
        tgtNode.type === 'question'
          ? getNodeGroup(tgtNode, tgtNode.data)
          : (tgtNode.data as any)?.numericGroupId ||
            parseInt(String((tgtNode.data as any)?.groupId).replace(/\D+/g, ''), 10);

      if (sourceG !== tgtGroup && tgtGroup) {
        const gIdStr = String(tgtGroup);
        const targetTitle = (tgtNode.data as any)?.title || `Group ${tgtGroup}`;
        const targetQId = tgtNode.type === 'question' ? (tgtNode.data as any)?.question_id : undefined;

        const existingIdx = groupJumps.findIndex(
          (g) =>
            g.group_id === gIdStr &&
            (!g.source_question_id || g.source_question_id === sourceQId) &&
            (!g.trigger_value || g.trigger_value === triggerVal) &&
            (!g.trigger_type || g.trigger_type === triggerType) &&
            (!g.target_question_id || g.target_question_id === targetQId)
        );
        const jumpEntry = {
          group_id: gIdStr,
          group_title: targetTitle,
          source_question_id: sourceQId,
          trigger_value: triggerVal,
          trigger_type: triggerType,
          source_handle: edge.sourceHandle || undefined,
          source_group: sourceG,
          target_question_id: targetQId,
        };
        if (existingIdx >= 0) {
          groupJumps[existingIdx] = { ...groupJumps[existingIdx], ...jumpEntry };
        } else {
          groupJumps.push(jumpEntry);
        }
      }
    }
  }

  // Calculate actual total groups and whether a next group exists
  const detectedGroupNumbers = new Set<number>();
  if (meta.groupNumber) detectedGroupNumbers.add(meta.groupNumber);
  if (meta.totalGroups) detectedGroupNumbers.add(meta.totalGroups);
  for (const q of questions) {
    if (q.group) detectedGroupNumbers.add(q.group);
  }
  for (const n of nodes) {
    if (n.type === 'groupFrame' || n.type === 'groupContainer') {
      const g = (n.data as any)?.numericGroupId || parseInt(String((n.data as any)?.groupId).replace(/\D+/g, ''), 10);
      if (g && !isNaN(g)) detectedGroupNumbers.add(g);
    }
  }
  const maxGroupNum = detectedGroupNumbers.size > 0 ? Math.max(...detectedGroupNumbers) : (meta.totalGroups || 1);
  const totalGroups = Math.max(meta.totalGroups || 1, maxGroupNum);
  const currentGroup = meta.groupNumber || 1;
  const hasNext = Boolean(meta.hasNextGroup || currentGroup < totalGroups || groupJumps.length > 0);

  return {
    data: questions,
    instruction: meta.instruction || '',
    groups_to_jump: groupJumps,
    next: hasNext,
    total_groups: totalGroups,
    current_group: currentGroup,
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
  groups_to_jump: [
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
    groupJumps: Array.isArray(metaRaw.groups_to_jump)
      ? metaRaw.groups_to_jump
      : Array.isArray(metaRaw.groups)
        ? metaRaw.groups
        : [],
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
        group: item.group,
        group_display_order: item.group_display_order,
        active: item.active,
        auto_filled: item.auto_filled,
        cross_group_dependency: item.cross_group_dependency,
        hidden: item.hidden,
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

        let valType: 'match' | 'greater' | 'less' = 'match';
        let triggerVals: string[] = [''];

        if (item.validation && item.validation[parentKey]) {
          const rule: any = item.validation[parentKey];
          if (typeof rule === 'object' && rule !== null) {
            valType = rule.validation_type || 'match';
            if (rule.validation && typeof rule.validation === 'object' && !Array.isArray(rule.validation)) {
              const truthyKeys = Object.keys(rule.validation).filter(
                (k) => rule.validation[k] !== false && rule.validation[k] !== null
              );
              triggerVals = truthyKeys.length > 0 ? truthyKeys : Object.keys(rule.validation);
            } else if (rule.validation !== undefined) {
              triggerVals = [String(rule.validation)];
            }
          } else {
            valType = 'match';
            triggerVals = [String(rule)];
          }
        }

        const ruleObj: any = item.validation ? item.validation[parentKey] : null;
        const parentItem = rawQuestions.find((q) => String(q.question_id) === parentKey);
        const isCrossGroupRule = Boolean(
          ruleObj && (ruleObj.is_same_group === false || (ruleObj.group && item.group && ruleObj.group !== item.group))
        );
        const sourceGroupNum = ruleObj?.group ?? (parentItem ? parentItem.group : undefined);
        const targetGroupNum = item.group;

        triggerVals.forEach((triggerVal) => {
          let ruleLabel = 'Depends On';
          if (valType === 'match') {
            ruleLabel = triggerVal ? `IF "${triggerVal}"` : 'IF Match';
          } else if (valType === 'greater') {
            ruleLabel = `IF > ${triggerVal}`;
          } else if (valType === 'less') {
            ruleLabel = `IF < ${triggerVal}`;
          }

          if (isCrossGroupRule) {
            ruleLabel = `[G${sourceGroupNum ?? '?'}➔G${targetGroupNum ?? '?'}] ${ruleLabel}`;
          }

          let sourceHandle: string | undefined = undefined;
          if (valType === 'match' && triggerVal) {
            sourceHandle = `opt-${encodeURIComponent(triggerVal.trim())}`;
          }

          const strokeColor = isCrossGroupRule ? '#8b5cf6' : '#f59e0b';

          edges.push({
            id: `e-dep-${parentKey}-${qId}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            source: sourceId,
            sourceHandle,
            target: targetId,
            type: 'surveyEdge',
            label: ruleLabel,
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2, strokeDasharray: '5 5' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: strokeColor,
            },
            data: {
              validationType: valType,
              triggerValue: triggerVal,
              isCrossGroup: isCrossGroupRule,
              sourceGroup: sourceGroupNum,
              targetGroup: targetGroupNum,
            },
          });
        });
      });
    }
  });

  // 6. Add Group Jump Nodes if present
  const rawGroupJumps = Array.isArray(schema.groups_to_jump)
    ? schema.groups_to_jump
    : Array.isArray(schema.groups)
      ? schema.groups
      : [];

  if (rawGroupJumps.length > 0) {
    rawGroupJumps.forEach((jump: any, jIdx: number) => {
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
