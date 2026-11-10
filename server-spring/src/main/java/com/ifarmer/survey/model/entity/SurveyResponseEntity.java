package com.ifarmer.survey.model.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "\"survey_responses\"")
public class SurveyResponseEntity {

    @Id
    @Column(name = "\"id\"", length = 128, nullable = false)
    private String id;

    @Column(name = "\"surveyId\"", length = 128, nullable = false)
    private String surveyId;

    @Column(name = "\"versionId\"", length = 128)
    private String versionId;

    @Column(name = "\"respondentId\"", length = 128)
    private String respondentId;

    @Column(name = "\"surveyorId\"", length = 128)
    private String surveyorId;

    @Column(name = "\"groupNumber\"", nullable = false)
    private int groupNumber = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"answers\"", columnDefinition = "jsonb")
    private JsonNode answers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"mediaUrls\"", columnDefinition = "jsonb")
    private JsonNode mediaUrls;

    @Column(name = "\"latitude\"")
    private Double latitude;

    @Column(name = "\"longitude\"")
    private Double longitude;

    @Column(name = "\"isGroupJumped\"")
    private Boolean isGroupJumped = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "\"metadata\"", columnDefinition = "jsonb")
    private JsonNode metadata;

    @CreationTimestamp
    @Column(name = "\"createdAt\"", updatable = false)
    private Instant createdAt;

    public SurveyResponseEntity() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSurveyId() {
        return surveyId;
    }

    public void setSurveyId(String surveyId) {
        this.surveyId = surveyId;
    }

    public String getVersionId() {
        return versionId;
    }

    public void setVersionId(String versionId) {
        this.versionId = versionId;
    }

    public String getRespondentId() {
        return respondentId;
    }

    public void setRespondentId(String respondentId) {
        this.respondentId = respondentId;
    }

    public String getSurveyorId() {
        return surveyorId;
    }

    public void setSurveyorId(String surveyorId) {
        this.surveyorId = surveyorId;
    }

    public int getGroupNumber() {
        return groupNumber;
    }

    public void setGroupNumber(int groupNumber) {
        this.groupNumber = groupNumber;
    }

    public JsonNode getAnswers() {
        return answers;
    }

    public void setAnswers(JsonNode answers) {
        this.answers = answers;
    }

    public JsonNode getMediaUrls() {
        return mediaUrls;
    }

    public void setMediaUrls(JsonNode mediaUrls) {
        this.mediaUrls = mediaUrls;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Boolean getIsGroupJumped() {
        return isGroupJumped;
    }

    public void setIsGroupJumped(Boolean groupJumped) {
        isGroupJumped = groupJumped;
    }

    public JsonNode getMetadata() {
        return metadata;
    }

    public void setMetadata(JsonNode metadata) {
        this.metadata = metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

