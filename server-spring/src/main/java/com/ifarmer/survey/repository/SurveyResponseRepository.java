package com.ifarmer.survey.repository;

import com.ifarmer.survey.model.entity.SurveyResponseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SurveyResponseRepository extends JpaRepository<SurveyResponseEntity, String> {

    List<SurveyResponseEntity> findBySurveyIdOrderByCreatedAtDesc(String surveyId);

    List<SurveyResponseEntity> findBySurveyIdAndRespondentIdOrderByGroupNumberAsc(String surveyId, String respondentId);

    List<SurveyResponseEntity> findBySurveyIdAndSurveyorIdOrderByCreatedAtDesc(String surveyId, String surveyorId);

    List<SurveyResponseEntity> findBySurveyIdAndRespondentIdAndGroupNumberOrderByCreatedAtDesc(
            String surveyId, String respondentId, int groupNumber);
}

