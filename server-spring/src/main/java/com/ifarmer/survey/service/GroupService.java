package com.ifarmer.survey.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.ifarmer.survey.model.dto.CreateGroupRequest;
import com.ifarmer.survey.model.dto.QuestionGroupDto;
import com.ifarmer.survey.model.dto.UpdateGroupRequest;
import com.ifarmer.survey.model.entity.QuestionGroupEntity;
import com.ifarmer.survey.repository.QuestionGroupRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class GroupService {

    private final QuestionGroupRepository groupRepository;
    private final ObjectMapper objectMapper;

    public GroupService(QuestionGroupRepository groupRepository, ObjectMapper objectMapper) {
        this.groupRepository = groupRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<QuestionGroupDto> findAll() {
        return groupRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionGroupDto findOne(String id) {
        Optional<QuestionGroupEntity> found = groupRepository.findById(id);
        if (found.isEmpty()) {
            if (id.startsWith("grp-")) {
                found = groupRepository.findById(id.substring(4));
            } else {
                found = groupRepository.findById("grp-" + id);
            }
        }
        if (found.isEmpty()) {
            try {
                int numericG = Integer.parseInt(id.replaceAll("\\D+", ""));
                found = groupRepository.findAll().stream()
                        .filter(g -> g.getGroupId() != null && g.getGroupId() == numericG)
                        .findFirst();
            } catch (Exception ignored) {}
        }
        return found
                .map(this::mapToDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question group with ID '" + id + "' not found"));
    }

    @Transactional
    public QuestionGroupDto create(CreateGroupRequest req) {
        Instant now = Instant.now();
        List<QuestionGroupEntity> all = groupRepository.findAll();
        int maxGroupId = 0;
        for (QuestionGroupEntity g : all) {
            if (g.getGroupId() != null && g.getGroupId() > maxGroupId) {
                maxGroupId = g.getGroupId();
            }
            String gid = g.getId();
            if (gid != null) {
                if (gid.startsWith("grp-")) {
                    String suffix = gid.substring(4);
                    try {
                        int num = Integer.parseInt(suffix);
                        if (num < 1000000 && num > maxGroupId) maxGroupId = num;
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        int assignedGroupId = (req.groupId() != null && req.groupId() > 0) ? req.groupId() : maxGroupId + 1;
        String id = "grp-" + assignedGroupId;

        QuestionGroupEntity entity = new QuestionGroupEntity();
        entity.setId(id);
        entity.setGroupId(assignedGroupId);
        entity.setName(req.name());
        entity.setNameBn(req.nameBn() != null && !req.nameBn().isBlank() ? req.nameBn() : req.name());
        entity.setDescription(req.description() != null ? req.description() : "");
        entity.setCategory(req.category() != null ? req.category() : "custom");
        entity.setColor(req.color() != null ? req.color() : "#0284c7");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity.setQuestions(req.questions() != null ? req.questions() : objectMapper.createArrayNode());
        entity.setFlowNodes(req.flowNodes());
        entity.setFlowEdges(req.flowEdges());

        QuestionGroupEntity saved = groupRepository.save(entity);
        return mapToDto(saved);
    }

    @Transactional
    public QuestionGroupDto update(String id, UpdateGroupRequest req) {
        QuestionGroupEntity entity = groupRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question group with ID '" + id + "' not found"));

        if (req.name() != null) entity.setName(req.name());
        if (req.nameBn() != null) entity.setNameBn(req.nameBn());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.category() != null) entity.setCategory(req.category());
        if (req.color() != null) entity.setColor(req.color());
        if (req.groupId() != null) entity.setGroupId(req.groupId());
        if (req.questions() != null) entity.setQuestions(req.questions());
        if (req.flowNodes() != null) entity.setFlowNodes(req.flowNodes());
        if (req.flowEdges() != null) entity.setFlowEdges(req.flowEdges());

        entity.setUpdatedAt(Instant.now());
        QuestionGroupEntity saved = groupRepository.save(entity);
        return mapToDto(saved);
    }

    @Transactional
    public Map<String, Object> delete(String id) {
        if (!groupRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Question group with ID '" + id + "' not found");
        }
        groupRepository.deleteById(id);
        return Map.of("success", true, "id", id);
    }

    @Transactional
    public List<QuestionGroupDto> reset() {
        groupRepository.deleteAll();
        seedDefaultGroups();
        return findAll();
    }

    public void seedDefaultGroups() {
        if (groupRepository.count() > 0) {
            return;
        }

        Instant now = Instant.now();

        // 1. Farmer Identity & KYC
        QuestionGroupEntity g1 = new QuestionGroupEntity();
        g1.setId("grp-kyc-basic");
        g1.setGroupId(1);
        g1.setName("Farmer Identity & KYC");
        g1.setNameBn("কৃষকের পরিচয় ও কেওয়াইসি (KYC)");
        g1.setDescription("Core farmer biometric, identity, and contact verification questions.");
        g1.setCategory("kyc");
        g1.setColor("#0284c7");
        g1.setCreatedAt(now);
        g1.setUpdatedAt(now);

        ArrayNode q1 = objectMapper.createArrayNode();
        q1.addObject()
                .put("question", "Farmer Full Name")
                .put("question_bn", "কৃষকের পূর্ণ নাম")
                .put("answer_type", "string")
                .put("mandatory", true)
                .put("placeholder", "জাতীয় পরিচয়পত্র অনুযায়ী নাম লিখুন")
                .put("hint", "NID অনুযায়ী সঠিক বানান লিখুন");
        q1.addObject()
                .put("question", "Mobile Phone Number")
                .put("question_bn", "মোবাইল ফোন নম্বর")
                .put("answer_type", "phone")
                .put("mandatory", true)
                .put("placeholder", "০১৭১XXXXXXX")
                .put("hint", "১১ ডিজিটের সক্রিয় নম্বর লিখুন");
        q1.addObject()
                .put("question", "National ID (NID) Number")
                .put("question_bn", "জাতীয় পরিচয়পত্র নম্বর (NID)")
                .put("answer_type", "string")
                .put("mandatory", true)
                .put("placeholder", "১০ বা ১৭ সংখ্যার নম্বর");
        q1.addObject()
                .put("question", "Farmer Profile Photo")
                .put("question_bn", "কৃষকের ছবি")
                .put("answer_type", "image")
                .put("mandatory", false)
                .put("hint", "ক্যামেরা দিয়ে সরাসরি ছবি তুলুন");
        g1.setQuestions(q1);

        // 2. Land & Cultivation
        QuestionGroupEntity g2 = new QuestionGroupEntity();
        g2.setId("grp-land-cultivation");
        g2.setGroupId(2);
        g2.setName("Land & Cultivation Assessment");
        g2.setNameBn("আবাদি জমি ও চাষাবাদ তথ্য");
        g2.setDescription("Landholding size, ownership structure, and plot details.");
        g2.setCategory("land");
        g2.setColor("#10b981");
        g2.setCreatedAt(now);
        g2.setUpdatedAt(now);

        ArrayNode q2 = objectMapper.createArrayNode();
        q2.addObject()
                .put("question", "Do you own cultivating land?")
                .put("question_bn", "আপনার কি নিজস্ব আবাদি জমি আছে?")
                .put("answer_type", "select_one")
                .put("mandatory", true)
                .put("options", "হ্যাঁ (Yes), না (No)");
        q2.addObject()
                .put("question", "Total Land Size (Decimals)")
                .put("question_bn", "মোট আবাদযোগ্য জমির পরিমাণ (শতাংশ)")
                .put("answer_type", "integer")
                .put("mandatory", true)
                .put("placeholder", "যেমন: ৫০")
                .put("hint", "শতাংশে মোট পরিমাণ লিখুন");
        q2.addObject()
                .put("question", "Land Ownership Type")
                .put("question_bn", "জমির মালিকানার ধরন")
                .put("answer_type", "dropdown")
                .put("mandatory", true)
                .put("options", "নিজস্ব, বর্গা, লিজকৃত, যৌথ মালিকানা");
        g2.setQuestions(q2);

        // 3. Crop & Production
        QuestionGroupEntity g3 = new QuestionGroupEntity();
        g3.setId("grp-crop-production");
        g3.setGroupId(3);
        g3.setName("Crop & Production Details");
        g3.setNameBn("ফসল উৎপাদন ও মৌসুম তথ্য");
        g3.setDescription("Crop variety, harvest forecast, and cultivation cycle.");
        g3.setCategory("crop");
        g3.setColor("#f59e0b");
        g3.setCreatedAt(now);
        g3.setUpdatedAt(now);

        ArrayNode q3 = objectMapper.createArrayNode();
        q3.addObject()
                .put("question", "Primary Crop Variety")
                .put("question_bn", "প্রধান ফসলের ধরন")
                .put("answer_type", "dropdown")
                .put("mandatory", true)
                .put("options", "আমন ধান, বোরো ধান, ভুট্টা, আলু, পেঁয়াজ, সবজি, মাছ চাষ");
        q3.addObject()
                .put("question", "Expected Yield (Maund)")
                .put("question_bn", "প্রত্যাশিত ফলন (মণ)")
                .put("answer_type", "float")
                .put("mandatory", true)
                .put("placeholder", "যেমন: ৮০.৫");
        g3.setQuestions(q3);

        // 4. Livestock & Dairy
        QuestionGroupEntity g4 = new QuestionGroupEntity();
        g4.setId("grp-cattle-dairy");
        g4.setGroupId(4);
        g4.setName("Livestock & Dairy Assets");
        g4.setNameBn("গবাদিপশু ও ডেইরি তথ্য");
        g4.setDescription("Cattle headcount, breed information, and daily milk production.");
        g4.setCategory("custom");
        g4.setColor("#8b5cf6");
        g4.setCreatedAt(now);
        g4.setUpdatedAt(now);

        ArrayNode q4 = objectMapper.createArrayNode();
        q4.addObject()
                .put("question", "Number of Dairy Cows")
                .put("question_bn", "দুধেল গরুর সংখ্যা")
                .put("answer_type", "integer")
                .put("mandatory", true)
                .put("placeholder", "যেমন: ৪");
        q4.addObject()
                .put("question", "Daily Milk Production (Liters)")
                .put("question_bn", "দৈনিক দুধের উৎপাদন (লিটার)")
                .put("answer_type", "float")
                .put("mandatory", false)
                .put("placeholder", "যেমন: ১৫.০");
        g4.setQuestions(q4);

        groupRepository.saveAll(List.of(g1, g2, g3, g4));
    }

    private QuestionGroupDto mapToDto(QuestionGroupEntity entity) {
        return new QuestionGroupDto(
                entity.getId(),
                entity.getGroupId(),
                entity.getName(),
                entity.getNameBn(),
                entity.getDescription(),
                entity.getCategory(),
                entity.getColor(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString(),
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : Instant.now().toString(),
                entity.getQuestions(),
                entity.getFlowNodes(),
                entity.getFlowEdges()
        );
    }
}

