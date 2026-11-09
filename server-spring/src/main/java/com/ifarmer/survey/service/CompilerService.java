package com.ifarmer.survey.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.ifarmer.survey.model.dto.CompileRequest;
import com.ifarmer.survey.model.dto.CompileResponse;
import com.ifarmer.survey.model.dto.ValidateRequest;
import com.ifarmer.survey.model.dto.ValidateResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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

        List<Map<String, Object>> questions = new ArrayList<>();

        for (JsonNode qNode : questionNodes) {
            JsonNode data = qNode.path("data");
            String qNodeId = qNode.path("id").asText();
            int qId = data.path("question_id").asInt(extractNumber(qNodeId, 1));

            List<Integer> dependsOn = new ArrayList<>();
            Map<String, Object> validationMap = new LinkedHashMap<>();

            List<JsonNode> incomingEdges = findEdgesByTarget(edges, qNodeId);

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

                    String label = inEdge.path("label").asText(null);
                    if (label != null && !label.isBlank()) {
                        int parentGroup = getNodeGroup(sourceNode, parentData, nodeMap, defaultGroupNumber);
                        int myGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

                        Map<String, Object> valConfig = new LinkedHashMap<>();
                        valConfig.put("validation_type", "match");
                        valConfig.put("validation", label);
                        valConfig.put("is_same_group", parentGroup == myGroup);
                        valConfig.put("group", parentGroup);
                        validationMap.put(String.valueOf(parentId), valConfig);
                    }
                } else if ("decision".equals(sourceType)) {
                    List<JsonNode> decisionIncoming = findEdgesByTarget(edges, sourceId);
                    for (JsonNode dInEdge : decisionIncoming) {
                        String granSourceId = dInEdge.path("source").asText();
                        JsonNode granSource = nodeMap.get(granSourceId);
                        if (granSource != null && "question".equals(granSource.path("type").asText())) {
                            JsonNode granData = granSource.path("data");
                            int parentId = granData.path("question_id").asInt(1);
                            if (!dependsOn.contains(parentId)) {
                                dependsOn.add(parentId);
                            }

                            String edgeLabel = inEdge.has("label") && !inEdge.path("label").asText().isBlank()
                                    ? inEdge.path("label").asText()
                                    : inEdge.path("data").path("label").asText("Yes");

                            int parentGroup = getNodeGroup(granSource, granData, nodeMap, defaultGroupNumber);
                            int myGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

                            Map<String, Object> valConfig = new LinkedHashMap<>();
                            valConfig.put("validation_type", "match");
                            valConfig.put("validation", edgeLabel);
                            valConfig.put("is_same_group", parentGroup == myGroup);
                            valConfig.put("group", parentGroup);
                            validationMap.put(String.valueOf(parentId), valConfig);
                        }
                    }
                }
            }

            int qGroup = getNodeGroup(qNode, data, nodeMap, defaultGroupNumber);

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

            questions.add(qObj);
        }

        // Process group jumps
        List<Map<String, String>> groupJumps = new ArrayList<>();
        if (groupMeta != null && groupMeta.has("groupJumps") && groupMeta.path("groupJumps").isArray()) {
            for (JsonNode gj : groupMeta.path("groupJumps")) {
                Map<String, String> j = new LinkedHashMap<>();
                j.put("group_id", gj.path("group_id").asText());
                j.put("group_title", gj.path("group_title").asText());
                groupJumps.add(j);
            }
        }

        for (JsonNode jNode : jumpNodes) {
            JsonNode jData = jNode.path("data");
            String targetGid = jData.has("targetGroupId") ? jData.path("targetGroupId").asText()
                    : (jData.has("group_id") ? jData.path("group_id").asText() : "2");
            String targetTitle = jData.has("targetGroupTitle") ? jData.path("targetGroupTitle").asText()
                    : (jData.has("label") ? jData.path("label").asText() : "Group " + targetGid);

            boolean exists = groupJumps.stream().anyMatch(g -> targetGid.equals(g.get("group_id")));
            if (!exists) {
                Map<String, String> j = new LinkedHashMap<>();
                j.put("group_id", targetGid);
                j.put("group_title", targetTitle);
                groupJumps.add(j);
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
            return node.path("data").path("group").asInt();
        }
        if (nodeData != null && nodeData.has("containerId") && !nodeData.path("containerId").asText().isBlank()) {
            JsonNode container = nodeMap.get(nodeData.path("containerId").asText());
            if (container != null && container.path("data").has("groupId")) {
                return container.path("data").path("groupId").asInt();
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

