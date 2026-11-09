package com.ifarmer.survey.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.ifarmer.survey.model.dto.CompileRequest;
import com.ifarmer.survey.model.dto.CompileResponse;
import com.ifarmer.survey.model.dto.ValidateRequest;
import com.ifarmer.survey.model.dto.ValidateResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class CompilerService {

    public CompileResponse compile(CompileRequest req) {
        JsonNode nodes = req.nodes();
        JsonNode edges = req.edges();
        JsonNode groupMeta = req.groupMeta();

        if (nodes == null || !nodes.isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nodes array is required");
        }

        List<JsonNode> questionNodes = new ArrayList<>();
        List<JsonNode> jumpNodes = new ArrayList<>();
        Map<String, JsonNode> nodeMap = new HashMap<>();

        for (JsonNode n : nodes) {
            String id = n.path("id").asText();
            nodeMap.put(id, n);
            String type = n.path("type").asText();
            if ("question".equals(type)) {
                questionNodes.add(n);
            } else if ("groupJump".equals(type)) {
                jumpNodes.add(n);
            }
        }

        int defaultGroupNumber = (groupMeta != null && groupMeta.has("groupNumber")) ? groupMeta.path("groupNumber").asInt(1) : 1;

        // Sort question nodes top-to-bottom
        questionNodes.sort(Comparator.comparingDouble(a -> a.path("position").path("y").asDouble(0.0)));

        // Precompute downstream questions within the same group for each question
        Map<Integer, List<Integer>> downstreamMap = new LinkedHashMap<>();
        for (JsonNode qNode : questionNodes) {
            int qId = qNode.path("data").path("question_id").asInt(extractNumber(qNode.path("id").asText(), 1));
            int qGroup = getNodeGroup(qNode, qNode.path("data"), nodeMap, defaultGroupNumber);
            Set<String> visited = new HashSet<>();
            Queue<String> queue = new ArrayDeque<>();
            queue.add(qNode.path("id").asText());
            List<Integer> downstream = new ArrayList<>();

            while (!queue.isEmpty()) {
                String currId = queue.poll();
                if (visited.contains(currId)) continue;
                visited.add(currId);

                List<JsonNode> outEdges = findEdgesBySource(edges, currId);
                for (JsonNode e : outEdges) {
                    JsonNode tgtNode = nodeMap.get(e.path("target").asText());
                    if (tgtNode == null) continue;
                    String tType = tgtNode.path("type").asText();
                    if ("question".equals(tType)) {
                        int tgtGroup = getNodeGroup(tgtNode, tgtNode.path("data"), nodeMap, defaultGroupNumber);
                        if (tgtGroup == qGroup) {
                            int tgtQId = tgtNode.path("data").path("question_id").asInt(extractNumber(tgtNode.path("id").asText(), 1));
                            if (!downstream.contains(tgtQId)) {
                                downstream.add(tgtQId);
                            }
                            if (!visited.contains(tgtNode.path("id").asText())) {
                                queue.add(tgtNode.path("id").asText());
                            }
                        }
                    } else if ("decision".equals(tType) || "process".equals(tType)) {
                        if (!visited.contains(tgtNode.path("id").asText())) {
                            queue.add(tgtNode.path("id").asText());
                        }
                    }
                }
            }
            downstreamMap.put(qId, downstream);
        }

        List<Map<String, Object>> questions = new ArrayList<>();

        for (JsonNode qNode : questionNodes) {
            JsonNode data = qNode.path("data");
            String qNodeId = qNode.path("id").asText();
            int qId = data.path("question_id").asInt(extractNumber(qNodeId, 1));
            int qGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

            List<Integer> dependsOn = new ArrayList<>();
            Map<String, Object> validationMap = new LinkedHashMap<>();

            String containerId = data.path("containerId").asText(null);
            JsonNode containerNode = null;
            for (JsonNode n : nodes) {
                String type = n.path("type").asText();
                if ("groupFrame".equals(type) || "groupContainer".equals(type)) {
                    if ((containerId != null && containerId.equals(n.path("id").asText())) ||
                            n.path("data").path("numericGroupId").asInt(-1) == qGroup) {
                        containerNode = n;
                        break;
                    }
                }
            }

            List<JsonNode> incomingToNode = findEdgesByTarget(edges, qNodeId);
            boolean hasInternalIncoming = false;
            for (JsonNode e : incomingToNode) {
                JsonNode src = nodeMap.get(e.path("source").asText());
                if (src != null && getNodeGroup(src, src.path("data"), nodeMap, defaultGroupNumber) == qGroup) {
                    hasInternalIncoming = true;
                    break;
                }
            }

            List<JsonNode> incomingEdges = new ArrayList<>(incomingToNode);
            if (!hasInternalIncoming && containerNode != null) {
                List<JsonNode> containerEdges = findEdgesByTarget(edges, containerNode.path("id").asText());
                for (JsonNode ce : containerEdges) {
                    if (!incomingEdges.contains(ce)) {
                        incomingEdges.add(ce);
                    }
                }
            }

            for (JsonNode inEdge : incomingEdges) {
                String sourceId = inEdge.path("source").asText();
                JsonNode sourceNode = nodeMap.get(sourceId);
                if (sourceNode == null) continue;

                String sourceType = sourceNode.path("type").asText();
                JsonNode parentData = sourceNode.path("data");

                if ("question".equals(sourceType)) {
                    int parentId = parentData.path("question_id").asInt(1);
                    if (!dependsOn.contains(parentId)) {
                        dependsOn.add(parentId);
                    }

                    String optFromHandle = null;
                    String sHandle = inEdge.path("sourceHandle").asText(null);
                    if (sHandle != null && sHandle.startsWith("opt-")) {
                        try {
                            optFromHandle = URLDecoder.decode(sHandle.substring(4), StandardCharsets.UTF_8);
                        } catch (Exception ignored) {}
                    } else if (inEdge.has("label") && inEdge.path("label").asText().startsWith("IF ")) {
                        optFromHandle = inEdge.path("label").asText().replaceAll("^IF\\s*[\"']?|[\"']?$", "");
                    }

                    int parentGroup = getNodeGroup(sourceNode, parentData, nodeMap, defaultGroupNumber);
                    int myGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

                    if (optFromHandle != null && !optFromHandle.isBlank()) {
                        Map<String, Object> valConfig = new LinkedHashMap<>();
                        valConfig.put("validation_type", "match");
                        Map<String, Boolean> matches = new LinkedHashMap<>();
                        matches.put(optFromHandle, true);
                        valConfig.put("validation", matches);
                        valConfig.put("is_same_group", parentGroup == myGroup);
                        valConfig.put("group", parentGroup);
                        validationMap.put(String.valueOf(parentId), valConfig);
                    } else if (inEdge.has("label") && !inEdge.path("label").asText().isBlank()) {
                        Map<String, Object> valConfig = new LinkedHashMap<>();
                        valConfig.put("validation_type", "match");
                        valConfig.put("validation", inEdge.path("label").asText());
                        valConfig.put("is_same_group", parentGroup == myGroup);
                        valConfig.put("group", parentGroup);
                        validationMap.put(String.valueOf(parentId), valConfig);
                    }
                } else if ("decision".equals(sourceType)) {
                    List<JsonNode> decisionIncoming = findEdgesByTarget(edges, sourceId);
                    JsonNode decData = sourceNode.path("data");
                    String sHandle = inEdge.path("sourceHandle").asText(null);
                    boolean isElse = "else".equals(sHandle) || (inEdge.has("label") && inEdge.path("label").asText().toUpperCase().contains("ELSE"));
                    String condType = decData.path("conditionType").asText("match");

                    for (JsonNode dInEdge : decisionIncoming) {
                        String granSourceId = dInEdge.path("source").asText();
                        JsonNode granSource = nodeMap.get(granSourceId);
                        if (granSource != null && "question".equals(granSource.path("type").asText())) {
                            JsonNode granData = granSource.path("data");
                            int parentId = granData.path("question_id").asInt(1);
                            if (!dependsOn.contains(parentId)) {
                                dependsOn.add(parentId);
                            }

                            int parentGroup = getNodeGroup(granSource, granData, nodeMap, defaultGroupNumber);
                            int myGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

                            Map<String, Object> valConfig = new LinkedHashMap<>();
                            valConfig.put("is_same_group", parentGroup == myGroup);
                            valConfig.put("group", parentGroup);

                            if ("match".equals(condType)) {
                                if (isElse) {
                                    valConfig.put("validation_type", "not_match");
                                    valConfig.put("validation", decData.path("comparisonValue").asText(""));
                                } else {
                                    valConfig.put("validation_type", "match");
                                    String edgeLabel = inEdge.has("label") && !inEdge.path("label").asText().isBlank()
                                            ? inEdge.path("label").asText()
                                            : decData.path("comparisonValue").asText("Yes");
                                    valConfig.put("validation", edgeLabel);
                                }
                            } else if ("greater".equals(condType)) {
                                valConfig.put("validation_type", isElse ? "less_or_equal" : "greater");
                                valConfig.put("validation", decData.path("comparisonValue").asDouble(0.0));
                            } else if ("less".equals(condType)) {
                                valConfig.put("validation_type", isElse ? "greater_or_equal" : "less");
                                valConfig.put("validation", decData.path("comparisonValue").asDouble(0.0));
                            }
                            validationMap.put(String.valueOf(parentId), valConfig);
                        }
                    }
                }
            }

            Map<String, Object> qObj = new LinkedHashMap<>();
            qObj.put("question_id", qId);
            qObj.put("question", data.has("question") ? data.path("question").asText() : data.path("label").asText("Question " + qId));
            qObj.put("question_bn", data.has("question_bn") ? data.path("question_bn").asText() : data.path("labelBn").asText(""));
            qObj.put("answer_type", data.path("answer_type").asText("string"));
            qObj.put("mandatory", data.path("mandatory").asBoolean(true));
            qObj.put("editable", data.path("editable").asBoolean(true));
            qObj.put("placeholder", data.has("placeholder") && !data.path("placeholder").isNull() ? data.path("placeholder").asText() : null);
            qObj.put("hint", data.has("hint") && !data.path("hint").isNull() ? data.path("hint").asText() : null);
            if (data.has("options") && !data.path("options").isNull() && !data.path("options").asText().isBlank()) {
                qObj.put("options", data.path("options").asText());
            }
            qObj.put("value", data.has("value") && !data.path("value").isNull() ? data.path("value").asText() : null);
            qObj.put("depends_on", !dependsOn.isEmpty() ? dependsOn : null);
            qObj.put("validation", !validationMap.isEmpty() ? validationMap : null);
            qObj.put("group", qGroup);
            if (data.has("group_display_order")) {
                qObj.put("group_display_order", data.path("group_display_order").asInt());
            }
            qObj.put("active", data.path("active").asBoolean(true));
            List<Integer> subQuestions = downstreamMap.get(qId);
            if (subQuestions != null && !subQuestions.isEmpty()) {
                qObj.put("subsequent_questions", subQuestions);
            }

            questions.add(qObj);
        }

        // Process group jumps with explicit conditional option bindings
        List<Map<String, Object>> groupJumps = new ArrayList<>();
        if (groupMeta != null && groupMeta.has("groupJumps") && groupMeta.path("groupJumps").isArray()) {
            for (JsonNode gj : groupMeta.path("groupJumps")) {
                Map<String, Object> j = new LinkedHashMap<>();
                j.put("group_id", gj.path("group_id").asText());
                j.put("group_title", gj.path("group_title").asText());
                groupJumps.add(j);
            }
        }

        // 1. Process jump nodes
        for (JsonNode jNode : jumpNodes) {
            JsonNode jData = jNode.path("data");
            String targetGid = jData.has("targetGroupId") ? jData.path("targetGroupId").asText()
                    : (jData.has("group_id") ? jData.path("group_id").asText() : "2");
            String targetTitle = jData.has("targetGroupTitle") ? jData.path("targetGroupTitle").asText()
                    : (jData.has("label") ? jData.path("label").asText() : "Group " + targetGid);

            Integer targetQId = jData.has("targetQuestionId") ? jData.path("targetQuestionId").asInt() : null;
            if (targetQId == null) {
                List<JsonNode> jOutEdges = findEdgesBySource(edges, jNode.path("id").asText());
                if (!jOutEdges.isEmpty()) {
                    JsonNode outNode = nodeMap.get(jOutEdges.get(0).path("target").asText());
                    if (outNode != null && "question".equals(outNode.path("type").asText())) {
                        targetQId = outNode.path("data").path("question_id").asInt(1);
                    }
                }
            }

            List<JsonNode> jumpInEdges = findEdgesByTarget(edges, jNode.path("id").asText());
            if (!jumpInEdges.isEmpty()) {
                for (JsonNode jEdge : jumpInEdges) {
                    JsonNode srcNode = nodeMap.get(jEdge.path("source").asText());
                    String triggerVal = null;
                    String triggerType = "match";
                    String sHandle = jEdge.path("sourceHandle").asText(null);
                    boolean isElse = "else".equals(sHandle) || (jEdge.has("label") && jEdge.path("label").asText().toUpperCase().contains("ELSE"));

                    if (sHandle != null && sHandle.startsWith("opt-")) {
                        try {
                            triggerVal = URLDecoder.decode(sHandle.substring(4), StandardCharsets.UTF_8).trim();
                        } catch (Exception ignored) {}
                    } else if (jEdge.has("data") && jEdge.path("data").has("triggerValue")) {
                        triggerVal = jEdge.path("data").path("triggerValue").asText().trim();
                    } else if (jEdge.has("label") && !jEdge.path("label").asText().startsWith("Cross-Group:")) {
                        triggerVal = jEdge.path("label").asText().replaceAll("^IF\\s*[\"']?|[\"']?$", "").trim();
                    }

                    Integer sourceQId = null;
                    Integer sourceG = null;
                    if (srcNode != null && "question".equals(srcNode.path("type").asText())) {
                        sourceQId = srcNode.path("data").path("question_id").asInt(1);
                        sourceG = getNodeGroup(srcNode, srcNode.path("data"), nodeMap, defaultGroupNumber);
                        if (isElse) triggerType = "else";
                    } else if (srcNode != null && "decision".equals(srcNode.path("type").asText())) {
                        JsonNode decData = srcNode.path("data");
                        List<JsonNode> dEdges = findEdgesByTarget(edges, srcNode.path("id").asText());
                        for (JsonNode de : dEdges) {
                            JsonNode dSrc = nodeMap.get(de.path("source").asText());
                            if (dSrc != null && "question".equals(dSrc.path("type").asText())) {
                                sourceQId = dSrc.path("data").path("question_id").asInt(1);
                                sourceG = getNodeGroup(dSrc, dSrc.path("data"), nodeMap, defaultGroupNumber);
                                triggerVal = decData.path("comparisonValue").asText("Yes");
                                String condType = decData.path("conditionType").asText("match");
                                if (isElse) {
                                    triggerType = "match".equals(condType) ? "not_match" : ("greater".equals(condType) ? "less_or_equal" : "greater_or_equal");
                                } else {
                                    triggerType = condType;
                                }
                                break;
                            }
                        }
                    }

                    Map<String, Object> jumpEntry = new LinkedHashMap<>();
                    jumpEntry.put("group_id", targetGid);
                    jumpEntry.put("group_title", targetTitle);
                    if (sourceQId != null) jumpEntry.put("source_question_id", sourceQId);
                    if (triggerVal != null) jumpEntry.put("trigger_value", triggerVal);
                    jumpEntry.put("trigger_type", triggerType);
                    if (sHandle != null) jumpEntry.put("source_handle", sHandle);
                    if (sourceG != null) jumpEntry.put("source_group", sourceG);
                    if (targetQId != null) jumpEntry.put("target_question_id", targetQId);

                    int existingIdx = -1;
                    for (int i = 0; i < groupJumps.size(); i++) {
                        Map<String, Object> existing = groupJumps.get(i);
                        if (targetGid.equals(existing.get("group_id"))
                                && (existing.get("source_question_id") == null || Objects.equals(existing.get("source_question_id"), sourceQId))
                                && (existing.get("trigger_value") == null || Objects.equals(existing.get("trigger_value"), triggerVal))
                                && (existing.get("trigger_type") == null || Objects.equals(existing.get("trigger_type"), triggerType))) {
                            existingIdx = i;
                            break;
                        }
                    }
                    if (existingIdx >= 0) {
                        groupJumps.get(existingIdx).putAll(jumpEntry);
                    } else {
                        groupJumps.add(jumpEntry);
                    }
                }
            } else {
                boolean exists = groupJumps.stream().anyMatch(g -> targetGid.equals(g.get("group_id")));
                if (!exists) {
                    Map<String, Object> j = new LinkedHashMap<>();
                    j.put("group_id", targetGid);
                    j.put("group_title", targetTitle);
                    if (targetQId != null) j.put("target_question_id", targetQId);
                    groupJumps.add(j);
                }
            }
        }

        // 2. Process conditional edges targeting groupFrame or groupContainer
        if (edges != null && edges.isArray()) {
            for (JsonNode edge : edges) {
                JsonNode targetNode = nodeMap.get(edge.path("target").asText());
                if (targetNode == null) continue;
                String tType = targetNode.path("type").asText();
                if ("groupFrame".equals(tType) || "groupContainer".equals(tType)) {
                    int targetG = targetNode.path("data").path("numericGroupId").asInt(-1);
                    if (targetG <= 0) {
                        targetG = extractNumber(targetNode.path("data").path("groupId").asText(), -1);
                    }
                    if (targetG <= 0) continue;
                    String gIdStr = String.valueOf(targetG);
                    String targetTitle = targetNode.path("data").has("title") ? targetNode.path("data").path("title").asText()
                            : (targetNode.path("data").has("titleBn") ? targetNode.path("data").path("titleBn").asText() : "Group " + targetG);

                    JsonNode srcNode = nodeMap.get(edge.path("source").asText());
                    String triggerVal = null;
                    String triggerType = "match";
                    String sHandle = edge.path("sourceHandle").asText(null);
                    boolean isElse = "else".equals(sHandle) || (edge.has("label") && edge.path("label").asText().toUpperCase().contains("ELSE"));

                    if (sHandle != null && sHandle.startsWith("opt-")) {
                        try {
                            triggerVal = URLDecoder.decode(sHandle.substring(4), StandardCharsets.UTF_8);
                        } catch (Exception ignored) {}
                    } else if (edge.has("data") && edge.path("data").has("triggerValue")) {
                        triggerVal = edge.path("data").path("triggerValue").asText();
                    }

                    Integer sourceQId = null;
                    Integer sourceG = null;
                    if (srcNode != null && "question".equals(srcNode.path("type").asText())) {
                        sourceQId = srcNode.path("data").path("question_id").asInt(1);
                        sourceG = getNodeGroup(srcNode, srcNode.path("data"), nodeMap, defaultGroupNumber);
                        if (isElse) triggerType = "else";
                    } else if (srcNode != null && "decision".equals(srcNode.path("type").asText())) {
                        JsonNode decData = srcNode.path("data");
                        List<JsonNode> dEdges = findEdgesByTarget(edges, srcNode.path("id").asText());
                        for (JsonNode de : dEdges) {
                            JsonNode dSrc = nodeMap.get(de.path("source").asText());
                            if (dSrc != null && "question".equals(dSrc.path("type").asText())) {
                                sourceQId = dSrc.path("data").path("question_id").asInt(1);
                                sourceG = getNodeGroup(dSrc, dSrc.path("data"), nodeMap, defaultGroupNumber);
                                triggerVal = decData.path("comparisonValue").asText("Yes");
                                String condType = decData.path("conditionType").asText("match");
                                if (isElse) {
                                    triggerType = "match".equals(condType) ? "not_match" : ("greater".equals(condType) ? "less_or_equal" : "greater_or_equal");
                                } else {
                                    triggerType = condType;
                                }
                                break;
                            }
                        }
                    }

                    if (sourceQId != null && triggerVal != null) {
                        Map<String, Object> jumpEntry = new LinkedHashMap<>();
                        jumpEntry.put("group_id", gIdStr);
                        jumpEntry.put("group_title", targetTitle);
                        jumpEntry.put("source_question_id", sourceQId);
                        jumpEntry.put("trigger_value", triggerVal);
                        jumpEntry.put("trigger_type", triggerType);
                        jumpEntry.put("source_handle", sHandle);
                        jumpEntry.put("source_group", sourceG);

                        int existingIdx = -1;
                        for (int i = 0; i < groupJumps.size(); i++) {
                            Map<String, Object> existing = groupJumps.get(i);
                            if (gIdStr.equals(existing.get("group_id"))
                                    && (existing.get("source_question_id") == null || Objects.equals(existing.get("source_question_id"), sourceQId))
                                    && (existing.get("trigger_value") == null || Objects.equals(existing.get("trigger_value"), triggerVal))
                                    && (existing.get("trigger_type") == null || Objects.equals(existing.get("trigger_type"), triggerType))) {
                                existingIdx = i;
                                break;
                            }
                        }
                        if (existingIdx >= 0) {
                            groupJumps.get(existingIdx).putAll(jumpEntry);
                        } else {
                            groupJumps.add(jumpEntry);
                        }
                    }
                }
            }
        }

        // 3. Process conditional cross-group edges between questions or decisions
        if (edges != null && edges.isArray()) {
            for (JsonNode edge : edges) {
                JsonNode srcNode = nodeMap.get(edge.path("source").asText());
                JsonNode tgtNode = nodeMap.get(edge.path("target").asText());
                if (srcNode == null || tgtNode == null) continue;

                Integer sourceQId = null;
                Integer sourceG = null;
                String triggerVal = null;
                String triggerType = "match";
                String sHandle = edge.path("sourceHandle").asText(null);
                boolean isElse = "else".equals(sHandle) || (edge.has("label") && edge.path("label").asText().toUpperCase().contains("ELSE"));

                if ("question".equals(srcNode.path("type").asText())) {
                    sourceQId = srcNode.path("data").path("question_id").asInt(1);
                    sourceG = getNodeGroup(srcNode, srcNode.path("data"), nodeMap, defaultGroupNumber);
                    if (sHandle != null && sHandle.startsWith("opt-")) {
                        try {
                            triggerVal = URLDecoder.decode(sHandle.substring(4), StandardCharsets.UTF_8).trim();
                        } catch (Exception ignored) {}
                    } else if (isElse) {
                        triggerType = "else";
                        triggerVal = edge.path("data").path("triggerValue").asText("else").trim();
                    } else if (edge.has("data") && edge.path("data").has("triggerValue")) {
                        triggerVal = edge.path("data").path("triggerValue").asText().trim();
                    }
                } else if ("decision".equals(srcNode.path("type").asText())) {
                    JsonNode decData = srcNode.path("data");
                    List<JsonNode> dEdges = findEdgesByTarget(edges, srcNode.path("id").asText());
                    for (JsonNode de : dEdges) {
                        JsonNode dSrc = nodeMap.get(de.path("source").asText());
                        if (dSrc != null && "question".equals(dSrc.path("type").asText())) {
                            sourceQId = dSrc.path("data").path("question_id").asInt(1);
                            sourceG = getNodeGroup(dSrc, dSrc.path("data"), nodeMap, defaultGroupNumber);
                            triggerVal = decData.path("comparisonValue").asText("Yes");
                            String condType = decData.path("conditionType").asText("match");
                            if (isElse) {
                                triggerType = "match".equals(condType) ? "not_match" : ("greater".equals(condType) ? "less_or_equal" : "greater_or_equal");
                            } else {
                                triggerType = condType;
                            }
                            break;
                        }
                    }
                }

                if (sourceQId != null && triggerVal != null) {
                    int tgtGroup = "question".equals(tgtNode.path("type").asText())
                            ? getNodeGroup(tgtNode, tgtNode.path("data"), nodeMap, defaultGroupNumber)
                            : tgtNode.path("data").path("numericGroupId").asInt(
                                extractNumber(tgtNode.path("data").path("groupId").asText(), -1));

                    if (sourceG != null && tgtGroup > 0 && sourceG != tgtGroup) {
                        String gIdStr = String.valueOf(tgtGroup);
                        String targetTitle = tgtNode.path("data").has("title") ? tgtNode.path("data").path("title").asText() : "Group " + tgtGroup;
                        Integer targetQId = "question".equals(tgtNode.path("type").asText()) ? tgtNode.path("data").path("question_id").asInt(1) : null;

                        Map<String, Object> jumpEntry = new LinkedHashMap<>();
                        jumpEntry.put("group_id", gIdStr);
                        jumpEntry.put("group_title", targetTitle);
                        jumpEntry.put("source_question_id", sourceQId);
                        jumpEntry.put("trigger_value", triggerVal);
                        jumpEntry.put("trigger_type", triggerType);
                        jumpEntry.put("source_handle", sHandle);
                        jumpEntry.put("source_group", sourceG);
                        if (targetQId != null) jumpEntry.put("target_question_id", targetQId);

                        int existingIdx = -1;
                        for (int i = 0; i < groupJumps.size(); i++) {
                            Map<String, Object> existing = groupJumps.get(i);
                            if (gIdStr.equals(existing.get("group_id"))
                                    && (existing.get("source_question_id") == null || Objects.equals(existing.get("source_question_id"), sourceQId))
                                    && (existing.get("trigger_value") == null || Objects.equals(existing.get("trigger_value"), triggerVal))
                                    && (existing.get("trigger_type") == null || Objects.equals(existing.get("trigger_type"), triggerType))
                                    && (existing.get("target_question_id") == null || Objects.equals(existing.get("target_question_id"), targetQId))) {
                                existingIdx = i;
                                break;
                            }
                        }
                        if (existingIdx >= 0) {
                            groupJumps.get(existingIdx).putAll(jumpEntry);
                        } else {
                            groupJumps.add(jumpEntry);
                        }
                    }
                }
            }
        }

        Set<Integer> detectedGroupNumbers = new HashSet<>();
        if (groupMeta != null) {
            if (groupMeta.has("groupNumber")) detectedGroupNumbers.add(groupMeta.path("groupNumber").asInt());
            if (groupMeta.has("totalGroups")) detectedGroupNumbers.add(groupMeta.path("totalGroups").asInt());
        }
        for (Map<String, Object> q : questions) {
            Object g = q.get("group");
            if (g instanceof Number) detectedGroupNumbers.add(((Number) g).intValue());
        }
        for (JsonNode n : nodes) {
            String type = n.path("type").asText();
            if ("groupFrame".equals(type) || "groupContainer".equals(type)) {
                JsonNode d = n.path("data");
                if (d.has("numericGroupId")) {
                    detectedGroupNumbers.add(d.path("numericGroupId").asInt());
                } else if (d.has("groupId")) {
                    int parsed = extractNumber(d.path("groupId").asText(), -1);
                    if (parsed > 0) detectedGroupNumbers.add(parsed);
                }
            }
        }

        int maxGroupNum = detectedGroupNumbers.isEmpty() ? 1 : Collections.max(detectedGroupNumbers);
        int totalGroups = groupMeta != null && groupMeta.has("totalGroups")
                ? Math.max(groupMeta.path("totalGroups").asInt(1), maxGroupNum)
                : Math.max(1, maxGroupNum);

        int currentGroup = groupMeta != null && groupMeta.has("groupNumber") ? groupMeta.path("groupNumber").asInt(1) : 1;
        boolean hasNext = (groupMeta != null && groupMeta.path("hasNextGroup").asBoolean(false))
                || currentGroup < totalGroups
                || !groupJumps.isEmpty();

        String instruction = groupMeta != null && groupMeta.has("instruction") && !groupMeta.path("instruction").asText().isBlank()
                ? groupMeta.path("instruction").asText()
                : "Complete all required questions.";

        return new CompileResponse(
                totalGroups,
                currentGroup,
                hasNext,
                instruction,
                questions,
                !groupJumps.isEmpty() ? groupJumps : null,
                !groupJumps.isEmpty() ? groupJumps : null
        );
    }

    public ValidateResponse validate(ValidateRequest req) {
        JsonNode nodes = req.nodes();
        JsonNode edges = req.edges();

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        int totalNodes = nodes != null && nodes.isArray() ? nodes.size() : 0;
        int totalEdges = edges != null && edges.isArray() ? edges.size() : 0;
        int totalQuestions = 0;
        int totalDecisions = 0;

        List<JsonNode> startNodes = new ArrayList<>();
        List<JsonNode> questionNodes = new ArrayList<>();
        List<JsonNode> decisionNodes = new ArrayList<>();

        if (nodes != null && nodes.isArray()) {
            for (JsonNode n : nodes) {
                String type = n.path("type").asText();
                if ("start".equals(type)) startNodes.add(n);
                else if ("question".equals(type)) {
                    questionNodes.add(n);
                    totalQuestions++;
                } else if ("decision".equals(type)) {
                    decisionNodes.add(n);
                    totalDecisions++;
                }
            }
        }

        if (startNodes.isEmpty()) {
            warnings.add("No Start node found in the flowchart.");
        } else if (startNodes.size() > 1) {
            warnings.add("Multiple Start nodes found in the flowchart.");
        }

        if (questionNodes.isEmpty()) {
            warnings.add("Flowchart has no question nodes.");
        }

        for (JsonNode q : questionNodes) {
            String qId = q.path("id").asText();
            List<JsonNode> in = findEdgesByTarget(edges, qId);
            List<JsonNode> out = findEdgesBySource(edges, qId);
            if (in.isEmpty() && out.isEmpty()) {
                String label = q.path("data").has("question") ? q.path("data").path("question").asText() : qId;
                warnings.add("Question \"" + label + "\" is disconnected from the flow.");
            }
        }

        for (JsonNode d : decisionNodes) {
            String dId = d.path("id").asText();
            List<JsonNode> out = findEdgesBySource(edges, dId);
            if (out.size() < 2) {
                String label = d.path("data").has("label") ? d.path("data").path("label").asText() : dId;
                warnings.add("Decision node \"" + label + "\" has fewer than 2 outgoing branch paths.");
            }
        }

        Map<String, Integer> summary = new LinkedHashMap<>();
        summary.put("totalNodes", totalNodes);
        summary.put("totalEdges", totalEdges);
        summary.put("totalQuestions", totalQuestions);
        summary.put("totalDecisions", totalDecisions);

        return new ValidateResponse(
                errors.isEmpty(),
                errors,
                warnings,
                summary
        );
    }

    private List<JsonNode> findEdgesByTarget(JsonNode edges, String targetId) {
        List<JsonNode> list = new ArrayList<>();
        if (edges == null || !edges.isArray()) return list;
        for (JsonNode e : edges) {
            if (targetId.equals(e.path("target").asText())) {
                list.add(e);
            }
        }
        return list;
    }

    private List<JsonNode> findEdgesBySource(JsonNode edges, String sourceId) {
        List<JsonNode> list = new ArrayList<>();
        if (edges == null || !edges.isArray()) return list;
        for (JsonNode e : edges) {
            if (sourceId.equals(e.path("source").asText())) {
                list.add(e);
            }
        }
        return list;
    }

    private int getNodeGroup(JsonNode node, JsonNode nodeData, Map<String, JsonNode> nodeMap, int defaultGroup) {
        if (node != null && node.path("data").has("group") && node.path("data").path("group").isNumber()) {
            int g = node.path("data").path("group").asInt();
            if (g > 0) return g;
        }
        if (nodeData != null && nodeData.has("containerId") && !nodeData.path("containerId").asText().isBlank()) {
            JsonNode container = nodeMap.get(nodeData.path("containerId").asText());
            if (container != null) {
                if (container.path("data").has("numericGroupId") && container.path("data").path("numericGroupId").isNumber()) {
                    int ng = container.path("data").path("numericGroupId").asInt();
                    if (ng > 0) return ng;
                }
                String title = container.path("data").has("title") ? container.path("data").path("title").asText()
                        : (container.path("data").has("titleBn") ? container.path("data").path("titleBn").asText() : null);
                if (title != null) {
                    int parsedTitle = extractNumber(title, -1);
                    if (parsedTitle > 0) return parsedTitle;
                }
                if (container.path("data").has("groupId") && !container.path("data").path("groupId").asText().startsWith("grp-frame-")) {
                    int parsedGid = extractNumber(container.path("data").path("groupId").asText(), -1);
                    if (parsedGid > 0) return parsedGid;
                }
            }
        }
        if (nodeData != null && nodeData.has("group") && nodeData.path("group").isNumber()) {
            int g = nodeData.path("group").asInt();
            if (g > 0) return g;
        }
        return defaultGroup;
    }

    private int extractNumber(String str, int fallback) {
        if (str == null) return fallback;
        String digits = str.replaceAll("\\D+", "");
        if (digits.isBlank()) return fallback;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
